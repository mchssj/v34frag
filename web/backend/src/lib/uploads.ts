import { AppError } from './errors';

// Lo mismo que acepta el bucket avatars en Supabase (file_size_limit y allowed_mime_types).
export const AVATAR_MAX_BYTES = 1024 * 1024;
// Fotos de la maestra de mapas (bucket photos, sin límite propio: lo pone la API).
export const MAP_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
// Logo de un equipo y banner de un torneo (bucket photos, replanteo 33).
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const BANNER_MAX_BYTES = 4 * 1024 * 1024;

export type ImageType = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' };

/** Tipo real de la imagen según sus primeros bytes. No se confía en el Content-Type ni en la extensión. */
export function sniffImage(b: Uint8Array): ImageType | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((x, k) => b[i + k] === x);
  if (at(0, 0xff, 0xd8, 0xff)) return { mime: 'image/jpeg', ext: 'jpg' };
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: 'image/png', ext: 'png' };
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/** Lee el archivo y valida tamaño y tipo. Devuelve los bytes y el tipo detectado. */
export async function readImage(file: File, maxBytes: number): Promise<{ bytes: Uint8Array; type: ImageType }> {
  if (file.size === 0) throw new AppError(400, 'INVALID_FILE', 'El archivo está vacío.');
  if (file.size > maxBytes) {
    throw new AppError(413, 'FILE_TOO_LARGE', `La imagen pesa más de ${Math.round(maxBytes / 1024)} KB.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) throw new AppError(400, 'INVALID_FILE', 'La imagen tiene que ser JPG, PNG o WebP.');
  return { bytes, type };
}

/** Traduce un error de Supabase Storage. */
export function storageError(e: { message: string; statusCode?: string | number }): AppError {
  const status = Number(e.statusCode ?? 0);
  if (status === 413) return new AppError(413, 'FILE_TOO_LARGE', 'La imagen pesa más de lo permitido.');
  if (status === 415 || /mime/i.test(e.message)) return new AppError(400, 'INVALID_FILE', 'La imagen tiene que ser JPG, PNG o WebP.');
  if (status === 401 || status === 403) return new AppError(403, 'FORBIDDEN', 'No tienes permiso para subir ese archivo.');
  return new AppError(500, 'INTERNAL', 'No se pudo guardar la imagen.');
}

/** Ancho y alto según la cabecera del PNG, JPG o WebP, sin librerías. null si no se puede leer. */
export function imageSize(b: Uint8Array, type: ImageType): { width: number; height: number } | null {
  const u16be = (i: number) => (b[i]! << 8) | b[i + 1]!;
  const u32be = (i: number) => ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
  if (type.ext === 'png') return b.length >= 24 ? { width: u32be(16), height: u32be(20) } : null;
  if (type.ext === 'jpg') {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1]!;
      if (m === 0xff) {
        i++;
        continue;
      }
      // SOF0 a SOF15 (sin DHT, JPG y DAC): ahí están las medidas.
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { width: u16be(i + 7), height: u16be(i + 5) };
      if ((m >= 0xd0 && m <= 0xd9) || m === 0x01) {
        i += 2;
        continue;
      }
      i += 2 + u16be(i + 2);
    }
    return null;
  }
  if (b.length < 30) return null;
  const chunk = String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!);
  if (chunk === 'VP8 ') return { width: (b[26]! | (b[27]! << 8)) & 0x3fff, height: (b[28]! | (b[29]! << 8)) & 0x3fff };
  if (chunk === 'VP8L') {
    return {
      width: 1 + (((b[22]! & 0x3f) << 8) | b[21]!),
      height: 1 + (((b[24]! & 0x0f) << 10) | (b[23]! << 2) | ((b[22]! & 0xc0) >> 6)),
    };
  }
  if (chunk === 'VP8X') return { width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
  return null;
}

export type ImageShape = { what: string; ratio: number; tolerance: number; shape: string; min: [number, number]; max: [number, number] };
// El frontend recorta antes de subir: acá solo se valida.
export const LOGO_SHAPE: ImageShape = { what: 'El logo', ratio: 1, tolerance: 0.02, shape: 'cuadrado', min: [128, 128], max: [1024, 1024] };
export const BANNER_SHAPE: ImageShape = { what: 'El banner', ratio: 4, tolerance: 0.05, shape: 'de proporción 4:1', min: [800, 200], max: [2400, 600] };

/** Valida la proporción y las medidas de la imagen. */
export function checkShape(bytes: Uint8Array, type: ImageType, s: ImageShape): void {
  const size = imageSize(bytes, type);
  if (!size || !size.width || !size.height) throw new AppError(400, 'INVALID_FILE', 'No se pudieron leer las medidas de la imagen.');
  const { width: w, height: h } = size;
  if (Math.abs(w / h / s.ratio - 1) > s.tolerance) throw new AppError(400, 'INVALID_FILE', `${s.what} tiene que ser ${s.shape} (llegó de ${w}×${h}).`);
  if (w < s.min[0] || h < s.min[1] || w > s.max[0] || h > s.max[1]) {
    throw new AppError(
      400,
      'INVALID_FILE',
      `${s.what} tiene que medir entre ${s.min[0]}×${s.min[1]} y ${s.max[0]}×${s.max[1]} (llegó de ${w}×${h}).`,
    );
  }
}
