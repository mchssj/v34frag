// Íconos del feed de kills: la fuente del kill feed de ClientMod, leída de la instalación del streamer.
// No va dentro del .exe ni del repo: no repartimos archivos de Valve ni de ClientMod.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FONT = join("cstrike", "resource", "clientmodkillfeed.ttf");
// Carpeta por defecto del instalador de ClientMod, en cualquier disco.
const DEFAULT_DIRS = ["C", "D", "E", "F"].map((d) => `${d}:\\CSSv34_ClientMod`);

/** Ruta de la fuente: dentro de gameDir si está configurado y, si no, en las carpetas por defecto. null si no está. */
export function findKillfeedFont(gameDir: string | null, exists: (p: string) => boolean = existsSync): string | null {
  for (const dir of gameDir ? [gameDir] : DEFAULT_DIRS) {
    const path = join(dir, FONT);
    if (exists(path)) return path;
  }
  return null;
}

export function loadFont(path: string | null): Buffer | null {
  if (!path) return null;
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}
