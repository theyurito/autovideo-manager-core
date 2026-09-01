/** Minimal structured logger for the worker. Never logs secrets. */

type Level = 'info' | 'warn' | 'error';

const SENSITIVE = /(secret|key|token|authorization|apikey|password)/i;

function sanitize(data: Record<string, unknown> | undefined) {
  if (!data) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = SENSITIVE.test(key) ? '***redacted***' : value;
  }
  return out;
}

function emit(level: Level, event: string, data?: Record<string, unknown>) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(sanitize(data) ?? {}),
  };
  const text = JSON.stringify(line);
  if (level === 'error') console.error(text);
  else if (level === 'warn') console.warn(text);
  else console.log(text);
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => emit('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => emit('error', event, data),
};
