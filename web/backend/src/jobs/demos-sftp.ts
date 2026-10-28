// Tarea de SFTP del VPS para las demos (plan docs/bitacora/2026-10-28-demos-servidores-externos).
// El Worker de demos (cloudflare/demo-worker) baja cada demo por la API del panel. Si el servidor no tiene key o el panel
// no lo deja entrar, la pasa a la cola de SFTP (demo_fallback). Esta tarea toma esa cola (demo_pending con p_via 'sftp'),
// baja cada demo por SFTP, la sube a R2 en stream, comprueba el tamaño, la marca con demo_mark y la borra del servidor.
// Si algo falla, demo_mark('retry'): gasta un intento y la próxima vuelta empieza otra vez por la API.
// Solo de Node (ssh2, node:https): queda fuera del tsconfig del Worker.
import { createHash, createHmac } from 'node:crypto';
import { request } from 'node:https';
import type { Readable } from 'node:stream';
import { Client, type SFTPWrapper } from 'ssh2';

const UID_RE = /^[A-Za-z0-9_-]{6,80}$/;

export interface PendingDemo {
  external_id: string;
  panel_server_id: string;
  played_at: string | null;
}

/** Credenciales de SFTP de un servidor. fingerprint: SHA256 de la llave del host en base64, como lo muestra ssh-keygen -l. */
export interface SftpServer {
  host: string;
  port: number;
  username: string;
  password: string;
  fingerprint?: string;
}

export interface SftpSession {
  /** Tamaño del archivo, o null si no existe. */
  size(path: string): Promise<number | null>;
  read(path: string): Readable;
  remove(path: string): Promise<void>;
  close(): void;
}

export interface Deps {
  rpc(fn: string, args: Record<string, unknown>): Promise<unknown>;
  openSftp(server: SftpServer): Promise<SftpSession>;
  r2Put(key: string, body: Readable, size: number): Promise<void>;
  /** Tamaño del objeto en R2, o null si no existe. */
  r2Size(key: string): Promise<number | null>;
  sleep(ms: number): Promise<void>;
}

export interface Config {
  servers: Record<string, SftpServer>;
  demoDir: string;
  deleteAfterUpload: boolean;
  /** Espera entre las dos lecturas del tamaño, para no bajar una demo que se está grabando. */
  stableMs: number;
  limit: number;
}

export interface Result {
  uid: string;
  status?: string;
  key?: string;
  size?: number;
  deleted?: boolean;
  note?: string;
  error?: string;
}

const msg = (e: unknown) => String(e instanceof Error ? e.message : e);

/** demos/AAAA/MM/<uid>.dem, con la fecha de la partida (la misma que arma el Worker). */
export function r2Key(m: PendingDemo, now = new Date()): string {
  const d = m.played_at ? new Date(m.played_at) : now;
  return `demos/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${m.external_id}.dem`;
}

/** Una vuelta: toma la cola de SFTP y procesa cada demo. Una sesión por servidor. */
export async function runOnce(deps: Deps, cfg: Config): Promise<Result[]> {
  const pending = (await deps.rpc('demo_pending', { p_limit: cfg.limit, p_via: 'sftp' })) as PendingDemo[];
  const sessions = new Map<string, SftpSession | Error>();
  const out: Result[] = [];
  try {
    for (const m of pending) {
      const r: Result = { uid: m.external_id };
      out.push(r);
      const retry = async () => {
        try {
          r.status = (await deps.rpc('demo_mark', { p_uid: m.external_id, p_result: 'retry' })) as string;
        } catch (e) {
          r.error = `${r.error ?? ''}; demo_mark: ${msg(e)}`;
        }
      };
      try {
        if (!UID_RE.test(m.external_id)) throw new Error('uid inválido');
        const server = cfg.servers[m.panel_server_id];
        if (!server) {
          r.note = 'no hay credenciales de SFTP para ese servidor';
          await retry();
          continue;
        }
        if (!sessions.has(m.panel_server_id)) {
          sessions.set(m.panel_server_id, await deps.openSftp(server).catch((e: unknown) => new Error(`SFTP: ${msg(e)}`)));
        }
        const sftp = sessions.get(m.panel_server_id)!;
        if (sftp instanceof Error) throw sftp;

        const path = `${cfg.demoDir}/${m.external_id}.dem`;
        const size = await sftp.size(path);
        if (size === null) {
          r.note = 'la demo no está en el servidor';
          await retry();
          continue;
        }
        await deps.sleep(cfg.stableMs);
        const again = await sftp.size(path);
        if (again !== size) {
          // Se está grabando (o la borraron): no gasta intento, sigue en la cola de SFTP para la próxima vuelta.
          r.note = `el tamaño cambió (${size} → ${again}): se está grabando`;
          r.status = 'pending';
          continue;
        }
        if (!(size > 0)) throw new Error('la demo está vacía');

        const key = r2Key(m);
        await deps.r2Put(key, sftp.read(path), size);
        const stored = await deps.r2Size(key);
        if (stored !== size) throw new Error(`R2 guardó ${stored} bytes de ${size}`);
        r.status = (await deps.rpc('demo_mark', { p_uid: m.external_id, p_result: 'uploaded', p_key: key, p_size: size })) as string;
        r.key = key;
        r.size = size;
        if (cfg.deleteAfterUpload) {
          try {
            await sftp.remove(path);
            r.deleted = true;
          } catch (e) {
            // Ya está subida: no se reintenta. El plugin igual conserva solo las últimas (csstv_demo_keep).
            r.note = `no se pudo borrar del servidor: ${msg(e)}`;
          }
        }
      } catch (e) {
        r.error = msg(e);
        await retry();
      }
    }
  } finally {
    for (const s of sessions.values()) if (!(s instanceof Error)) s.close();
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Implementaciones reales
// ---------------------------------------------------------------------------------------------

/** Funciones del Worker en Supabase (demo_*), con su token y la clave pública. */
export function supabaseRpc(url: string, anonKey: string, token: string): Deps['rpc'] {
  return async (fn, args) => {
    const resp = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, ...args }),
    });
    if (!resp.ok) throw new Error(`Supabase ${fn}: HTTP ${resp.status} ${(await resp.text()).slice(0, 200)}`);
    return resp.json();
  };
}

