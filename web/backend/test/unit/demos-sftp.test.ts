import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { parseServers, r2Key, r2Sign, runOnce, sshFingerprint, type Config, type Deps, type PendingDemo, type SftpSession } from '../../src/jobs/demos-sftp';

const SRV = { host: 'sftp.example.com', port: 2022, username: 'u.bbbb2222', password: 'x' };

function demo(uid: string, server = 'bbbb2222'): PendingDemo {
  return { external_id: uid, panel_server_id: server, played_at: '2026-10-28T20:00:00Z' };
}

/** Servidor SFTP en memoria: tamaños por ruta; sizes2 cambia el tamaño en la segunda lectura (demo grabándose). */
function fake(opts: {
  pending: PendingDemo[];
  files?: Record<string, number>;
  sizes2?: Record<string, number>;
  openFails?: boolean;
  removeFails?: boolean;
  r2Stores?: (size: number) => number;
}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const r2 = new Map<string, number>();
  const removed: string[] = [];
  const reads = new Map<string, number>();
  let opened = 0;
  let closed = 0;
  const session: SftpSession = {
    async size(path) {
      const n = (reads.get(path) ?? 0) + 1;
      reads.set(path, n);
      if (n >= 2 && opts.sizes2?.[path] !== undefined) return opts.sizes2[path]!;
      return opts.files?.[path] ?? null;
    },
    read: (path) => Readable.from([Buffer.alloc(opts.files?.[path] ?? 0)]),
    async remove(path) {
      if (opts.removeFails) throw new Error('permiso denegado');
      removed.push(path);
    },
    close: () => void closed++,
  };
  const deps: Deps = {
    async rpc(fn, args) {
      calls.push({ fn, args });
      if (fn === 'demo_pending') return opts.pending;
      if (fn === 'demo_mark') return args.p_result === 'uploaded' ? 'uploaded' : 'pending';
      throw new Error(`rpc inesperada ${fn}`);
    },
    async openSftp() {
      opened++;
      if (opts.openFails) throw new Error('All configured authentication methods failed');
      return session;
    },
    async r2Put(key, body, size) {
      let n = 0;
      for await (const c of body) n += (c as Buffer).length;
      expect(n).toBe(size);
      r2.set(key, opts.r2Stores ? opts.r2Stores(n) : n);
    },
    async r2Size(key) {
      return r2.get(key) ?? null;
    },
    sleep: async () => {},
  };
  return { deps, calls, r2, removed, counts: () => ({ opened, closed }) };
}

const cfg = (over: Partial<Config> = {}): Config => ({
  servers: { bbbb2222: SRV },
  demoDir: '/cstrike/csstv_demos',
  deleteAfterUpload: true,
  stableMs: 0,
  limit: 10,
  ...over,
});
const marks = (calls: { fn: string; args: Record<string, unknown> }[]) =>
  calls.filter((c) => c.fn === 'demo_mark').map((c) => `${c.args.p_uid}:${c.args.p_result}`);

