// Prueba las piezas reales de la tarea de SFTP sin tocar la base (plan docs/bitacora/2026-10-28-demos-servidores-externos).
// Desde web/backend del worktree del backend: pnpm exec tsx <ruta a este archivo> <ruta al .env>
//   1. SFTP (solo lectura) a nuestro servidor (SFTP_CSS_*), RBK (SERVER1_*) y flow (SERVER2_*): huella de la llave del
//      host (para fingerprint en sftp-servers.json), id del panel (sale del usuario) y lectura de cstrike/steam.inf.
//   2. R2 con el token de las demos (CF_R2_*_DEMOS): sube cstrike/steam.inf de flow a pruebas/demos-sftp/steam.inf,
//      compara el tamaño y lo borra. No toca demos/.
// No imprime credenciales.
import { readFileSync } from 'node:fs';
import { Client } from 'ssh2';
import { openSftp, r2Client, sshFingerprint, type SftpServer } from '../../../../web/backend/src/jobs/demos-sftp';

const env: Record<string, string> = {};
for (const line of readFileSync(process.argv[2]!, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
}
const ACCOUNT = 'fedc1b8398e60e62e1b42b4711104404'; // cloudflare/demo-worker/wrangler.toml

const servers: [string, SftpServer][] = [
  ['nuestro', { host: env.SFTP_CSS_SERVER!, port: Number(env.SFTP_CSS_SERVER_PORT), username: env.SFTP_CSS_USER!, password: env.SFTP_CSS_PASSWORD! }],
  ['RBK', { host: env.SERVER1_FTP_HOST!, port: Number(env.SERVER1_FTP_PORT), username: env.SERVER1_FTP_USER!, password: env.SERVER1_FTP_PASSWORD! }],
  ['flow', { host: env.SERVER2_FTP_HOST!, port: Number(env.SERVER2_FTP_PORT), username: env.SERVER2_FTP_USER!, password: env.SERVER2_FTP_PASSWORD! }],
];

function hostFingerprint(s: SftpServer): Promise<string> {
  return new Promise((ok, ko) => {
    const c = new Client();
    let fp = '';
    c.on('ready', () => (c.end(), ok(fp)))
      .on('error', ko)
      .connect({ host: s.host, port: s.port, username: s.username, password: s.password, readyTimeout: 20_000, hostVerifier: (k: Buffer) => ((fp = sshFingerprint(k)), true) });
  });
}

for (const [name, s] of servers) {
  try {
    const fp = await hostFingerprint(s);
    const sftp = await openSftp({ ...s, fingerprint: fp });
    const inf = await sftp.size('/cstrike/steam.inf');
    sftp.close();
    console.log(`${name}: id del panel ${s.username.split('.').pop()}, huella ${fp}, conecta con la huella fijada; steam.inf ${inf} bytes`);
  } catch (e) {
    console.log(`${name}: ERROR ${e instanceof Error ? e.message : e}`);
  }
}

// Una huella equivocada tiene que cortar la conexión.
const [, flow] = servers[2]!;
await openSftp({ ...flow, fingerprint: 'SHA256:equivocada' }).then(
  (s) => (s.close(), console.log('huella equivocada: FALLA, conectó igual')),
  (e) => console.log(`huella equivocada: rechazada ✅ (${e instanceof Error ? e.message : e})`),
);

const r2 = r2Client({ accountId: ACCOUNT, bucket: 'csstv-demos', accessKeyId: env.CF_R2_ACCESS_KEY_ID_DEMOS!, secretAccessKey: env.CF_R2_SECRET_ACCESS_DEMOS! });
const key = 'pruebas/demos-sftp/steam.inf';
const sftp = await openSftp(flow);
const size = (await sftp.size('/cstrike/steam.inf'))!;
await r2.r2Put(key, sftp.read('/cstrike/steam.inf'), size);
sftp.close();
const stored = await r2.r2Size(key);
console.log(`R2: subido ${key} desde flow por SFTP, ${stored} bytes de ${size} ${stored === size ? '✅' : 'FALLA'}`);
await r2.r2Delete(key);
console.log(`R2: borrado; HEAD después de borrar: ${(await r2.r2Size(key)) === null ? '404 ✅' : 'FALLA, sigue estando'}`);
console.log(`R2: HEAD de un objeto que no existe: ${(await r2.r2Size('pruebas/demos-sftp/no-existe')) === null ? 'null ✅' : 'FALLA'}`);
