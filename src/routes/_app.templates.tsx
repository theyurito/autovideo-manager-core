import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutTemplate, Plus } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, Loader } from "@/components/states";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export const Route = createFileRoute("/_app/templates")({
  head: () => ({
    meta: [
      { title: "Templates · AutoVideo Manager" },
      {
        name: "description",
        content: "Biblioteca de templates de vídeo para automações em lote.",
      },
      { property: "og:title", content: "Templates · AutoVideo Manager" },
      { property: "og:description", content: "Biblioteca de templates de vídeo em lote." },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const [filter, setFilter] = useState("todos");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  function applyFilter(value: string) {
    setFilter(value);
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Filtro aplicado", { description: `Categoria: ${value}` });
    }, 700);
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title="Templates"
        description="Estrutura inicial da biblioteca de templates. Sem dados reais nesta etapa."
        actions={
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
              <Button variant="neon">
                <Plus /> Novo template
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Novo template</DrawerTitle>
                <DrawerDescription>
                  O editor de templates será implementado na próxima etapa.
                </DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <Button
                  variant="neon"
                  onClick={() => {
                    setOpen(false);
                    toast.info("Em breve", { description: "Editor de templates em construção." });
                  }}
                >
                  Entendi
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        }
      />

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="text-base">Biblioteca</CardTitle>
          <Select value={filter} onValueChange={applyFilter}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as categorias</SelectItem>
              <SelectItem value="shorts">Shorts</SelectItem>
              <SelectItem value="institucional">Institucional</SelectItem>
              <SelectItem value="anuncios">Anúncios</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader label="Filtrando templates..." />
          ) : (
            <EmptyState
              icon={<LayoutTemplate className="h-5 w-5" />}
              title="Nenhum template cadastrado"
              description="Crie um template para padronizar a geração de vídeos em lote."
              action={
                <Button variant="outline" onClick={() => setOpen(true)}>
                  <Plus /> Criar template
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
