/**
 * Worker configuration. Server-side only.
 * Values come exclusively from environment variables (never hardcoded,
 * never prefixed with VITE_, never shipped to the frontend).
 *
 * Load with: bun --env-file=.env.worker run worker/<script>.ts
 */

export interface WorkerConfig {
  supabaseUrl: string;
  supabaseSecretKey: string;
  workerUserId: string;
  maxAttempts: number;
  staleMinutes: number;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Variavel de ambiente invalida: ${name} deve ser um inteiro positivo.`);
  }
  return parsed;
}

export function loadConfig(): WorkerConfig {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseSecretKey = process.env['SUPABASE_SECRET_KEY'];
  const workerUserId = process.env['WORKER_USER_ID'];

  const missing = [
    ...(!supabaseUrl ? ['SUPABASE_URL'] : []),
    ...(!supabaseSecretKey ? ['SUPABASE_SECRET_KEY'] : []),
    ...(!workerUserId ? ['WORKER_USER_ID'] : []),
  ];

  if (missing.length > 0) {
    throw new Error(
      `Variaveis de ambiente obrigatorias ausentes: ${missing.join(', ')}. ` +
        'Copie .env.worker.example para .env.worker e preencha os valores.',
    );
  }

  return {
    supabaseUrl: supabaseUrl!,
    supabaseSecretKey: supabaseSecretKey!,
    workerUserId: workerUserId!,
    maxAttempts: readInt('WORKER_MAX_ATTEMPTS', 3),
    staleMinutes: readInt('WORKER_STALE_MINUTES', 15),
  };
}

/** Safe view of the config for logging: never includes the secret key. */
export function redactConfig(config: WorkerConfig) {
  return {
    supabaseUrl: config.supabaseUrl,
    supabaseSecretKey: '***redacted***',
    workerUserId: config.workerUserId,
    maxAttempts: config.maxAttempts,
    staleMinutes: config.staleMinutes,
  };
}
