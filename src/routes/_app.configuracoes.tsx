import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMockAuth } from "@/lib/mock-auth";

export const Route = createFileRoute("/_app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · AutoVideo Manager" },
      {
        name: "description",
        content: "Preferências visuais e ajustes gerais do AutoVideo Manager.",
      },
      { property: "og:title", content: "Configurações · AutoVideo Manager" },
      { property: "og:description", content: "Preferências e ajustes gerais do painel." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { email } = useMockAuth();
  const { theme, toggle } = useTheme();
  const [workspace, setWorkspace] = useState("AutoVideo Studio");
  const [quality, setQuality] = useState("1080p");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  function save() {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Preferências salvas", { description: "Apenas em memória nesta etapa." });
    }, 900);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <PageHeader
        title="Configurações"
        description="Preferências visuais desta sessão. Nada é persistido nesta etapa."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
          <CardDescription>Identificação do ambiente de trabalho.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ws">Nome do workspace</Label>
            <Input id="ws" value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc">Conta</Label>
            <Input id="acc" value={email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Qualidade padrão de render</Label>
            <Select value={quality} onValueChange={setQuality}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720p">720p</SelectItem>
                <SelectItem value="1080p">1080p</SelectItem>
                <SelectItem value="4k">4K</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aparência e alertas</CardTitle>
          <CardDescription>Ajustes aplicados imediatamente na interface.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Modo escuro neon</p>
              <p className="text-sm text-muted-foreground">Alterna entre tema escuro e claro.</p>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggle} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Notificações de lote</p>
              <p className="text-sm text-muted-foreground">Exibir avisos ao concluir execuções.</p>
            </div>
            <Switch
              checked={notify}
              onCheckedChange={(v) => {
                setNotify(v);
                toast.success(v ? "Notificações ativadas" : "Notificações desativadas");
              }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="neon" onClick={save} disabled={saving || workspace.trim().length === 0}>
          {saving ? (
            <>
              <Loader2 className="animate-spin" /> Salvando...
            </>
          ) : (
            <>
              <Save /> Salvar preferências
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
