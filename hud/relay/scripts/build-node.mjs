// Build del relay para el VPS (Linux, Node 24): dist-node/relay.mjs con todo adentro y dist-node/public/ con el HUD.
// BUILD_SHA: el commit que va a mostrar /healthz (lo pone deploy/vps/desplegar.sh; sin él, "dev").
// Uso: pnpm build:node

import { cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-node");

rmSync(out, { recursive: true, force: true });
await build({
  entryPoints: [join(root, "src", "main.ts")],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: join(out, "relay.mjs"),
  sourcemap: true,
  legalComments: "none",
  define: { "process.env.BUILD_SHA": JSON.stringify(process.env.BUILD_SHA || "dev") },
  logLevel: "warning",
});
cpSync(join(root, "public"), join(out, "public"), { recursive: true });
console.log(`Listo: ${out}`);