/** SHA256 de una llave pública SSH en base64 sin relleno, como "SHA256:..." de ssh-keygen -l. */
export function sshFingerprint(key: Buffer): string {
  return 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '');
}

export function openSftp(server: SftpServer): Promise<SftpSession> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => {
        conn.sftp((err, sftp: SFTPWrapper) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          resolve({
            size: (path) =>
              new Promise((ok, ko) =>
                sftp.stat(path, (e, st) => {
                  if (!e) return ok(st.isFile() ? st.size : null);
                  // 2 = SSH_FX_NO_SUCH_FILE
                  if ((e as { code?: number }).code === 2) return ok(null);
                  ko(e);
                }),
              ),
            read: (path) => sftp.createReadStream(path),
            remove: (path) => new Promise((ok, ko) => sftp.unlink(path, (e) => (e ? ko(e) : ok()))),
            close: () => conn.end(),
          });
        });
      })
      .on('error', reject)
      .connect({
        host: server.host,
        port: server.port,
        username: server.username,
        password: server.password,
        readyTimeout: 20_000,
        ...(server.fingerprint ? { hostVerifier: (key: Buffer) => sshFingerprint(key) === server.fingerprint } : {}),
      });
  });
}

export interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Firma S3 v4 de un pedido a R2 (región "auto"), con el cuerpo sin firmar (UNSIGNED-PAYLOAD). */
export function r2Sign(cfg: R2Config, method: string, key: string, now = new Date(), extra: Record<string, string> = {}) {
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const path = `/${cfg.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = { host, 'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', 'x-amz-date': amzDate, ...extra };
  const names = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const canonical = [method, path, '', ...names.map((n) => `${n}:${String(lower[n]).trim()}`), '', names.join(';'), 'UNSIGNED-PAYLOAD'].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonical).digest('hex')].join('\n');
  const hmac = (k: Buffer | string, s: string) => createHmac('sha256', k).update(s).digest();
  const signing = hmac(hmac(hmac(hmac(`AWS4${cfg.secretAccessKey}`, day), 'auto'), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signing).update(toSign).digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  return { host, path, headers };
}

function r2Request(cfg: R2Config, method: string, key: string, body?: Readable, size?: number): Promise<{ status: number; headers: Record<string, unknown>; text: string }> {
  const extra: Record<string, string> = size !== undefined ? { 'content-length': String(size), 'content-type': 'application/octet-stream' } : {};
  const { host, path, headers } = r2Sign(cfg, method, key, new Date(), extra);
  return new Promise((resolve, reject) => {
    const req = request({ host, path, method, headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c: string) => (text += c.length < 2000 ? c : ''));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body) {
      body.on('error', (e) => req.destroy(e));
      body.pipe(req);
    } else req.end();
  });
}

export function r2Client(cfg: R2Config): Pick<Deps, 'r2Put' | 'r2Size'> & { r2Delete(key: string): Promise<void> } {
  return {
    async r2Put(key, body, size) {
      const r = await r2Request(cfg, 'PUT', key, body, size);
      if (r.status !== 200) throw new Error(`R2 PUT: HTTP ${r.status} ${r.text.slice(0, 200)}`);
    },
    async r2Size(key) {
      const r = await r2Request(cfg, 'HEAD', key);
      if (r.status === 404) return null;
      if (r.status !== 200) throw new Error(`R2 HEAD: HTTP ${r.status}`);
      return Number(r.headers['content-length']);
    },
    async r2Delete(key) {
      const r = await r2Request(cfg, 'DELETE', key);
      if (r.status !== 204 && r.status !== 200) throw new Error(`R2 DELETE: HTTP ${r.status}`);
    },
  };
}

/** SFTP_SERVERS: JSON { "<panel_server_id>": { host, port, username, password, fingerprint? } }. */
export function parseServers(json: string): Record<string, SftpServer> {
  const raw = JSON.parse(json) as Record<string, Partial<SftpServer>>;
  const out: Record<string, SftpServer> = {};
  for (const [id, s] of Object.entries(raw)) {
    if (!/^[A-Za-z0-9-]{8,36}$/.test(id)) throw new Error(`SFTP_SERVERS: id inválido ${id}`);
    if (!s.host || !s.username || !s.password) throw new Error(`SFTP_SERVERS: a ${id} le falta host, username o password`);
    const port = Number(s.port ?? 22);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`SFTP_SERVERS: puerto inválido en ${id}`);
    out[id] = { host: s.host, port, username: s.username, password: s.password, ...(s.fingerprint ? { fingerprint: s.fingerprint } : {}) };
  }
  return out;
}
