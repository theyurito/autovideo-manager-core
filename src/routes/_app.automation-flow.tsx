import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play, Workflow } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, Loader } from "@/components/states";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_app/automation-flow")({
  head: () => ({
    meta: [
      { title: "Automation Flow · AutoVideo Manager" },
      {
        name: "description",
        content: "Monte e acompanhe os fluxos de automação de geração de vídeos.",
      },
      { property: "og:title", content: "Automation Flow · AutoVideo Manager" },
      { property: "og:description", content: "Fluxos de automação de geração de vídeos." },
    ],
  }),
  component: AutomationFlowPage,
});

const steps = ["Entrada de dados", "Montagem", "Renderização", "Publicação"];

function AutomationFlowPage() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  function simulateRun() {
    setRunning(true);
    setDone(false);
    setTimeout(() => {
      setRunning(false);
      setDone(true);
      toast.success("Simulação concluída", { description: "Nenhum vídeo real foi processado." });
    }, 1400);
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title="Automation Flow"
        description="Estrutura inicial do editor de fluxos. Execução real ainda não implementada."
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">
                <Button variant="neon" onClick={simulateRun} disabled={running}>
                  <Play /> {running ? "Simulando..." : "Simular fluxo"}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Executa apenas uma simulação visual</TooltipContent>
          </Tooltip>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {steps.map((step, i) => (
          <Card key={step} className={done ? "border-success/40" : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {i + 1}. {step}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={done ? "default" : "secondary"}>
                {running ? "processando" : done ? "concluído" : "inativo"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fluxos salvos</CardTitle>
        </CardHeader>
        <CardContent>
          {running ? (
            <Loader label="Executando simulação do fluxo..." />
          ) : (
            <EmptyState
              icon={<Workflow className="h-5 w-5" />}
              title="Nenhum fluxo configurado"
              description="Os fluxos de automação poderão ser criados na próxima etapa."
              action={
                <Button variant="outline" onClick={simulateRun}>
                  <Play /> Rodar simulação
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
