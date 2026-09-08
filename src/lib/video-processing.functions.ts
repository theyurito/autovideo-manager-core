import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MAX_PROCESSING_ATTEMPTS = 3;
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hora

export type StartVideoProcessingResult =
  | { ok: true; alreadyStarted: false; videoId: string; jobId: string }
  | { ok: true; alreadyStarted: true; videoId: string; jobId: string | null; message: string }
  | { ok: false; videoId: string; error: string };

type CloudConvertJobResponse = {
  data?: { id?: string; status?: string };
};

export const startVideoProcessing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { videoId: string }) => {
    if (!input || typeof input.videoId !== "string" || input.videoId.length < 10) {
      throw new Error("videoId inválido.");
    }
    return { videoId: input.videoId };
  })
  .handler(async ({ data, context }): Promise<StartVideoProcessingResult> => {
    const { supabase, userId } = context;
    const { videoId } = data;

    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("id, user_id, status, arquivo_id, processing_job_id, processing_attempts, processing_started_at")
      .eq("id", videoId)
      .eq("user_id", userId)
      .maybeSingle();

    if (videoError) {
      return { ok: false, videoId, error: `Falha ao buscar vídeo: ${videoError.message}` };
    }
    if (!video) {
      return { ok: false, videoId, error: "Vídeo não encontrado para o usuário autenticado." };
    }

    // Idempotência
    if (video.processing_job_id) {
      return {
        ok: true,
        alreadyStarted: true,
        videoId,
        jobId: video.processing_job_id,
        message: "Este vídeo já possui um processamento iniciado.",
      };
    }
    if (video.status === "PROCESSANDO") {
      return {
        ok: true,
        alreadyStarted: true,
        videoId,
        jobId: null,
        message: "Este vídeo já está em processamento.",
      };
    }
    if (video.status !== "PENDENTE") {
      return { ok: false, videoId, error: `Status inválido para iniciar processamento: ${video.status}.` };
    }
    if (!video.arquivo_id) {
      return { ok: false, videoId, error: "Vídeo sem arquivo associado." };
    }
    if (video.processing_attempts >= MAX_PROCESSING_ATTEMPTS) {
      return { ok: false, videoId, error: "Limite de tentativas de processamento atingido." };
    }

    // Reserva atômica: só um request consegue marcar processing_started_at
    const reservedAt = new Date().toISOString();
    const { data: reserved, error: reserveError } = await supabase
      .from("videos")
      .update({ processing_started_at: reservedAt })
      .eq("id", videoId)
      .eq("user_id", userId)
      .eq("status", "PENDENTE")
      .is("processing_job_id", null)
      .is("processing_started_at", null)
      .select("id")
      .maybeSingle();

    if (reserveError) {
      return { ok: false, videoId, error: `Falha ao reservar vídeo: ${reserveError.message}` };
    }
    if (!reserved) {
      return {
        ok: true,
        alreadyStarted: true,
        videoId,
        jobId: null,
        message: "Outro processamento já foi iniciado para este vídeo.",
      };
    }

    const releaseReservation = async (lastError: string | null) => {
      await supabase
        .from("videos")
        .update({ processing_started_at: null, last_error: lastError })
        .eq("id", videoId)
        .eq("user_id", userId)
        .is("processing_job_id", null);
    };

    try {
      const { data: arquivo, error: arquivoError } = await supabase
        .from("arquivos")
        .select("id, storage_path, status")
        .eq("id", video.arquivo_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (arquivoError) throw new Error(`Falha ao buscar arquivo: ${arquivoError.message}`);
      if (!arquivo?.storage_path) throw new Error("Arquivo sem caminho de armazenamento (storage_path).");

      const { data: signed, error: signedError } = await supabase.storage
        .from("raw-videos")
        .createSignedUrl(arquivo.storage_path, SIGNED_URL_TTL_SECONDS);

      if (signedError || !signed?.signedUrl) {
        throw new Error(`Falha ao gerar URL temporária: ${signedError?.message ?? "desconhecida"}`);
      }

      const { cloudConvertRequest } = await import("@/lib/cloudconvert.server");
      const job = await cloudConvertRequest<CloudConvertJobResponse>("/jobs", {
        method: "POST",
        body: JSON.stringify({
          tag: videoId,
          tasks: {
            "import-video": { operation: "import/url", url: signed.signedUrl },
            "convert-video": {
              operation: "convert",
              input: "import-video",
              output_format: "mp4",
            },
            "export-video": { operation: "export/url", input: "convert-video" },
          },
        }),
      });

      const jobId = job?.data?.id;
      if (!jobId) throw new Error("CloudConvert não retornou um ID de job válido.");

      const { error: updateError } = await supabase
        .from("videos")
        .update({
          status: "PROCESSANDO",
          processing_started_at: new Date().toISOString(),
          processing_finished_at: null,
          processing_attempts: video.processing_attempts + 1,
          processing_job_id: jobId,
          last_error: null,
        })
        .eq("id", videoId)
        .eq("user_id", userId);

      if (updateError) {
        throw new Error(`Job criado, mas falha ao atualizar o vídeo: ${updateError.message}`);
      }

      return { ok: true, alreadyStarted: false, videoId, jobId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await releaseReservation(message);
      return { ok: false, videoId, error: message };
    }
  });
