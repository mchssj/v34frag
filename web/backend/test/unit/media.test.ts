import { describe, expect, it } from 'vitest';
import { filterChain, parseCrop, sniffAnimated } from '../../src/lib/media';

// Lo propio animado (bitácora docs/bitacora/2026-11-13-avatar-y-fondo-propios): qué entra y cómo se recorta.
const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((ch) => ch.charCodeAt(0)) : [x])));

describe('sniffAnimated', () => {
  it('reconoce GIF, PNG, WebP, MP4 y WebM por los primeros bytes', () => {
    expect(sniffAnimated(bytes('GIF89a', 0, 0))).toEqual({ ext: 'gif', video: false });
    expect(sniffAnimated(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toEqual({ ext: 'png', video: false });
    expect(sniffAnimated(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toEqual({ ext: 'webp', video: false });
    expect(sniffAnimated(bytes(0, 0, 0, 0x20, 'ftypisom'))).toEqual({ ext: 'mp4', video: true });
    expect(sniffAnimated(bytes(0x1a, 0x45, 0xdf, 0xa3, 0))).toEqual({ ext: 'webm', video: true });
  });

  it('lo demás no', () => {
    expect(sniffAnimated(bytes(0xff, 0xd8, 0xff, 0xe0))).toBeNull(); // JPEG
    expect(sniffAnimated(bytes('hola mundo'))).toBeNull();
  });
});

describe('parseCrop', () => {
  it('los cuatro o ninguno', () => {
    expect(parseCrop({})).toBeUndefined();
    expect(parseCrop({ crop_x: 1, crop_y: 2, crop_w: 100, crop_h: 100 })).toEqual({ x: 1, y: 2, w: 100, h: 100 });
    expect(() => parseCrop({ crop_x: 1 })).toThrow('crop_x, crop_y, crop_w y crop_h');
    expect(() => parseCrop({ crop_x: 0, crop_y: 0, crop_w: 8, crop_h: 8 })).toThrow('demasiado chico');
  });
});

describe('filterChain', () => {
  it('con recorte: sin salirse de la imagen, escala al tamaño final y yuv420p', () => {
    const f = filterChain({ width: 256, height: 256, crop: { x: 40, y: 0, w: 240, h: 240 }, maxSeconds: 10 });
    expect(f).toBe("crop=w='min(240,iw)':h='min(240,ih)':x='min(40,iw-ow)':y='min(0,ih-oh)',scale=256:256:flags=lanczos,format=yuv420p");
  });

  it('sin recorte: el centro con la proporción final (1:2 del fondo de miniperfil)', () => {
    const f = filterChain({ width: 256, height: 512, maxSeconds: 10 });
    expect(f).toContain("crop=w='min(iw,trunc(ih*0.500000))':h='min(ih,trunc(iw/0.500000))'");
    expect(f).toContain('scale=256:512');
  });
});
