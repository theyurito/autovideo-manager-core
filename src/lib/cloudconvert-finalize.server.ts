import { cloudConvertRequest } from "@/lib/cloudconvert.server";

const MAX_ERROR_LENGTH = 500;
const MAX_OUTPUT_BYTES = 200 * 1024 * 1024; // 200 MB - limite prático para reels curtos

export type FinalizeResult =
  | { ok: true; outcome: "READY"; videoId: string; processedPath: string; alreadyDone: boolean }
  | { ok: true; outcome: "FAILED"; videoId: string; message: string; alreadyDone: boolean }
  | { ok: true; outcome: "PENDING"; videoId: string | null; message: string }
  | { ok: false; outcome: "NOT_FOUND" | "ERROR"; message: string };

type CloudConvertTask = {
  id?: string;
  name?: string;
  operation?: string;
  status?: string;
  message?: string;
  code?: string;
  result?: { files?: Array<{ filename?: string; url?: string; size?: number }> };
};

type CloudConvertJob = {
  data?: {
    id?: string;
    status?: string;
    tag?: string | null;
    tasks?: CloudConvertTask[];
  };
};

function sanitize(message: string): string {
  return message
    .replace(/https?:\/\/\S+/g, "[url removida]")
    .replace(/Bearer\s+\S+/gi, "[credencial removida]")
    .slice(0, MAX_ERROR_LENGTH);
}

/**
 * Fonte autoritativa: consulta o job na API do CloudConvert, localiza o vídeo
 * por processing_job_id e finaliza (PRONTO ou COM_ERRO). Idempotente.
 */
export async function finalizeCloudConvertJob(jobId: string): Promise<FinalizeResult> {
  if (!jobId || typeof jobId !== "string") {
    return { ok: false, outcome: "ERROR", message: "jobId inválido." };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: video, error: videoError } = await supabaseAdmin
    .from("videos")
    .select("id, user_id, status, processed_path, processing_job_id")
    .eq("processing_job_id", jobId)
    .maybeSingle();

  if (videoError) {
    return { ok: false, outcome: "ERROR", message: sanitize(videoError.message) };
  }
  if (!video) {
    return { ok: false, outcome: "NOT_FOUND", message: "Nenhum vídeo corresponde a este job." };
  }

  const processedPath = `${video.user_id}/${video.id}/output.mp4`;

  // Idempotência: já finalizado com sucesso
  if (video.status === "PRONTO" && video.processed_path === processedPath) {
    return { ok: true, outcome: "READY", videoId: video.id, processedPath, alreadyDone: true };
  }

  let job: CloudConvertJob;
  try {
    job = await cloudConvertRequest<CloudConvertJob>(`/jobs/${encodeURIComponent(jobId)}`);
  } catch (err) {
    return {
      ok: false,
      outcome: "ERROR",
      message: sanitize(err instanceof Error ? err.message : String(err)),
    };
  }

  const data = job?.data;
  if (!data?.id || data.id !== jobId) {
    return { ok: false, outcome: "ERROR", message: "Job não confirmado pela API CloudConvert." };
  }

  const status = data.status;

  if (status === "error") {
    // Evento de falha atrasado não deve regredir um vídeo já PRONTO
    if (video.status === "PRONTO") {
      return { ok: true, outcome: "READY", videoId: video.id, processedPath: video.processed_path ?? processedPath, alreadyDone: true };
    }
    const failedTask = (data.tasks ?? []).find((t) => t.status === "error");
    const message = sanitize(
      failedTask?.message ?? failedTask?.code ?? "CloudConvert reportou falha no job.",
    );
    if (video.status === "COM_ERRO") {
      return { ok: true, outcome: "FAILED", videoId: video.id, message, alreadyDone: true };
    }
    await supabaseAdmin
      .from("videos")
      .update({
        status: "COM_ERRO",
        processing_finished_at: new Date().toISOString(),
        last_error: message,
      })
      .eq("id", video.id)
      .eq("processing_job_id", jobId);
    return { ok: true, outcome: "FAILED", videoId: video.id, message, alreadyDone: false };
  }

  if (status !== "finished") {
    return {
      ok: true,
      outcome: "PENDING",
      videoId: video.id,
      message: `Job ainda não finalizado (status: ${status ?? "desconhecido"}).`,
    };
  }

  const exportTask =
    (data.tasks ?? []).find((t) => t.name === "export-video" && t.operation === "export/url") ??
    (data.tasks ?? []).find((t) => t.operation === "export/url");

  if (!exportTask || exportTask.status !== "finished") {
    return { ok: false, outcome: "ERROR", message: "Task de exportação ausente ou incompleta." };
  }

  const files = exportTask.result?.files ?? [];
  if (files.length !== 1 || !files[0]?.url) {
    return { ok: false, outcome: "ERROR", message: "Exportação não retornou exatamente um arquivo." };
  }

  const downloadUrl = files[0].url as string;

  let response: Response;
  try {
    response = await fetch(downloadUrl, { signal: AbortSignal.timeout(120_000) });
  } catch (err) {
    return {
      ok: false,
      outcome: "ERROR",
      message: sanitize(`Falha de rede ao baixar resultado: ${err instanceof Error ? err.message : String(err)}`),
    };
  }

  if (!response.ok) {
    return { ok: false, outcome: "ERROR", message: `Download do resultado falhou (HTTP ${response.status}).` };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/video|octet-stream|mp4/i.test(contentType)) {
    return { ok: false, outcome: "ERROR", message: `Tipo de conteúdo inesperado no download: ${contentType}` };
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) {
    return { ok: false, outcome: "ERROR", message: "Arquivo exportado está vazio." };
  }
  if (buffer.byteLength > MAX_OUTPUT_BYTES) {
    return {
      ok: false,
      outcome: "ERROR",
      message: `Arquivo excede o limite suportado nesta fase (${Math.round(buffer.byteLength / 1024 / 1024)} MB).`,
    };
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from("ready-videos")
    .upload(processedPath, buffer, { contentType: "video/mp4", upsert: true });

  if (uploadError) {
    return { ok: false, outcome: "ERROR", message: sanitize(`Falha ao salvar no Storage: ${uploadError.message}`) };
  }

  const { error: updateError } = await supabaseAdmin
    .from("videos")
    .update({
      status: "PRONTO",
      processed_path: processedPath,
      processing_finished_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", video.id)
    .eq("processing_job_id", jobId);

  if (updateError) {
    return { ok: false, outcome: "ERROR", message: sanitize(`Upload feito, mas falha ao atualizar vídeo: ${updateError.message}`) };
  }

  return { ok: true, outcome: "READY", videoId: video.id, processedPath, alreadyDone: false };
}
