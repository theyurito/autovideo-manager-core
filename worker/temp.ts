/** Portable per-job temporary directory helpers (Windows/Linux/macOS). */
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

export interface JobWorkspace {
  root: string;
  inputPath: (filename: string) => string;
  outputPath: (filename: string) => string;
  cleanup: () => void;
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);
}

export function createJobWorkspace(videoId: string): JobWorkspace {
  const root = mkdtempSync(join(tmpdir(), `autovideo-${safeName(videoId)}-`));

  const within = (filename: string) => {
    const target = resolve(root, safeName(filename));
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error('Caminho temporario invalido: fora do diretorio do job.');
    }
    return target;
  };

  return {
    root,
    inputPath: (filename) => within(`in-${filename}`),
    outputPath: (filename) => within(`out-${filename}`),
    cleanup: () => removeWorkspace(root),
  };
}

/** Removes ONLY a directory created inside the system temp dir by this worker. */
export function removeWorkspace(root: string): void {
  try {
    const resolved = resolve(root);
    const base = resolve(tmpdir());
    const isOurs =
      resolved.startsWith(base + sep) && resolved.slice(base.length + 1).startsWith('autovideo-');
    if (!isOurs) {
      throw new Error('Cleanup recusado: diretorio fora do escopo do worker.');
    }
    if (!existsSync(resolved)) return;
    rmSync(resolved, { recursive: true, force: true });
  } catch {
    // Cleanup must never crash the worker.
  }
}
