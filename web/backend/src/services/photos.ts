// Logos de equipos y banners de torneos en el bucket photos (replanteo 33). La política de Storage deja escribir al
// capitán en teams/<equipo>/, a quien pide un equipo en team-requests/<su id>/ y al organizador en events/<torneo>/.
import type { Context } from 'hono';
import { inBackground } from '../lib/background';
import { checkShape, readImage, storageError, type ImageShape } from '../lib/uploads';
import type { AppEnv } from '../lib/types';

export const PHOTOS = 'photos';
const MARKER = `/storage/v1/object/public/${PHOTOS}/`;

/** Valida la imagen (tipo, peso y medidas) y la sube a la carpeta. Devuelve la URL pública y la ruta (para deshacer). */
export async function savePhoto(c: Context<AppEnv>, folder: string, file: File, maxBytes: number, shape: ImageShape) {
  const { bytes, type } = await readImage(file, maxBytes);
  checkShape(bytes, type, shape);
  const bucket = c.var.sb.storage.from(PHOTOS);
  // Nombre nuevo en cada subida: la URL cambia y el navegador no muestra la imagen vieja.
  const path = `${folder}/${Date.now()}.${type.ext}`;
  const up = await bucket.upload(path, bytes, { contentType: type.mime, upsert: false });
  if (up.error) throw storageError(up.error);
  return { url: bucket.getPublicUrl(path).data.publicUrl, path };
}

/** Borra un archivo recién subido (cuando falla el guardado de su URL). */
export async function dropPhoto(c: Context<AppEnv>, path: string) {
  await c.var.sb.storage.from(PHOTOS).remove([path]);
}

/** Borra del bucket una foto que ya no se usa, sin demorar la respuesta. Ignora las URL que no son del bucket. */
export function removePhoto(c: Context<AppEnv>, url: string | null | undefined) {
  if (!url?.includes(MARKER)) return;
  const path = decodeURIComponent(url.slice(url.indexOf(MARKER) + MARKER.length));
  inBackground(
    c,
    c.var.sb.storage.from(PHOTOS).remove([path]).then((r) => {
      if (r.error) throw new Error(`borrar foto ${path}: ${r.error.message}`);
    }),
  );
}
