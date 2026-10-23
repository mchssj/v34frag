// Arma dist/relay.exe: un solo archivo con Node, el relay y el HUD adentro (Single Executable Application).
// Pasos: esbuild junta el código en un .cjs, Node genera el blob y postject lo inyecta en una copia de node.exe.

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const ASSETS = ["hud.html", "hud.css", "hud.js", "control.html", "control.js", "common.js"];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

await build({
  entryPoints: [join(root, "src", "main.ts")],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  outfile: join(dist, "relay.cjs"),
  // Dentro del .exe los archivos del HUD salen de los assets de la SEA, no de public/.
  define: { "import.meta.dirname": '"."' },
  logLevel: "warning",
});

const seaConfig = {
  main: join(dist, "relay.cjs"),
  output: join(dist, "sea-prep.blob"),
  disableExperimentalSEAWarning: true,
  useCodeCache: false,
  useSnapshot: false,
  assets: Object.fromEntries(ASSETS.map((a) => [a, join(root, "public", a)])),
};
writeFileSync(join(dist, "sea-config.json"), JSON.stringify(seaConfig, null, 2));
execFileSync(process.execPath, ["--experimental-sea-config", join(dist, "sea-config.json")], { stdio: "inherit" });

const exe = join(dist, process.platform === "win32" ? "relay.exe" : "relay");
copyFileSync(process.execPath, exe);
execFileSync(
  process.execPath,
  [
    join(root, "node_modules", "postject", "dist", "cli.js"),
    exe,
    "NODE_SEA_BLOB",
    join(dist, "sea-prep.blob"),
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ],
  { stdio: "inherit" },
);

for (const f of ["relay.cjs", "sea-prep.blob", "sea-config.json"]) rmSync(join(dist, f));
console.log(`\nListo: ${exe}`);
