import { AppError } from './errors';

// Lo propio animado (bitácora docs/bitacora/2026-11-13-avatar-y-fondo-propios): el avatar y el fondo animados que sube
// cada VIP se pasan a WebM (VP9, sin audio) con una imagen fija en WebP, como los avatares de la tienda. La conversión
// la hace ffmpeg y solo existe en Node (lib/media-node.ts, la pasa node.ts); el Worker no la tiene.

/** Lo que entra: GIF, PNG o WebP animados, o un video MP4 o WebM. Hasta 8 MB. */
export const ANIMATED_MAX_BYTES = 8 * 1024 * 1024;
/** Lo que sale, por archivo: lo que acepta el bucket cosmetics (file_size_limit). */
export const COSMETICS_MAX_BYTES = 3 * 1024 * 1024;
/** Hasta 10 segundos: el resto se corta. */
export const ANIMATED_MAX_SECONDS = 10;

export type SourceType = { ext: 'gif' | 'png' | 'webp' | 'mp4' | 'webm'; video: boolean };

/** Recorte en píxeles de la imagen original (el frontend lo arma con el recuadro que elige el jugador). */
export type Crop = { x: number; y: number; w: number; h: number };

export type AnimateOptions = {
  /** Tamaño final, en píxeles pares. */
  width: number;
  height: number;
  /** Sin recorte, se toma el centro con la proporción final. */
  crop?: Crop;
  maxSeconds: number;
};

export type MediaConverter = {
  /** ffmpeg está instalado (se mira una vez). */
  available(): Promise<boolean>;
  /** El WebM en bucle y su imagen fija. Si la animación no se puede leer, AppError 400. */
  animate(input: Uint8Array, source: SourceType, o: AnimateOptions): Promise<{ video: Uint8Array; poster: Uint8Array }>;
};

/** Tipo real según los primeros bytes. No se confía en el Content-Type ni en la extensión. */
export function sniffAnimated(b: Uint8Array): SourceType | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((x, k) => b[i + k] === x);
  const ascii = (i: number, s: string) => [...s].every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (ascii(0, 'GIF87a') || ascii(0, 'GIF89a')) return { ext: 'gif', video: false };
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { ext: 'png', video: false };
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return { ext: 'webp', video: false };
  if (ascii(4, 'ftyp')) return { ext: 'mp4', video: true };
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return { ext: 'webm', video: true };
  return null;
}

/** Lee el archivo animado: tamaño y tipo. */
export async function readAnimated(file: File): Promise<{ bytes: Uint8Array; type: SourceType }> {
  if (file.size === 0) throw new AppError(400, 'INVALID_FILE', 'El archivo está vacío.');
  if (file.size > ANIMATED_MAX_BYTES) {
    throw new AppError(413, 'FILE_TOO_LARGE', `El archivo pesa más de ${ANIMATED_MAX_BYTES / 1024 / 1024} MB.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffAnimated(bytes);
  if (!type) throw new AppError(400, 'INVALID_FILE', 'Tiene que ser un GIF, un PNG o WebP animado, o un video MP4 o WebM.');
  return { bytes, type };
}

/** El recorte del formulario: los cuatro números o ninguno. */
export function parseCrop(v: { crop_x?: number; crop_y?: number; crop_w?: number; crop_h?: number }): Crop | undefined {
  const all = [v.crop_x, v.crop_y, v.crop_w, v.crop_h];
  if (all.every((n) => n === undefined)) return undefined;
  if (all.some((n) => n === undefined)) throw new AppError(400, 'VALIDATION_ERROR', 'El recorte necesita crop_x, crop_y, crop_w y crop_h.');
  const [x, y, w, h] = all as number[];
  if (w! < 16 || h! < 16) throw new AppError(400, 'VALIDATION_ERROR', 'El recorte es demasiado chico.');
  return { x: x!, y: y!, w: w!, h: h! };
}

/**
 * Los filtros de ffmpeg: recorte (el pedido, sin salirse de la imagen, o el centro con la proporción final), escala al
 * tamaño final y yuv420p (lo que pide VP9 en los navegadores).
 */
export function filterChain(o: AnimateOptions): string {
  const ratio = o.width / o.height;
  const crop = o.crop
    ? `crop=w='min(${o.crop.w},iw)':h='min(${o.crop.h},ih)':x='min(${o.crop.x},iw-ow)':y='min(${o.crop.y},ih-oh)'`
    : `crop=w='min(iw,trunc(ih*${ratio.toFixed(6)}))':h='min(ih,trunc(iw/${ratio.toFixed(6)}))'`;
  return `${crop},scale=${o.width}:${o.height}:flags=lanczos,format=yuv420p`;
}
