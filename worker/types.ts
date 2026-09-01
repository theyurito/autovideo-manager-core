export type VideoStatus =
  | 'PENDENTE'
  | 'PROCESSANDO'
  | 'PRONTO'
  | 'AGENDADO'
  | 'PUBLICANDO'
  | 'PUBLICADO'
  | 'COM_ERRO';

export interface ClaimedJob {
  id: string;
  user_id: string;
  arquivo_id: string;
  processing_attempts: number;
}

export interface RecoveredJob {
  id: string;
  new_status: VideoStatus;
  processing_attempts: number;
}

export interface PendingCandidate {
  id: string;
  filename: string;
  status: VideoStatus;
  processing_attempts: number;
  created_at: string;
  arquivo_id: string;
}
