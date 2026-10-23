// relay.json, al lado del .exe (o en la carpeta desde la que se corre con Node).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Config {
  key: string;
  udpPort: number;
  httpPort: number;
  /** Segundos de retraso. null: usar el tv_delay que manda el servidor. */
  delay: number | null;
  /** Carpeta de ClientMod del streamer, para los íconos del feed. null: buscarla en C:\ a F:\CSSv34_ClientMod. */
  gameDir: string | null;
}

const DEFAULTS: Config = { key: "", udpPort: 27500, httpPort: 8090, delay: null, gameDir: null };

export function configPath(isSea: boolean): string {
  return join(isSea ? dirname(process.execPath) : process.cwd(), "relay.json");
}

export type LoadResult = { ok: true; config: Config } | { ok: false; message: string };

export function loadConfig(path: string): LoadResult {
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify({ ...DEFAULTS, key: "PEGAR_ACA_LA_CLAVE" }, null, 2) + "\n");
    return { ok: false, message: `Se creó ${path}. Poné la clave que te pasaron en "key" y volvé a abrir el relay.` };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return { ok: false, message: `${path} no es un JSON válido: ${(e as Error).message}` };
  }
  const c = { ...DEFAULTS, ...(raw as Partial<Config>) };
  if (typeof c.key !== "string" || c.key === "" || c.key === "PEGAR_ACA_LA_CLAVE")
    return { ok: false, message: `Falta la clave en ${path} ("key").` };
  for (const k of ["udpPort", "httpPort"] as const)
    if (!Number.isInteger(c[k]) || c[k] < 1 || c[k] > 65535) return { ok: false, message: `"${k}" tiene que ser un puerto (1 a 65535).` };
  if (c.delay !== null && (typeof c.delay !== "number" || c.delay < 0 || c.delay > 300))
    return { ok: false, message: `"delay" tiene que ser null o un número de 0 a 300 segundos.` };
  if (c.gameDir !== null && typeof c.gameDir !== "string")
    return { ok: false, message: `"gameDir" tiene que ser null o la carpeta de ClientMod, por ejemplo "C:\\\\CSSv34_ClientMod" (en relay.json la barra va doble).` };
  return { ok: true, config: c };
}
