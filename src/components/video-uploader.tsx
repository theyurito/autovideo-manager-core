import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CloudUpload, Film, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, Loader } from "@/components/states";
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
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  createVideoEntry,
  DuplicateFileError,
  type DuplicateInfo,
  isVideoFile,
  processVideoFile,
} from "@/lib/video-upload";

type ItemStatus = "queued" | "hashing" | "checking" | "uploading" | "saving" | "done" | "duplicate" | "error";

type QueueItem = {
  id: string;
  name: string;
  size: number;
  status: ItemStatus;
  progress: number;
  message?: string;
};

const STAGE_LABEL: Record<ItemStatus, string> = {
  queued: "Na fila",
  hashing: "Calculando SHA-256...",
  checking: "Verificando duplicidade...",
  uploading: "Enviando...",
  saving: "Registrando...",
  done: "Enviado",
  duplicate: "Duplicado",
  error: "Erro",
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VideoUploader() {
  const { userId, accessToken } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const runningRef = useRef(false);

  const update = useCallback((id: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const confirmNewEntry = useCallback(async () => {
    if (!duplicate || !userId) return;
    setCreating(true);
    try {
      await createVideoEntry({
        arquivoId: duplicate.arquivoId,
        userId,
        filename: duplicate.newFilename,
        storagePath: duplicate.storagePath,
        hash: duplicate.hash,
      });
      toast.success("Nova entrada criada", { description: duplicate.newFilename });
      await queryClient.invalidateQueries({ queryKey: ["videos", userId] });
      setDuplicate(null);
    } catch (error) {
      toast.error("Falha ao criar entrada", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setCreating(false);
    }
  }, [duplicate, queryClient, userId]);

  const mutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!userId || !accessToken) throw new Error("Sessão expirada. Entre novamente.");

      const pending = files.map((file) => ({
        file,
        item: {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name,
          size: file.size,
          status: "queued" as ItemStatus,
          progress: 0,
        },
      }));
      setItems((prev) => [...pending.map((p) => p.item), ...prev]);

      // Processamento sequencial (um arquivo por vez) para evitar sobrecarga.
      for (const { file, item } of pending) {
        try {
          await processVideoFile({
            file,
            userId,
            accessToken,
            onStage: (stage) => update(item.id, { status: stage }),
            onProgress: (progress) => update(item.id, { progress }),
          });
          update(item.id, { status: "done", progress: 100 });
          toast.success("Vídeo enviado", { description: file.name });
          await queryClient.invalidateQueries({ queryKey: ["videos", userId] });
        } catch (error) {
          if (error instanceof DuplicateFileError) {
            update(item.id, {
              status: "duplicate",
              message: "Arquivo já existe (mesmo SHA-256). Nenhum upload foi feito.",
            });
            setDuplicate(error.info);
          } else {
            const message = error instanceof Error ? error.message : "Erro desconhecido";
            update(item.id, { status: "error", message });
            toast.error("Falha no envio", { description: `${file.name}: ${message}` });
          }
        }
      }
    },
  });


  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      const videos = files.filter(isVideoFile);
      const rejected = files.length - videos.length;
      if (rejected > 0) {
        toast.error("Arquivo ignorado", {
          description: `${rejected} arquivo(s) não são vídeos e foram descartados.`,
        });
      }
      if (videos.length === 0) return;
      if (runningRef.current) {
        toast.info("Aguarde", { description: "Há um envio em andamento." });
        return;
      }
      runningRef.current = true;
      mutation.mutate(videos, { onSettled: () => (runningRef.current = false) });
    },
    [mutation],
  );

  const busy = mutation.isPending;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Enviar vídeos</CardTitle>
        <Badge variant="secondary">SHA-256 · anti-duplicidade</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          aria-label="Selecionar vídeos para upload"
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-12 text-center transition-colors",
            dragging && "border-primary bg-primary/5",
            busy && "cursor-not-allowed opacity-70",
          )}
        >
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CloudUpload className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold">Arraste vídeos aqui</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Ou clique para selecionar. O arquivo é enviado no formato original, sem conversão.
          </p>
          <Button variant="outline" className="mt-5" disabled={busy} type="button">
            <UploadCloud /> Selecionar vídeos
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-border/60 bg-card/60 p-3">
                <div className="flex items-center gap-2">
                  {item.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : item.status === "error" || item.status === "duplicate" ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{formatSize(item.size)}</span>
                  <Badge
                    variant={
                      item.status === "done"
                        ? "default"
                        : item.status === "error" || item.status === "duplicate"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {STAGE_LABEL[item.status]}
                  </Badge>
                </div>
                {item.status === "uploading" ? (
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={item.progress} className="h-1.5" />
                    <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                      {item.progress}%
                    </span>
                  </div>
                ) : null}
                {item.message ? (
                  <p className="mt-2 text-xs text-destructive">{item.message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <Dialog open={!!duplicate} onOpenChange={(open) => !open && setDuplicate(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Arquivo já existe</DialogTitle>
              <DialogDescription>
                O conteúdo de <strong>{duplicate?.newFilename}</strong> tem o mesmo SHA-256 de{" "}
                <strong>{duplicate?.filename}</strong>, já armazenado ({duplicate?.existingEntries}{" "}
                entrada(s) na fila). Nenhum upload novo foi feito. Você pode criar uma nova entrada
                operacional reutilizando o mesmo arquivo.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDuplicate(null)} disabled={creating}>
                Cancelar
              </Button>
              <Button onClick={confirmNewEntry} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Criar nova entrada
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}


export function VideoQueue() {
  const { userId } = useAuth();

  const query = useQuery({
    queryKey: ["videos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, filename, status, original_path, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Fila de vídeos</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Loader label="Carregando fila..." />
        ) : query.isError ? (
          <ErrorState
            description="Não foi possível carregar a fila de vídeos."
            onRetry={() => query.refetch()}
          />
        ) : !query.data || query.data.length === 0 ? (
          <EmptyState
            icon={<Film className="h-5 w-5" />}
            title="Nenhum vídeo enviado"
            description="Envie um vídeo acima para vê-lo aparecer aqui com status PENDENTE."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {query.data.map((video) => (
              <li key={video.id} className="flex items-center gap-3 py-3">
                <Film className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{video.filename}</p>
                  <p className="truncate text-xs text-muted-foreground">{video.original_path}</p>
                </div>
                <Badge variant="secondary">{video.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
