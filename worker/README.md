# AutoVideo Worker (Fase 5B — fundação)

Worker Bun/TypeScript isolado do frontend. Nesta fase é apenas fundação:
sem FFmpeg, sem download, sem upload, sem daemon/polling.

## Configuração

```bash
cp .env.worker.example .env.worker
# preencha SUPABASE_URL, SUPABASE_SECRET_KEY (credencial server-side) e WORKER_USER_ID
```

`.env.worker` e `.env.worker.local` são ignorados pelo git. Nunca use prefixo `VITE_`.

## Comandos

```bash
bun run worker:health     # read-only: valida config, conexão e tabelas
bun run worker:dry        # read-only: mostra o próximo job PENDENTE elegível
bun run worker:typecheck  # typecheck isolado do worker
```

## RPCs disponíveis (mutáveis, ainda não executadas)

- `claim_next_video_for_processing(p_user_id, p_max_attempts)` — claim atômico
  (`FOR UPDATE SKIP LOCKED`, `LIMIT 1`, `created_at ASC`).
- `recover_stale_video_processing(p_user_id, p_stale_minutes, p_max_attempts)` —
  devolve jobs travados para `PENDENTE` ou marca `COM_ERRO` ao esgotar tentativas.

Ambas são `SECURITY DEFINER` com `search_path` fixo e executáveis somente por `service_role`.
