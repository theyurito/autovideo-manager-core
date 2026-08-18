-- 9a. Padronizar enum video_status (idempotente)
DO $$
DECLARE m text[][] := ARRAY[['Pendente','PENDENTE'],['Processando','PROCESSANDO'],['Pronto','PRONTO'],['Agendado','AGENDADO'],['Publicando','PUBLICANDO'],['Publicado','PUBLICADO'],['Com Erro','COM_ERRO']];
        i int;
BEGIN
  FOR i IN 1..array_length(m,1) LOOP
    IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='video_status' AND e.enumlabel=m[i][1]) THEN
      EXECUTE format('ALTER TYPE public.video_status RENAME VALUE %L TO %L', m[i][1], m[i][2]);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.videos ALTER COLUMN status SET DEFAULT 'PENDENTE'::public.video_status;

-- agendamentos.status (texto) padronizado
UPDATE public.agendamentos SET status = upper(translate(status, 'áéíóúâêôãõç ', 'aeiouaeoaoc_'));
ALTER TABLE public.agendamentos ALTER COLUMN status SET DEFAULT 'PENDENTE';

-- 1. Tabela arquivos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='arquivo_status') THEN
    CREATE TYPE public.arquivo_status AS ENUM ('PENDENTE_UPLOAD','UPLOAD_CONFIRMADO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hash_sha256 text NOT NULL,
  filename text NOT NULL,
  storage_path text,
  size_bytes bigint,
  status public.arquivo_status NOT NULL DEFAULT 'PENDENTE_UPLOAD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS arquivos_hash_sha256_key ON public.arquivos (hash_sha256);
CREATE INDEX IF NOT EXISTS arquivos_user_id_idx ON public.arquivos (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.arquivos TO authenticated;
GRANT ALL ON public.arquivos TO service_role;

ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS arquivos_select_own ON public.arquivos;
CREATE POLICY arquivos_select_own ON public.arquivos FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS arquivos_insert_own ON public.arquivos;
CREATE POLICY arquivos_insert_own ON public.arquivos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS arquivos_update_own ON public.arquivos;
CREATE POLICY arquivos_update_own ON public.arquivos FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS arquivos_delete_own ON public.arquivos;
CREATE POLICY arquivos_delete_own ON public.arquivos FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS update_arquivos_updated_at ON public.arquivos;
CREATE TRIGGER update_arquivos_updated_at BEFORE UPDATE ON public.arquivos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Backfill videos -> arquivos (não apaga nada)
INSERT INTO public.arquivos (user_id, hash_sha256, filename, storage_path, status, created_at)
SELECT DISTINCT ON (v.hash) v.user_id, v.hash, v.filename, v.original_path,
       CASE WHEN v.original_path IS NOT NULL THEN 'UPLOAD_CONFIRMADO' ELSE 'PENDENTE_UPLOAD' END::public.arquivo_status,
       v.created_at
FROM public.videos v
WHERE v.hash IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.arquivos a WHERE a.hash_sha256 = v.hash)
ORDER BY v.hash, v.created_at ASC;

-- 3. videos.arquivo_id
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS arquivo_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='videos_arquivo_id_fkey') THEN
    ALTER TABLE public.videos ADD CONSTRAINT videos_arquivo_id_fkey
      FOREIGN KEY (arquivo_id) REFERENCES public.arquivos(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS videos_arquivo_id_idx ON public.videos (arquivo_id);

-- 4. Preencher arquivo_id
UPDATE public.videos v
SET arquivo_id = a.id
FROM public.arquivos a
WHERE v.arquivo_id IS NULL AND a.hash_sha256 = v.hash;

-- 5. Validar
DO $$
DECLARE orfaos int;
BEGIN
  SELECT count(*) INTO orfaos FROM public.videos WHERE arquivo_id IS NULL;
  IF orfaos > 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % video(s) sem arquivo_id', orfaos;
  END IF;
END $$;

-- 6. Remover UNIQUE(user_id, hash)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='videos_user_id_hash_key') THEN
    ALTER TABLE public.videos DROP CONSTRAINT videos_user_id_hash_key;
  END IF;
END $$;

-- 7. Aposentar (não remover) colunas legadas
ALTER TABLE public.videos ALTER COLUMN hash DROP NOT NULL;
COMMENT ON COLUMN public.videos.hash IS 'LEGADO: substituído por arquivos.hash_sha256. Remover em limpeza futura.';
COMMENT ON COLUMN public.videos.original_path IS 'LEGADO: substituído por arquivos.storage_path. Remover em limpeza futura.';

-- 8. arquivo_id NOT NULL
ALTER TABLE public.videos ALTER COLUMN arquivo_id SET NOT NULL;