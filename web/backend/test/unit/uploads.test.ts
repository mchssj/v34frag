import { describe, expect, it } from 'vitest';
import { BANNER_SHAPE, checkShape, imageSize, LOGO_SHAPE, sniffImage } from '../../src/lib/uploads';

const png = (w: number, h: number) => {
  const b = new Uint8Array(32);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
};

// JPG: SOI, un APP0 de 16 bytes y el SOF0 con alto y ancho.
const jpg = (w: number, h: number) =>
  new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0),
    0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);

const webp = (chunk: string, body: number[]) => {
  const b = new Uint8Array(40);
  b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
  b.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8);
  b.set([...chunk].map((c) => c.charCodeAt(0)), 12);
  b.set(body, 20);
  return b;
};

describe('imageSize', () => {
  it('PNG', () => expect(imageSize(png(512, 128), sniffImage(png(512, 128))!)).toEqual({ width: 512, height: 128 }));
  it('JPG (salta los segmentos hasta el SOF)', () => {
    const b = jpg(1600, 400);
    expect(imageSize(b, sniffImage(b)!)).toEqual({ width: 1600, height: 400 });
  });
  it('WebP con pérdida (VP8)', () => {
    // 6 bytes de frame tag y start code, después ancho y alto de 14 bits.
    const b = webp('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 256 & 0xff, 256 >> 8, 128 & 0xff, 128 >> 8]);
    expect(imageSize(b, sniffImage(b)!)).toEqual({ width: 256, height: 128 });
  });
  it('WebP sin pérdida (VP8L)', () => {
    // Firma 0x2f y 14 bits de ancho - 1 y de alto - 1.
    const w = 300 - 1;
    const h = 200 - 1;
    const bits = w | (h << 14);
    const b = webp('VP8L', [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff]);
    expect(imageSize(b, sniffImage(b)!)).toEqual({ width: 300, height: 200 });
  });
  it('WebP extendido (VP8X)', () => {
    const b = webp('VP8X', [0, 0, 0, 0, 1023 & 0xff, 1023 >> 8, 0, 255, 0, 0]);
    expect(imageSize(b, sniffImage(b)!)).toEqual({ width: 1024, height: 256 });
  });
  it('null si no se puede leer', () => expect(imageSize(new Uint8Array([0xff, 0xd8, 0xff]), { mime: 'image/jpeg', ext: 'jpg' })).toBeNull());
});

describe('checkShape', () => {
  const t = sniffImage(png(1, 1))!;
  it('acepta un logo cuadrado y un banner 4:1 dentro de las medidas', () => {
    expect(() => checkShape(png(256, 256), t, LOGO_SHAPE)).not.toThrow();
    expect(() => checkShape(png(1600, 400), t, BANNER_SHAPE)).not.toThrow();
  });
  it.each([
    [png(256, 200), LOGO_SHAPE, 'cuadrado'],
    [png(64, 64), LOGO_SHAPE, 'entre 128×128 y 1024×1024'],
    [png(2048, 2048), LOGO_SHAPE, 'entre 128×128 y 1024×1024'],
    [png(800, 400), BANNER_SHAPE, 'proporción 4:1'],
    [png(400, 100), BANNER_SHAPE, 'entre 800×200 y 2400×600'],
  ])('rechaza con INVALID_FILE (%#)', (bytes, shape, text) => {
    expect(() => checkShape(bytes, t, shape)).toThrow(expect.objectContaining({ status: 400, code: 'INVALID_FILE', message: expect.stringContaining(text) }));
  });
});
