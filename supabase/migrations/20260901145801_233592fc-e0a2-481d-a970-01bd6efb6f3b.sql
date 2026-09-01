CREATE OR REPLACE FUNCTION public.claim_next_video_for_processing(
  p_user_id UUID,
  p_max_attempts INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  arquivo_id UUID,
  processing_attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidate AS (
    SELECT v.id
    FROM public.videos v
    WHERE v.user_id = p_user_id
      AND v.status = 'PENDENTE'::public.video_status
      AND v.processing_attempts < p_max_attempts
    ORDER BY v.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.videos v
  SET status = 'PROCESSANDO'::public.video_status,
      processing_started_at = NOW(),
      processing_finished_at = NULL,
      processing_attempts = v.processing_attempts + 1,
      last_error = NULL
  FROM candidate c
  WHERE v.id = c.id
  RETURNING v.id, v.user_id, v.arquivo_id, v.processing_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_video_for_processing(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_video_for_processing(UUID, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.recover_stale_video_processing(
  p_user_id UUID,
  p_stale_minutes INTEGER DEFAULT 15,
  p_max_attempts INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  new_status public.video_status,
  processing_attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH stale AS (
    SELECT v.id
    FROM public.videos v
    WHERE v.user_id = p_user_id
      AND v.status = 'PROCESSANDO'::public.video_status
      AND v.processing_started_at IS NOT NULL
      AND v.processing_started_at < NOW() - (p_stale_minutes || ' minutes')::interval
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.videos v
  SET status = CASE
        WHEN v.processing_attempts >= p_max_attempts THEN 'COM_ERRO'::public.video_status
        ELSE 'PENDENTE'::public.video_status
      END,
      processing_started_at = CASE
        WHEN v.processing_attempts >= p_max_attempts THEN v.processing_started_at
        ELSE NULL
      END,
      processing_finished_at = CASE
        WHEN v.processing_attempts >= p_max_attempts THEN NOW()
        ELSE NULL
      END,
      last_error = CASE
        WHEN v.processing_attempts >= p_max_attempts
          THEN 'Limite de tentativas de processamento excedido (' || v.processing_attempts || '/' || p_max_attempts || ').'
        ELSE 'Processamento recuperado por timeout apos ' || p_stale_minutes || ' minuto(s) sem conclusao.'
      END
  FROM stale s
  WHERE v.id = s.id
  RETURNING v.id, v.status, v.processing_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.recover_stale_video_processing(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stale_video_processing(UUID, INTEGER, INTEGER) TO service_role;