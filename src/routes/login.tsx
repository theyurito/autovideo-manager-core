import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Loader2,
  Mail,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { AUTHORIZED_EMAIL } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar · AutoVideo Manager" },
      {
        name: "description",
        content:
          "Acesse o AutoVideo Manager com verificação por código enviado ao seu email autorizado.",
      },
      { property: "og:title", content: "Entrar · AutoVideo Manager" },
      {
        property: "og:description",
        content: "Painel privado de automação e geração de vídeos em lote.",
      },
    ],
  }),
  component: LoginPage,
});

type Step = "email" | "otp" | "granted" | "denied";

function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (step !== "granted") return;
    const t = setTimeout(() => navigate({ to: "/dashboard" }), 1100);
    return () => clearTimeout(t);
  }, [step, navigate]);

  // Se o acesso for concluído pelo link do email, a sessão chega por aqui.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setStep("granted");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStep("granted");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSendCode() {
    setError(null);
    setSending(true);
    const normalized = email.trim().toLowerCase();

    if (normalized !== AUTHORIZED_EMAIL) {
      setSending(false);
      setStep("denied");
      setError("Este email não está autorizado a acessar o sistema.");
      toast.error("Acesso negado", { description: "Email não autorizado." });
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    setSending(false);

    if (otpError) {
      setError(otpError.message);
      toast.error("Não foi possível enviar o código", { description: otpError.message });
      return;
    }

    setStep("otp");
    toast.success("Email enviado", {
      description: "Clique no link do email ou digite o código, se houver.",
    });
  }


  async function handleVerify() {
    setError(null);
    setVerifying(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: "email",
    });
    setVerifying(false);

    if (verifyError) {
      setError("Código inválido ou expirado. Tente novamente.");
      toast.error("Código inválido", { description: "Verifique os 6 dígitos." });
      return;
    }

    setStep("granted");
    toast.success("Acesso autorizado", { description: "Redirecionando para o painel..." });
  }

  function resetFlow() {
    setStep("email");
    setCode("");
    setError(null);
  }

  return (
    <main className="grid-backdrop flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground surface-glow">
            <Clapperboard className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-semibold">
            AutoVideo <span className="text-gradient-neon">Manager</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automação e geração de vídeos em lote — acesso privado.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-8">
          {step === "granted" ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <h2 className="mt-4 text-lg font-semibold">Acesso autorizado</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Entrando no painel como {email.trim().toLowerCase()}...
              </p>
              <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : step === "denied" ? (
            <div className="flex flex-col items-center py-6 text-center">
              <ShieldX className="h-10 w-10 text-destructive" />
              <h2 className="mt-4 text-lg font-semibold">Acesso negado</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {error ?? "Email não autorizado."}
              </p>
              <Button variant="outline" className="mt-6" onClick={resetFlow}>
                Usar outro email
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@email.com"
                    className="pl-9"
                    value={email}
                    disabled={step === "otp" || sending}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && emailValid && step === "email") handleSendCode();
                    }}
                  />
                </div>
              </div>

              {step === "email" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block">
                      <Button
                        variant="neon"
                        className="w-full"
                        disabled={!emailValid || sending}
                        onClick={handleSendCode}
                      >
                        {sending ? (
                          <>
                            <Loader2 className="animate-spin" /> Enviando código...
                          </>
                        ) : (
                          <>
                            Enviar código <ArrowRight />
                          </>
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {emailValid ? "Enviar código de verificação" : "Informe um email válido"}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-foreground">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    Email enviado. Clique em "Verify Email" na mensagem para entrar.
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="otp">Código de verificação</Label>
                    <InputOTP
                      id="otp"
                      maxLength={6}
                      value={code}
                      onChange={setCode}
                      disabled={verifying}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Se o email trouxer um código de 6 dígitos, digite-o aqui</span>
                      <Badge variant="secondary">válido por alguns minutos</Badge>
                    </div>
                    {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="neon"
                      className="flex-1"
                      disabled={code.length !== 6 || verifying}
                      onClick={handleVerify}
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="animate-spin" /> Verificando...
                        </>
                      ) : (
                        "Verificar código"
                      )}
                    </Button>
                    <Button variant="ghost" onClick={resetFlow} disabled={verifying}>
                      Voltar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Acesso restrito. O código de verificação é enviado apenas ao email autorizado.
        </p>
      </div>
    </main>
  );
}
