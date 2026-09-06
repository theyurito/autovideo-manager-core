import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CloudConvertHealthResult =
  | { ok: true; configured: true; authenticated: true }
  | { ok: false; configured: boolean; authenticated: boolean; error: string };

export const checkCloudConvertConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<CloudConvertHealthResult> => {
    const apiKey = process.env["CLOUDCONVERT_API_KEY"];
    if (!apiKey) {
      return {
        ok: false,
        configured: false,
        authenticated: false,
        error: "CLOUDCONVERT_API_KEY não configurada no ambiente server-side.",
      };
    }

    try {
      const { cloudConvertRequest } = await import("@/lib/cloudconvert.server");
      await cloudConvertRequest("tasks?limit=1");
      return { ok: true, configured: true, authenticated: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isAuthError = message.includes("401") || message.includes("Unauthorized");
      return {
        ok: false,
        configured: true,
        authenticated: !isAuthError,
        error: message,
      };
    }
  });
