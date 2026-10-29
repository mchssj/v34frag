// Build para el VPS: pnpm build. Deja en dist/ cuatro archivos con todas sus dependencias adentro (en el servidor solo
// hace falta Node 24): server.mjs (la API, desde src/node.ts), season-tick.mjs (el cron de temporadas), demos-sftp.mjs
// (las demos por SFTP, plan docs/bitacora/2026-10-28-demos-servidores-externos) y notify-tick.mjs (las notificaciones
// programadas, plan docs/bitacora/2026-10-29-notificaciones-programadas).
// BUILD_SHA: el commit que va a mostrar /api/health (lo pone deploy/vps/desplegar.sh; sin él, "dev").
import { build } from 'esbuild';
import { rmSync } from 'node:fs';

const sha = process.env.BUILD_SHA || 'dev';
rmSync('dist', { recursive: true, force: true });

await build({
  entryPoints: {
    server: 'src/node.ts',
    'season-tick': 'scripts/season-tick.mts',
    'demos-sftp': 'scripts/demos-sftp.mts',
    'notify-tick': 'scripts/notify-tick.mts',
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
