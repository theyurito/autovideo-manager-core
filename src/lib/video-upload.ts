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

export async function findDuplicate(hash: string, userId: string) {
  const { data, error } = await supabase
    .from("videos")
    .select("id")
    .eq("user_id", userId)
    .eq("hash", hash)
    .maybeSingle();
  if (error) throw error;
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

export class DuplicateVideoError extends Error {
  constructor() {
    super("Este vídeo já foi enviado anteriormente.");
    this.name = "DuplicateVideoError";
  }
}

/**
 * Fluxo completo de um arquivo:
 * SHA-256 → duplicidade → upload → INSERT (com limpeza em falha parcial).
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

  onStage("checking");
  if (await findDuplicate(hash, userId)) throw new DuplicateVideoError();

  const path = `${userId}/${hash}.${fileExtension(file.name)}`;

  onStage("uploading");
  await uploadToStorage({ path, file, accessToken, onProgress, signal });

  onStage("saving");
  const { data, error } = await supabase
    .from("videos")
    .insert({
      user_id: userId,
      filename: file.name,
      hash,
      original_path: path,
      status: "Pendente",
    })
    .select()
    .single();

  if (error) {
    await removeFromStorage(path);
    if (error.code === "23505") throw new DuplicateVideoError();
    throw new Error(error.message);
  }

  return data;
}
