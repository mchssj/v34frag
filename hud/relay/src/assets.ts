// Archivos del HUD: dentro del .exe van como assets de la SEA; con Node, se leen de public/ (al lado de relay.mjs en
// el build del VPS, o en hud/relay/public/ al correr desde src/).

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAsset, isSea } from "node:sea";

export const ASSETS = ["hud.html", "hud.css", "hud.js", "control.html", "control.js", "common.js"] as const;
export type AssetName = (typeof ASSETS)[number];

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
};

const HERE = import.meta.dirname ?? ".";
const PUBLIC = existsSync(join(HERE, "public")) ? join(HERE, "public") : join(HERE, "..", "public");

export function readAsset(name: AssetName): { body: string; type: string } {
  const body = isSea() ? (getAsset(name, "utf8") as string) : readFileSync(join(PUBLIC, name), "utf8");
  return { body, type: TYPES[name.split(".").pop() ?? ""] ?? "application/octet-stream" };
}
