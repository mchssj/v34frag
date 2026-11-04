// Carga el manual de usuario desde el disco (solo Node: node.ts y scripts/build.mjs). Ver lib/manual.ts.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { armarManual, type ManualArchivo } from './manual';

/** Todos los archivos de la carpeta del manual, con la ruta relativa separada con "/". */
export function archivosDelManual(dir: string): ManualArchivo[] {
  const out: ManualArchivo[] = [];
  const recorrer = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const abs = join(d, e.name);
      if (e.isDirectory()) recorrer(abs);
      else if (e.isFile()) {
        const ruta = relative(dir, abs).split(sep).join('/');
        out.push(ruta.endsWith('.md') ? { ruta, texto: readFileSync(abs, 'utf8') } : { ruta, leer: () => readFile(abs) });
      }
    }
  };
  recorrer(dir);
  return out.sort((a, b) => a.ruta.localeCompare(b.ruta));
}

/**
 * La carpeta del manual: MANUAL_DIR; si no, dist/manual (al lado de server.mjs en el VPS); si no, docs/manual del repo
 * (pnpm dev:node). Sin ninguna, el manual queda vacío.
 */
export function carpetaDelManual(desde: string, env: string | undefined): string | null {
  const opciones = env ? [env] : [join(desde, 'manual'), resolve(desde, '../../../docs/manual')];
  return opciones.find((d) => existsSync(d)) ?? null;
}

export function cargarManual(dir: string | null) {
  return armarManual(dir ? archivosDelManual(dir) : []);
}
