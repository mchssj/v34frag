import { AppError } from './errors';

// Lo mismo que acepta el bucket avatars en Supabase (file_size_limit y allowed_mime_types).
export const AVATAR_MAX_BYTES = 1024 * 1024;

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
