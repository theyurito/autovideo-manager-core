import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

const SIGNATURE_HEADER = "CloudConvert-Signature";

function isValidSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(signature.trim(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/webhooks/cloudconvert")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["CLOUDCONVERT_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("[cloudconvert-webhook] CLOUDCONVERT_WEBHOOK_SECRET ausente.");
          return new Response("Webhook não configurado no servidor.", { status: 500 });
        }

        const signature = request.headers.get(SIGNATURE_HEADER);
        if (!signature) return new Response("Assinatura ausente.", { status: 401 });

        // RAW body: nunca reserializar antes de validar
        const rawBody = await request.text();
        if (!isValidSignature(rawBody, signature, secret)) {
          return new Response("Assinatura inválida.", { status: 403 });
        }

        let payload: { event?: string; job?: { id?: string } };
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Payload inválido.", { status: 400 });
        }

        const event = payload?.event;
        if (event !== "job.finished" && event !== "job.failed") {
          return Response.json({ ignored: true });
        }

        const jobId = payload?.job?.id;
        if (!jobId || typeof jobId !== "string") {
          return new Response("Job ID ausente no payload.", { status: 400 });
        }

        try {
          const { finalizeCloudConvertJob } = await import("@/lib/cloudconvert-finalize.server");
          const result = await finalizeCloudConvertJob(jobId);

          if (!result.ok && result.outcome === "NOT_FOUND") {
            console.error("[cloudconvert-webhook] job sem vídeo correspondente");
            return Response.json({ handled: false, reason: "unknown_job" });
          }
          if (!result.ok) {
            console.error(`[cloudconvert-webhook] falha: ${result.message}`);
            return new Response("Falha ao finalizar job.", { status: 500 });
          }

          return Response.json({ handled: true, outcome: result.outcome });
        } catch (err) {
          console.error("[cloudconvert-webhook] erro inesperado", err);
          return new Response("Erro interno.", { status: 500 });
        }
      },
    },
  },
});
