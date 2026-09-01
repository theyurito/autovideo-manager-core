/**
 * READ-ONLY dry-run: shows which job WOULD be claimed.
 * No claim, no recovery, no download, no temp files, no upload, no mutation.
 */
import { createWorkerContext } from './supabase.ts';
import { redactConfig } from './config.ts';
import { peekNextPendingVideo, getRawStoragePath } from './jobs.ts';
import { logger } from './logger.ts';

async function main() {
  const { config, supabase } = createWorkerContext();
  logger.info('worker.dry_run.start', redactConfig(config));

  const candidate = await peekNextPendingVideo(supabase, config);

  if (!candidate) {
    logger.info('worker.dry_run.no_job', { userId: config.workerUserId });
    console.log('DRY-RUN: nenhum job PENDENTE elegivel.');
    return;
  }

  const storagePath = await getRawStoragePath(supabase, candidate.arquivo_id);

  logger.info('worker.dry_run.candidate', {
    videoId: candidate.id,
    filename: candidate.filename,
    status: candidate.status,
    attempts: candidate.processing_attempts,
    maxAttempts: config.maxAttempts,
    createdAt: candidate.created_at,
    rawStoragePath: storagePath,
  });

  console.log('DRY-RUN: candidato identificado. Nenhuma alteracao foi feita.');
}

main().catch((err: unknown) => {
  logger.error('worker.dry_run.failed', { message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
