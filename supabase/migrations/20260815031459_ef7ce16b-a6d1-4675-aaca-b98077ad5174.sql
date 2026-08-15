CREATE TYPE public.video_status AS ENUM ('Pendente','Processando','Pronto','Agendado','Publicando','Publicado','Com Erro');

CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  hash TEXT NOT NULL,
  status public.video_status NOT NULL DEFAULT 'Pendente',
  original_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT videos_user_hash_unique UNIQUE (user_id, hash)
);

CREATE TABLE public.logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_videos_user_id ON public.videos(user_id);
CREATE INDEX idx_videos_status ON public.videos(status);
CREATE INDEX idx_videos_created_at ON public.videos(created_at);
CREATE INDEX idx_logs_video_id ON public.logs(video_id);
CREATE INDEX idx_logs_user_id ON public.logs(user_id);
CREATE INDEX idx_agendamentos_video_id ON public.agendamentos(video_id);
CREATE INDEX idx_agendamentos_user_id ON public.agendamentos(user_id);
CREATE INDEX idx_agendamentos_scheduled_at ON public.agendamentos(scheduled_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logs TO authenticated;
GRANT ALL ON public.logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "videos_select_own" ON public.videos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "videos_insert_own" ON public.videos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "videos_update_own" ON public.videos FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "videos_delete_own" ON public.videos FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "logs_select_own" ON public.logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "logs_insert_own" ON public.logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "logs_update_own" ON public.logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "logs_delete_own" ON public.logs FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "agendamentos_select_own" ON public.agendamentos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "agendamentos_insert_own" ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "agendamentos_update_own" ON public.agendamentos FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "agendamentos_delete_own" ON public.agendamentos FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "raw_videos_select_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'raw-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "raw_videos_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'raw-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "raw_videos_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'raw-videos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'raw-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "raw_videos_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'raw-videos' AND (storage.foldername(name))[1] = auth.uid()::text);