import { describe, expect, it } from 'vitest';
import { hashMachine, heartbeatText, sha256Hex, signatureOk } from '../../src/services/anticheat';

const SALT = 'sal-de-prueba-con-mas-de-32-caracteres-1234';

describe('hashMachine (replanteo 157)', () => {
  it('sin sal no devuelve nada', async () => {
    expect(await hashMachine(undefined, { smbios: 'abc' })).toBeNull();
  });

  it('pasa cada identificador por HMAC y descarta los genéricos', async () => {
    const h = await hashMachine(SALT, {
      smbios: '4C4C4544-0042-3510-8051-B4C04F4E4D32',
      board: 'To be filled by O.E.M.',
      machine_guid: 'a1b2c3d4-0000-1111-2222-333344445555',
      disks: ['S4EVNX0N123456', 'S4EVNX0N123456', ''],
      macs: ['00d861aabbcc'],
      cpu: 'AMD Ryzen 5 5600X 6-Core Processor',
      gpu: '0000000000',
    });
    expect(h).not.toBeNull();
    expect(h!.smbios).toMatch(/^[0-9a-f]{64}$/);
    expect(h!.smbios).not.toContain('4c4c4544');
    expect(h!.board).toBeNull();
    expect(h!.gpu).toBeNull();
    expect(h!.disks).toHaveLength(1);
    expect(h!.macs).toHaveLength(1);
  });

  it('es estable, ignora mayúsculas y espacios, y cambia con la sal', async () => {
    const a = await hashMachine(SALT, { smbios: ' ABC-123 ' });
    const b = await hashMachine(SALT, { smbios: 'abc-123' });
    const c = await hashMachine(`${SALT}x`, { smbios: 'abc-123' });
    expect(a!.smbios).toBe(b!.smbios);
    expect(a!.smbios).not.toBe(c!.smbios);
  });

  it('el mismo valor en otro campo da otro hash', async () => {
    const h = await hashMachine(SALT, { smbios: 'igual', board: 'igual' });
    expect(h!.smbios).not.toBe(h!.board);
  });

  it('sin nada útil devuelve null', async () => {
    expect(await hashMachine(SALT, { board: 'Default string', cpu: 'Intel', gpu: 'NVIDIA' })).toBeNull();
  });
});

describe('firma del latido (replanteo 156)', () => {
  it('heartbeatText no lleva el token en claro', async () => {
    const t = await heartbeatText(1764200000, 'fraga_secreto');
    expect(t).toBe(`v1|hb|1764200000|${await sha256Hex('fraga_secreto')}`);
    expect(t).not.toContain('secreto');
  });

  it('verifica una firma P-256 como la del agente y rechaza otra', async () => {
    const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
    const pub = btoa(String.fromCharCode(...raw));
    const text = await heartbeatText(1764200000, 'fraga_x');
    const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, new TextEncoder().encode(text)));
    const b64 = btoa(String.fromCharCode(...sig));
    expect(await signatureOk(pub, b64, text)).toBe(true);
    expect(await signatureOk(pub, b64, text.replace('1764200000', '1764200001'))).toBe(false);
    expect(await signatureOk('no-es-una-clave', b64, text)).toBe(false);
  });
});