describe('demos por SFTP', () => {
  it('pide la cola de SFTP', async () => {
    const f = fake({ pending: [] });
    expect(await runOnce(f.deps, cfg())).toEqual([]);
    expect(f.calls).toEqual([{ fn: 'demo_pending', args: { p_limit: 10, p_via: 'sftp' } }]);
  });

  it('sube la demo, la marca y la borra del servidor', async () => {
    const f = fake({ pending: [demo('flow-20261028T200000-ab12')], files: { '/cstrike/csstv_demos/flow-20261028T200000-ab12.dem': 1234 } });
    const [r] = await runOnce(f.deps, cfg());
    expect(r).toEqual({ uid: 'flow-20261028T200000-ab12', status: 'uploaded', key: 'demos/2026/10/flow-20261028T200000-ab12.dem', size: 1234, deleted: true });
    expect(f.r2.get('demos/2026/10/flow-20261028T200000-ab12.dem')).toBe(1234);
    expect(f.calls.at(-1)).toEqual({
      fn: 'demo_mark',
      args: { p_uid: 'flow-20261028T200000-ab12', p_result: 'uploaded', p_key: 'demos/2026/10/flow-20261028T200000-ab12.dem', p_size: 1234 },
    });
    expect(f.removed).toEqual(['/cstrike/csstv_demos/flow-20261028T200000-ab12.dem']);
    expect(f.counts()).toEqual({ opened: 1, closed: 1 });
  });

  it('sin DELETE_AFTER_UPLOAD no la borra', async () => {
    const f = fake({ pending: [demo('uid-000001')], files: { '/cstrike/csstv_demos/uid-000001.dem': 10 } });
    const [r] = await runOnce(f.deps, cfg({ deleteAfterUpload: false }));
    expect(r?.deleted).toBeUndefined();
    expect(f.removed).toEqual([]);
  });

  it('si no la puede borrar, queda subida igual (sin reintento)', async () => {
    const f = fake({ pending: [demo('uid-000001')], files: { '/cstrike/csstv_demos/uid-000001.dem': 10 }, removeFails: true });
    const [r] = await runOnce(f.deps, cfg());
    expect(r?.status).toBe('uploaded');
    expect(r?.note).toMatch(/no se pudo borrar/);
    expect(r?.error).toBeUndefined();
    expect(marks(f.calls)).toEqual(['uid-000001:uploaded']);
  });

  it('demo que no está: reintento', async () => {
    const f = fake({ pending: [demo('uid-000001')] });
    const [r] = await runOnce(f.deps, cfg());
    expect(r).toMatchObject({ status: 'pending', note: 'la demo no está en el servidor' });
    expect(marks(f.calls)).toEqual(['uid-000001:retry']);
    expect(f.r2.size).toBe(0);
  });

  it('demo grabándose (el tamaño cambia): no la sube ni gasta intento', async () => {
    const p = '/cstrike/csstv_demos/uid-000001.dem';
    const f = fake({ pending: [demo('uid-000001')], files: { [p]: 100 }, sizes2: { [p]: 200 } });
    const [r] = await runOnce(f.deps, cfg());
    expect(r?.note).toMatch(/se está grabando/);
    expect(marks(f.calls)).toEqual([]);
    expect(f.r2.size).toBe(0);
  });

  it('demo vacía: reintento', async () => {
    const f = fake({ pending: [demo('uid-000001')], files: { '/cstrike/csstv_demos/uid-000001.dem': 0 } });
    const [r] = await runOnce(f.deps, cfg());
    expect(r?.error).toMatch(/vacía/);
    expect(marks(f.calls)).toEqual(['uid-000001:retry']);
  });

  it('R2 guarda otro tamaño: reintento y no la borra', async () => {
    const f = fake({ pending: [demo('uid-000001')], files: { '/cstrike/csstv_demos/uid-000001.dem': 50 }, r2Stores: (n) => n - 1 });
    const [r] = await runOnce(f.deps, cfg());
    expect(r?.error).toMatch(/R2 guardó 49 bytes de 50/);
    expect(marks(f.calls)).toEqual(['uid-000001:retry']);
    expect(f.removed).toEqual([]);
  });

  it('sin credenciales para ese servidor: reintento (vuelve a la API)', async () => {
    const f = fake({ pending: [demo('uid-000001', 'zzzz9999')] });
    const [r] = await runOnce(f.deps, cfg());
    expect(r?.note).toMatch(/no hay credenciales/);
    expect(marks(f.calls)).toEqual(['uid-000001:retry']);
    expect(f.counts().opened).toBe(0);
  });

  it('SFTP rechaza la entrada: reintento de todas las de ese servidor, una sola conexión', async () => {
    const f = fake({ pending: [demo('uid-000001'), demo('uid-000002')], openFails: true });
    const rs = await runOnce(f.deps, cfg());
    expect(rs.map((r) => r.error)).toEqual(['SFTP: All configured authentication methods failed', 'SFTP: All configured authentication methods failed']);
    expect(marks(f.calls)).toEqual(['uid-000001:retry', 'uid-000002:retry']);
    expect(f.counts()).toEqual({ opened: 1, closed: 0 });
  });

  it('uid inválido: reintento sin tocar el servidor', async () => {
    const f = fake({ pending: [demo('../../etc/passwd')] });
    const [r] = await runOnce(f.deps, cfg());
    expect(r?.error).toBe('uid inválido');
    expect(f.counts().opened).toBe(0);
  });

  it('varias demos del mismo servidor: una sesión', async () => {
    const f = fake({
      pending: [demo('uid-000001'), demo('uid-000002')],
      files: { '/cstrike/csstv_demos/uid-000001.dem': 1, '/cstrike/csstv_demos/uid-000002.dem': 2 },
    });
    const rs = await runOnce(f.deps, cfg());
    expect(rs.map((r) => r.status)).toEqual(['uploaded', 'uploaded']);
    expect(f.counts()).toEqual({ opened: 1, closed: 1 });
  });
});

describe('piezas', () => {
  it('r2Key con la fecha de la partida (UTC), igual que el Worker', () => {
    expect(r2Key({ external_id: 'uid-000001', panel_server_id: 'x', played_at: '2026-01-31T23:30:00-05:00' })).toBe('demos/2026/02/uid-000001.dem');
    expect(r2Key({ external_id: 'uid-000001', panel_server_id: 'x', played_at: null }, new Date('2026-03-05T00:00:00Z'))).toBe('demos/2026/03/uid-000001.dem');
  });

  it('parseServers valida y pone el puerto 22 por defecto', () => {
    expect(parseServers('{"bbbb2222":{"host":"h","username":"u","password":"p"}}')).toEqual({ bbbb2222: { host: 'h', port: 22, username: 'u', password: 'p' } });
    expect(parseServers('{"bbbb2222":{"host":"h","port":"2022","username":"u","password":"p","fingerprint":"SHA256:x"}}').bbbb2222).toMatchObject({ port: 2022, fingerprint: 'SHA256:x' });
    expect(() => parseServers('{"bbbb2222":{"host":"h","username":"u"}}')).toThrow(/le falta/);
    expect(() => parseServers('{"x":{"host":"h","username":"u","password":"p"}}')).toThrow(/id inválido/);
    expect(() => parseServers('{"bbbb2222":{"host":"h","port":70000,"username":"u","password":"p"}}')).toThrow(/puerto/);
  });

  it('sshFingerprint como ssh-keygen (SHA256 en base64 sin relleno)', () => {
    expect(sshFingerprint(Buffer.from('abc'))).toBe('SHA256:ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0');
  });

  it('r2Sign: host y ruta de R2, cabeceras firmadas y fecha', () => {
    const s = r2Sign({ accountId: 'acc', bucket: 'csstv-demos', accessKeyId: 'AK', secretAccessKey: 'SK' }, 'PUT', 'demos/2026/10/a b.dem', new Date('2026-10-28T12:34:56.789Z'), { 'content-length': '5' });
    expect(s.host).toBe('acc.r2.cloudflarestorage.com');
    expect(s.path).toBe('/csstv-demos/demos/2026/10/a%20b.dem');
    expect(s.headers['x-amz-date']).toBe('20261028T123456Z');
    expect(s.headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AK\/20261028\/auto\/s3\/aws4_request, SignedHeaders=content-length;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
  });
});
