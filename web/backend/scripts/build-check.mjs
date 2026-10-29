// Prueba del build: pnpm build:check (después de pnpm build). Arranca dist/server.mjs como en el VPS, con variables
// de mentira, y pide /api/health. No habla con ninguna Supabase. Sale con 1 si no responde bien.
// También corre dist/demos-sftp.mjs (con ssh2 adentro) y dist/notify-tick.mjs sin variables: tienen que cargar y
// quejarse de que faltan.
// En Linux además comprueba el cierre ordenado con SIGTERM; en Windows no hay señales (kill corta el proceso).
import { spawn } from 'node:child_process';

const port = 18787;
const child = spawn(process.execPath, ['--enable-source-maps', 'dist/server.mjs'], {
  env: {
    PATH: process.env.PATH,
    APP_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'build-check-anon-key-0000000000',
    FRONTEND_URL: 'https://example.com',
    CORS_ORIGINS: 'https://example.com',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
});
child.stdout.pipe(process.stdout);

let ok = false;
for (let i = 0; i < 40 && !ok; i++) {
  await new Promise((r) => setTimeout(r, 250));
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    const body = await res.json();
    ok = res.status === 200 && body.status === 'ok' && body.env === 'production';
    console.log(`build:check: /api/health ${res.status} ${JSON.stringify(body)}`);
  } catch {
    // Todavía arrancando.
  }
}
child.kill('SIGTERM');
const code = await new Promise((r) => child.once('exit', r));
const ordenado = process.platform === 'win32' || code === 0;
console.log(`build:check: cerró con ${code ?? 'señal'} tras SIGTERM${process.platform === 'win32' ? ' (Windows: no se prueba)' : ''}`);
if (!ok || !ordenado) {
  console.error('build:check: FALLA');
  process.exitCode = 1;
} else {
  console.log('build:check: ok');
}

// demos-sftp.mjs: sin variables tiene que salir con 1 y el mensaje de las que faltan (si no carga, el error es otro).
const demos = spawn(process.execPath, ['dist/demos-sftp.mjs'], { env: { PATH: process.env.PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
let salida = '';
demos.stdout.on('data', (c) => (salida += c));
demos.stderr.on('data', (c) => (salida += c));
const codeDemos = await new Promise((r) => demos.once('exit', r));
const demosOk = codeDemos === 1 && salida.includes('demos:sftp: faltan');
console.log(`build:check: demos-sftp.mjs ${demosOk ? 'carga' : 'FALLA'}: ${salida.trim().split('\n')[0]}`);
if (!demosOk) process.exitCode = 1;

// notify-tick.mjs: lo mismo, sin variables sale con 1 y avisa que faltan.
const notify = spawn(process.execPath, ['dist/notify-tick.mjs'], { env: { PATH: process.env.PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
let salidaNotify = '';
notify.stdout.on('data', (c) => (salidaNotify += c));
notify.stderr.on('data', (c) => (salidaNotify += c));
const codeNotify = await new Promise((r) => notify.once('exit', r));
const notifyOk = codeNotify === 1 && salidaNotify.includes('notify:tick: faltan');
console.log(`build:check: notify-tick.mjs ${notifyOk ? 'carga' : 'FALLA'}: ${salidaNotify.trim().split('\n')[0]}`);
if (!notifyOk) process.exitCode = 1;
