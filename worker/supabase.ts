/**
 * Worker-only Supabase client (server-side privileged credential).
 * NEVER import this file from src/ or any frontend code.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig, type WorkerConfig } from './config.ts';

function isOpaqueApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createWorkerFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    // Modern Supabase API keys are opaque strings, not bearer JWTs.
    if (isOpaqueApiKey(apiKey) && headers.get('Authorization') === `Bearer ${apiKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', apiKey);
    return fetch(input, { ...init, headers });
  };
}

export interface WorkerContext {
  config: WorkerConfig;
  supabase: SupabaseClient;
}

export function createWorkerContext(): WorkerContext {
  const config = loadConfig();
  const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    global: { fetch: createWorkerFetch(config.supabaseSecretKey) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return { config, supabase };
}
