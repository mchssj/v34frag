// Tokens ES256 de prueba, firmados como los de Supabase Auth (clave asimétrica con kid).
const b64url = (data: ArrayBuffer | Uint8Array | string) =>
  Buffer.from(typeof data === 'string' ? data : new Uint8Array(data as ArrayBuffer)).toString('base64url');

export type TestKey = { kid: string; privateKey: CryptoKey; jwk: JsonWebKey & { kid: string; alg: string } };

export async function makeKey(kid = 'clave-de-prueba'): Promise<TestKey> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { kid, privateKey: pair.privateKey, jwk: { ...pub, kid, alg: 'ES256', use: 'sig', key_ops: ['verify'] } };
}

export async function signToken(key: TestKey, claims: Record<string, unknown>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: key.kid }));
  const payload = b64url(JSON.stringify({ iat: now, exp: now + 3600, aud: 'authenticated', ...claims }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key.privateKey, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(sig)}`;
}

export const userClaims = (id: string, extra: Record<string, unknown> = {}) => ({
  sub: id,
  role: 'authenticated',
  email: `${id}@test.local`,
  ...extra,
});
