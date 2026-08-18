import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

export type VideoStatus = Database["public"]["Enums"]["video_status"];

export type VideoRow = {
  id: string;
  filename: string;
  status: VideoStatus;
  original_path: string | null;
  created_at: string;
};

export const STATUS_LABEL: Record<VideoStatus, string> = {
  PENDENTE: "Pendente",
  PROCESSANDO: "Processando",
  PRONTO: "Pronto",
  AGENDADO: "Agendado",
  PUBLICANDO: "Publicando",
  PUBLICADO: "Publicado",
  COM_ERRO: "Com Erro",
};

/** Classes de estilo por status (tokens semânticos do design da Fase 1). */
export const STATUS_CLASS: Record<VideoStatus, string> = {
  PENDENTE: "border-border/70 bg-muted text-muted-foreground",
  PROCESSANDO: "border-primary/40 bg-primary/10 text-primary",
  PRONTO: "border-success/40 bg-success/10 text-success",
  AGENDADO: "border-accent/40 bg-accent/10 text-accent-foreground",
  PUBLICANDO: "border-primary/40 bg-primary/10 text-primary",
  PUBLICADO: "border-success/50 bg-success/15 text-success",
  COM_ERRO: "border-destructive/40 bg-destructive/10 text-destructive",
};

/**
 * Fila real: consulta a tabela `videos` do usuário autenticado (RLS por auth.uid())
 * e mantém o cache sincronizado via Supabase Realtime. O banco é a fonte da verdade.
 */
export function useVideos() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["videos", userId],
    enabled: !!userId,
    queryFn: async (): Promise<VideoRow[]> => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, filename, status, original_path, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`videos-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "videos", filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["videos", userId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}
