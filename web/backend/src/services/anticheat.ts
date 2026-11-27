// Anticheat: firma del latido e identificadores de la máquina (plan docs/bitacora/2026-11-27-anticheat-deteccion, replanteos 156 y 157).

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const fromB64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

export const sha256Hex = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

/** Firma ECDSA P-256 del equipo (clave "raw" en base64, firma r||s en base64). Una clave o firma mal formada no valida. */
export async function signatureOk(publicKey: string, signature: string, text: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('raw', fromB64(publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromB64(signature), enc.encode(text));
  } catch {
    return false;
  }
}

/** Lo que firma el agente en cada latido: el momento y el token con el que entra, sin el token en claro. */
export const heartbeatText = async (ts: number, accessToken: string) => `v1|hb|${ts}|${await sha256Hex(accessToken)}`;

// Valores que traen muchas placas o imágenes de Windows: no identifican una máquina.
const GENERIC = new Set([
  '', '0', 'none', 'null', 'default string', 'to be filled by o.e.m.', 'to be filled by oem', 'system serial number', 'not specified',
  'not applicable', 'base board serial number', 'chassis serial number', '123456789', 'xxxxxxxxxxxx',
  '00000000000000000000000000000000', 'ffffffffffffffffffffffffffffffff', '03000200040005000006000700080009',
]);

const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200) : '');

export type MachineHashes = {
  smbios: string | null;
  board: string | null;
  machine_guid: string | null;
  disks: string[];
  macs: string[];
  cpu: string | null;
  gpu: string | null;
};

/**
 * HMAC-SHA256 de cada identificador con AC_HWID_SALT: la base nunca ve los valores, y sin la sal no sirven fuera de CMLeague.
 * Los genéricos se descartan. Devuelve null si no hay sal o no vino nada útil.
 */
export async function hashMachine(salt: string | undefined, hw: unknown): Promise<MachineHashes | null> {
  if (!salt || !hw || typeof hw !== 'object') return null;
  const key = await crypto.subtle.importKey('raw', enc.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = async (kind: string, v: unknown) => {
    const n = norm(v);
    if (GENERIC.has(n) || /^(.)\1+$/.test(n)) return null;
    return hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${kind}:${n}`)));
  };
  const many = async (kind: string, v: unknown) =>
    Array.isArray(v) ? ([...new Set(await Promise.all(v.slice(0, 8).map((x) => mac(kind, x))))].filter(Boolean) as string[]) : [];
  const h = hw as Record<string, unknown>;
  const out: MachineHashes = {
    smbios: await mac('smbios', h.smbios),
    board: await mac('board', h.board),
    machine_guid: await mac('machine_guid', h.machine_guid),
    disks: await many('disk', h.disks),
    macs: await many('mac', h.macs),
    cpu: await mac('cpu', h.cpu),
    gpu: await mac('gpu', h.gpu),
  };
  const useful = out.smbios || out.board || out.machine_guid || out.disks.length || out.macs.length;
  return useful ? out : null;
}
