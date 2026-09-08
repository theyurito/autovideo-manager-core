import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReconcileResult =
  | { ok: true; outcome: "READY"; message: string }
  | { ok: true; outcome: "FAILED"; message: string }
  | { ok: true; outcome: "PENDING"; message: string }
  | { ok: false; message: string };

export const reconcileVideoProcessing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { videoId: string }) => {
    if (!input || typeof input.videoId !== "string" || input.videoId.length < 10) {
      throw new Error("videoId inválido.");
    }
    return { videoId: input.videoId };
  })
  .handler(async ({ data, context }): Promise<ReconcileResult> => {
    const { supabase, userId } = context;

    const { data: video, error } = await supabase
      .from("videos")
      .select("id, processing_job_id, status")
      .eq("id", data.videoId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return { ok: false, message: `Falha ao buscar vídeo: ${error.message}` };
    if (!video) return { ok: false, message: "Vídeo não encontrado para o usuário autenticado." };
    if (!video.processing_job_id) {
      return { ok: false, message: "Este vídeo não possui processamento iniciado." };
    }

    const { finalizeCloudConvertJob } = await import("@/lib/cloudconvert-finalize.server");
    const result = await finalizeCloudConvertJob(video.processing_job_id);

    if (!result.ok) return { ok: false, message: result.message };

    if (result.outcome === "READY") {
      return {
        ok: true,
        outcome: "READY",
        message: `Vídeo pronto. Arquivo: ${result.processedPath}${result.alreadyDone ? " (já finalizado)" : ""}`,
      };
    }
    if (result.outcome === "FAILED") {
      return { ok: true, outcome: "FAILED", message: `Job falhou: ${result.message}` };
    }
    return { ok: true, outcome: "PENDING", message: result.message };
  });
