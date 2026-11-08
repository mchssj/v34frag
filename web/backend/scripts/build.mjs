// Build para el VPS: pnpm build. Deja en dist/ cuatro archivos con todas sus dependencias adentro (en el servidor solo
// hace falta Node 24): server.mjs (la API, desde src/node.ts), season-tick.mjs (el cron de temporadas), demos-sftp.mjs
// (las demos por SFTP, plan docs/bitacora/2026-10-28-demos-servidores-externos) y notify-tick.mjs (las notificaciones
// programadas, plan docs/bitacora/2026-10-29-notificaciones-programadas).
// BUILD_SHA: el commit que va a mostrar /api/health (lo pone deploy/vps/desplegar.sh; sin él, "dev").
// Además copia el manual de usuario (docs/manual, o MANUAL_DIR) a dist/manual, después de validarlo: con un error en el
// manual (encabezado, link roto, captura que falta) el build falla. Plan docs/bitacora/2026-11-02-manual-usuario.
import { build } from 'esbuild';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const sha = process.env.BUILD_SHA || 'dev';
rmSync('dist', { recursive: true, force: true });

await build({
  entryPoints: {
    server: 'src/node.ts',
    'season-tick': 'scripts/season-tick.mts',
    'medals-tick': 'scripts/medals-tick.mts',
    'demos-sftp': 'scripts/demos-sftp.mts',
    'notify-tick': 'scripts/notify-tick.mts',
    'mm-worker': 'scripts/mm-worker.mts',
  },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  sourcemap: true,
  legalComments: 'none',
  define: { 'process.env.BUILD_SHA': JSON.stringify(sha) },
  // Algunas dependencias son CommonJS y usan require() y __dirname (ssh2): en un .mjs hay que dárselos.
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url); " +
      'const __dirname = import.meta.dirname; const __filename = import.meta.filename;',
  },
  // Módulos nativos opcionales de ssh2: los carga dentro de un try y sin ellos usa JavaScript puro (pnpm-workspace.yaml
  // no los deja compilar).
  external: ['cpu-features', '*.node'],
  logLevel: 'info',
});

// --- Manual de usuario ------------------------------------------------------------------------------------------------
const manualDir = resolve(process.env.MANUAL_DIR || '../../docs/manual');
if (!existsSync(manualDir)) {
  console.warn(`\n[!] Sin manual de usuario (${manualDir}): la API va a responder el índice vacío.`);
} else {
  // lib/manual-node.ts es TypeScript: se arma en memoria con esbuild y se importa desde un data: URL.
  const out = await build({
    entryPoints: ['src/lib/manual-node.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node24', write: false, logLevel: 'error',
  });
  const { cargarManual } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
  const { manual, errores } = cargarManual(manualDir);
  if (errores.length) {
    console.error(`\n[!!] El manual de usuario tiene ${errores.length} error(es):\n` + errores.map((e) => `  - ${e}`).join('\n'));
    process.exit(1);
  }
  cpSync(manualDir, 'dist/manual', { recursive: true, filter: (src) => !src.endsWith('README.md') });
  console.log(`\nManual de usuario: ${manual.paginas.size} páginas y ${manual.imagenes.size} capturas -> dist/manual`);
}
