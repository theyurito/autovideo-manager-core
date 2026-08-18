import { supabase } from "@/integrations/supabase/client";

export const RAW_BUCKET = "raw-videos";

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string;
const SUPABASE_KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;

export function isVideoFile(file: File) {
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|mov|webm|mkv|avi|m4v|mpeg|mpg|3gp|ogv)$/i.test(file.name);
}

export function fileExtension(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match ? match[1]!.toLowerCase() : "bin";
}

/** SHA-256 do conteúdo bruto do arquivo, calculado no navegador (Web Crypto API). */
export async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Busca o arquivo físico do usuário pelo hash do conteúdo. */
export async function findArquivoByHash(hash: string, userId: string) {
  const { data, error } = await supabase
    .from("arquivos")
    .select("id, filename, storage_path, status, created_at")
    .eq("user_id", userId)
    .eq("hash_sha256", hash)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Conta entradas operacionais (videos) ligadas a um arquivo. */
export async function countVideosForArquivo(arquivoId: string) {
  const { count, error } = await supabase
    .from("videos")
    .select("id", { count: "exact", head: true })
    .eq("arquivo_id", arquivoId);
  if (error) throw error;
  return count ?? 0;
}

/** Cria uma nova entrada operacional na fila para um arquivo já existente. */
export async function createVideoEntry(options: {
  arquivoId: string;
  userId: string;
  filename: string;
  storagePath: string | null;
  hash: string;
}) {
  const { data, error } = await supabase
    .from("videos")
    .insert({
      user_id: options.userId,
      arquivo_id: options.arquivoId,
      filename: options.filename,
      hash: options.hash,
      original_path: options.storagePath,
      status: "PENDENTE",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Upload direto ao Storage via XHR para obter progresso real de 0 a 100%. */
export function uploadToStorage(options: {
  path: string;
  file: File;
  accessToken: string;
  onProgress: (percent: number) => void;
  signal?: AbortSignal | undefined;
}): Promise<void> {
  const { path, file, accessToken, onProgress, signal } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/${RAW_BUCKET}/${path}`);
    xhr.setRequestHeader("authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    // upsert evita objetos duplicados no bucket para o mesmo hash
    xhr.setRequestHeader("x-upsert", "true");
    if (file.type) xhr.setRequestHeader("content-type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Falha no upload (${xhr.status}): ${xhr.responseText || "erro"}`));
      }
    };
    xhr.onerror = () => reject(new Error("Falha de rede durante o upload."));
    xhr.onabort = () => reject(new Error("Upload cancelado."));

    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}

export async function removeFromStorage(path: string) {
  try {
    await supabase.storage.from(RAW_BUCKET).remove([path]);
  } catch {
    /* limpeza best-effort */
  }
}

export type DuplicateInfo = {
  arquivoId: string;
  hash: string;
  filename: string;
  storagePath: string | null;
  existingEntries: number;
  newFilename: string;
};

/** Arquivo físico já existe: a UI decide se cria uma nova entrada na fila. */
export class DuplicateFileError extends Error {
  info: DuplicateInfo;
  constructor(info: DuplicateInfo) {
    super("Este arquivo já existe (mesmo SHA-256).");
    this.name = "DuplicateFileError";
    this.info = info;
  }
}

/**
 * Fluxo completo de um arquivo:
 * SHA-256 → arquivo (identidade física) → upload → confirmação → entrada operacional em videos.
 */
export async function processVideoFile(options: {
  file: File;
  userId: string;
  accessToken: string;
  onStage: (stage: "hashing" | "checking" | "uploading" | "saving") => void;
  onProgress: (percent: number) => void;
  signal?: AbortSignal | undefined;
}) {
  const { file, userId, accessToken, onStage, onProgress, signal } = options;

  if (!isVideoFile(file)) {
    throw new Error("Arquivo inválido: envie apenas arquivos de vídeo.");
  }

  onStage("hashing");
  const hash = await sha256File(file);
  const path = `${userId}/${hash}.${fileExtension(file.name)}`;

  onStage("checking");
  let arquivo = await findArquivoByHash(hash, userId);
  let arquivoCriadoAgora = false;

  if (arquivo && arquivo.status === "UPLOAD_CONFIRMADO") {
    const entries = await countVideosForArquivo(arquivo.id);
    if (entries === 0) {
      // Estado inconsistente: arquivo confirmado sem entrada operacional → repara criando uma.
      onStage("saving");
      return createVideoEntry({
        arquivoId: arquivo.id,
        userId,
        filename: file.name,
        storagePath: arquivo.storage_path,
        hash,
      });
    }
    throw new DuplicateFileError({
      arquivoId: arquivo.id,
      hash,
      filename: arquivo.filename,
      storagePath: arquivo.storage_path,
      existingEntries: entries,
      newFilename: file.name,
    });
  }

  if (!arquivo) {
    const { data, error } = await supabase
      .from("arquivos")
      .insert({
        user_id: userId,
        hash_sha256: hash,
        filename: file.name,
        storage_path: path,
        size_bytes: file.size,
        status: "PENDENTE_UPLOAD",
      })
      .select("id, filename, storage_path, status, created_at")
      .single();

    if (error) {
      // 23505: corrida — outro envio simultâneo criou o mesmo arquivo.
      if (error.code === "23505") {
        const existing = await findArquivoByHash(hash, userId);
        if (!existing) throw new Error(error.message);
        const entries = await countVideosForArquivo(existing.id);
        if (entries > 0) {
          throw new DuplicateFileError({
            arquivoId: existing.id,
            hash,
            filename: existing.filename,
            storagePath: existing.storage_path,
            existingEntries: entries,
            newFilename: file.name,
          });
        }
        arquivo = existing;
      } else {
        throw new Error(error.message);
      }
    } else {
      arquivo = data;
      arquivoCriadoAgora = true;
    }
  }

  onStage("uploading");
  try {
    await uploadToStorage({ path, file, accessToken, onProgress, signal });
  } catch (error) {
    if (arquivoCriadoAgora) {
      await supabase.from("arquivos").delete().eq("id", arquivo.id);
    }
    throw error;
  }

  const { error: confirmError } = await supabase
    .from("arquivos")
    .update({ status: "UPLOAD_CONFIRMADO", storage_path: path, size_bytes: file.size })
    .eq("id", arquivo.id);
  if (confirmError) {
    if (arquivoCriadoAgora) {
      await removeFromStorage(path);
      await supabase.from("arquivos").delete().eq("id", arquivo.id);
    }
    throw new Error(confirmError.message);
  }

  onStage("saving");
  try {
    return await createVideoEntry({
      arquivoId: arquivo.id,
      userId,
      filename: file.name,
      storagePath: path,
      hash,
    });
  } catch (error) {
    if (arquivoCriadoAgora) {
      await removeFromStorage(path);
      await supabase.from("arquivos").delete().eq("id", arquivo.id);
    }
    throw error;
  }
}

