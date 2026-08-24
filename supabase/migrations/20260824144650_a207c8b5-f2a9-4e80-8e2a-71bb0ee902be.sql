ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS processed_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS processing_finished_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS processing_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT NULL;

ALTER TABLE public.videos
  ADD CONSTRAINT videos_processing_attempts_non_negative CHECK (processing_attempts >= 0);

CREATE POLICY "ready_videos_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ready-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ready_videos_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ready-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ready_videos_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ready-videos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'ready-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ready_videos_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ready-videos' AND (storage.foldername(name))[1] = auth.uid()::text);