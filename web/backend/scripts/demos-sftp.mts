// Demos por SFTP (cron del VPS, cada 10 minutos): pnpm demos:sftp
// Toma la cola de SFTP del Worker de demos y sube cada demo a R2 (ver src/jobs/demos-sftp.ts y el plan
// docs/bitacora/2026-10-28-demos-servidores-externos). Escribe una línea por demo procesada (nada si la cola está vacía)
// y sale con 1 si no pudo leer la cola o si alguna demo falló.
// Variables: SUPABASE_URL, SUPABASE_ANON_KEY, DEMO_WORKER_TOKEN, R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY y las credenciales de SFTP en SFTP_SERVERS (JSON) o en el archivo SFTP_SERVERS_FILE.
// Opcionales: DEMO_DIR (/cstrike/csstv_demos), DELETE_AFTER_UPLOAD (true), STABLE_SECONDS (5).
import { readFileSync } from 'node:fs';
import { openSftp, parseServers, r2Client, runOnce, supabaseRpc } from '../src/jobs/demos-sftp';

const env = process.env;
const need = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DEMO_WORKER_TOKEN', 'R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
const missing = need.filter((k) => !env[k]);
const serversJson = env.SFTP_SERVERS ?? (env.SFTP_SERVERS_FILE ? readFileSync(env.SFTP_SERVERS_FILE, 'utf8') : undefined);
if (!serversJson) missing.push('SFTP_SERVERS o SFTP_SERVERS_FILE');
if (missing.length) {
  console.error(`demos:sftp: faltan ${missing.join(', ')}`);
  process.exit(1);
}

const r2 = r2Client({ accountId: env.R2_ACCOUNT_ID!, bucket: env.R2_BUCKET!, accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! });
let results;
try {
  results = await runOnce(
    {
      rpc: supabaseRpc(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!, env.DEMO_WORKER_TOKEN!),
      openSftp,
      r2Put: r2.r2Put,
      r2Size: r2.r2Size,
      sleep: (ms) => new Promise((ok) => setTimeout(ok, ms)),
    },
    {
      servers: parseServers(serversJson!),
      demoDir: env.DEMO_DIR || '/cstrike/csstv_demos',
      deleteAfterUpload: (env.DELETE_AFTER_UPLOAD ?? 'true') === 'true',
      stableMs: 1000 * (Number(env.STABLE_SECONDS) || 5),
      limit: 10,
    },
  );
} catch (e) {
  console.error(`demos:sftp: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

const now = new Date().toISOString();
for (const r of results) console.log(`${now} demos:sftp: ${JSON.stringify(r)}`);
if (results.some((r) => r.error)) process.exit(1);
