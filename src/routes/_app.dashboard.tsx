import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Film, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, Loader } from "@/components/states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · AutoVideo Manager" },
      {
        name: "description",
        content: "Visão geral das automações e lotes de vídeo do AutoVideo Manager.",
      },
      { property: "og:title", content: "Dashboard · AutoVideo Manager" },
      { property: "og:description", content: "Visão geral das automações e lotes de vídeo." },
    ],
  }),
  component: DashboardPage,
});

type View = "empty" | "loading" | "error";

function DashboardPage() {
  const [view, setView] = useState<View>("empty");
  const [open, setOpen] = useState(false);

  function simulateRefresh() {
    setView("loading");
    setTimeout(() => {
      setView("empty");
      toast.success("Painel atualizado", { description: "Nenhum lote em execução." });
    }, 1000);
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title="Dashboard"
        description="Estrutura inicial. As métricas de produção serão conectadas em uma próxima etapa."
        actions={
          <>
            <Button variant="outline" onClick={simulateRefresh} disabled={view === "loading"}>
              <RefreshCw className={view === "loading" ? "animate-spin" : ""} /> Atualizar
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="neon">
                  <Plus /> Novo lote
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo lote de vídeos</DialogTitle>
                  <DialogDescription>
                    A criação de lotes ainda não está disponível nesta etapa da fundação visual.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    Fechar
                  </Button>
                  <Button
                    variant="neon"
                    onClick={() => {
                      setOpen(false);
                      toast.info("Em breve", { description: "Fluxo de criação na próxima etapa." });
                    }}
                  >
                    Entendi
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["Lotes ativos", "Vídeos gerados", "Templates", "Falhas"].map((label) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <span className="font-display text-3xl font-semibold">0</span>
              <Badge variant="secondary">sem dados</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <VideoUploader />

      <VideoQueue />

    </div>
  );
}
