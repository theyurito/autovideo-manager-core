/** Typed helpers around the worker's job queries and RPCs. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkerConfig } from './config.ts';
import type { ClaimedJob, PendingCandidate, RecoveredJob } from './types.ts';

/** READ-ONLY: next pending candidate, respecting owner + attempt limit. */
export async function peekNextPendingVideo(
  supabase: SupabaseClient,
  config: WorkerConfig,
): Promise<PendingCandidate | null> {
  const { data, error } = await supabase
    .from('videos')
    .select('id, filename, status, processing_attempts, created_at, arquivo_id')
    .eq('user_id', config.workerUserId)
    .eq('status', 'PENDENTE')
    .lt('processing_attempts', config.maxAttempts)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Falha ao consultar fila: ${error.message}`);
  return (data as PendingCandidate | null) ?? null;
}

/** MUTATING: atomic claim via RPC. Not used by dry-run/health. */
export async function claimNextVideo(
  supabase: SupabaseClient,
  config: WorkerConfig,
): Promise<ClaimedJob | null> {
  const { data, error } = await supabase.rpc('claim_next_video_for_processing', {
    p_user_id: config.workerUserId,
    p_max_attempts: config.maxAttempts,
  });
  if (error) throw new Error(`Falha no claim: ${error.message}`);
  const rows = (data ?? []) as ClaimedJob[];
  return rows[0] ?? null;
}

/** MUTATING: recovers jobs stuck in PROCESSANDO. Not used by dry-run/health. */
export async function recoverStaleVideos(
  supabase: SupabaseClient,
  config: WorkerConfig,
): Promise<RecoveredJob[]> {
  const { data, error } = await supabase.rpc('recover_stale_video_processing', {
    p_user_id: config.workerUserId,
    p_stale_minutes: config.staleMinutes,
    p_max_attempts: config.maxAttempts,
  });
  if (error) throw new Error(`Falha na recuperacao: ${error.message}`);
  return (data ?? []) as RecoveredJob[];
}

/** READ-ONLY: canonical raw-videos path for a claimed job (arquivos.storage_path). */
export async function getRawStoragePath(
  supabase: SupabaseClient,
  arquivoId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('arquivos')
    .select('storage_path, status')
    .eq('id', arquivoId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao localizar arquivo: ${error.message}`);
  return (data?.storage_path as string | undefined) ?? null;
}

/** Optional event log compatible with the existing public.logs schema. */
export async function recordVideoLog(
  supabase: SupabaseClient,
  params: { videoId: string; userId: string; eventType: string; message?: string },
): Promise<void> {
  const { error } = await supabase.from('logs').insert({
    video_id: params.videoId,
    user_id: params.userId,
    event_type: params.eventType,
    message: params.message ?? null,
  });
  if (error) throw new Error(`Falha ao registrar log: ${error.message}`);
}
