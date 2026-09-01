/** READ-ONLY healthcheck: config + connectivity + table reachability. */
import { createWorkerContext } from './supabase.ts';
import { redactConfig } from './config.ts';
import { logger } from './logger.ts';

async function main() {
  const { config, supabase } = createWorkerContext();
  logger.info('worker.health.start', redactConfig(config));

  const tables = ['videos', 'arquivos', 'logs', 'agendamentos'] as const;
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', config.workerUserId);
    if (error) throw new Error(`Tabela "${table}" inacessivel: ${error.message}`);
    logger.info('worker.health.table_ok', { table });
  }

  console.log('WORKER HEALTH: OK');
}

main().catch((err: unknown) => {
  logger.error('worker.health.failed', { message: err instanceof Error ? err.message : String(err) });
  console.error('WORKER HEALTH: FALHOU');
  process.exit(1);
});
