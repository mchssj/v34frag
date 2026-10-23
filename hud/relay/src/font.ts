// Íconos del HUD: las fuentes de ClientMod y de CS:S, leídas de la instalación del streamer.
// No van dentro del .exe ni del repo: no repartimos archivos de Valve ni de ClientMod.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** killfeed: armas, headshot, agregados de ClientMod, chaleco, granadas y C4. cs: el kit de desactivación. */
export const FONTS = { killfeed: "clientmodkillfeed.ttf", cs: "cs.ttf" } as const;
export type FontName = keyof typeof FONTS;

// Carpeta por defecto del instalador de ClientMod, en cualquier disco.
const DEFAULT_DIRS = ["C", "D", "E", "F"].map((d) => `${d}:\\CSSv34_ClientMod`);

/** Ruta de la fuente: dentro de gameDir si está configurado y, si no, en las carpetas por defecto. null si no está. */
export function findFont(gameDir: string | null, name: FontName, exists: (p: string) => boolean = existsSync): string | null {
  const file = join("cstrike", "resource", FONTS[name]);
  for (const dir of gameDir ? [gameDir] : DEFAULT_DIRS) {
    const path = join(dir, file);
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
