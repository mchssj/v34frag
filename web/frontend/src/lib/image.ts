export const AVATAR_SIZE = 256
export const AVATAR_MAX_BYTES = 1024 * 1024
/** Límite del archivo original, antes de recortarlo. */
export const SOURCE_MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"]

export class ImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ImageError"
  }
}

/** Valida el archivo elegido antes de procesarlo. */
export function checkAvatarSource(file: File) {
  if (!ACCEPTED.includes(file.type))
    throw new ImageError("La imagen tiene que ser JPG, PNG o WebP.")
  if (file.size > SOURCE_MAX_BYTES)
    throw new ImageError("La imagen pesa más de 10 MB.")
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new ImageError("No se pudo leer la imagen."))
    }
    img.src = url
  })
}

function toJpeg(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
}

/**
 * Recorte cuadrado centrado a 256×256 en JPEG (siempre JPEG: Safari viejo no genera WebP
 * y devuelve PNG sin avisar). Baja la calidad si hace falta para no pasar de 1 MB.
 */
export async function cropAvatar(file: File): Promise<Blob> {
  checkAvatarSource(file)
  const img = await loadImage(file)
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  const canvas = document.createElement("canvas")
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new ImageError("Tu navegador no permite procesar imágenes.")
  ctx.drawImage(
    img,
    (img.naturalWidth - side) / 2,
    (img.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  )
  for (const quality of [0.9, 0.8, 0.7]) {
    const blob = await toJpeg(canvas, quality)
    if (!blob || blob.type !== "image/jpeg")
      throw new ImageError("No se pudo procesar la imagen.")
    if (blob.size <= AVATAR_MAX_BYTES) return blob
  }
  throw new ImageError(
    "La imagen sigue pesando más de 1 MB después de recortarla."
  )
}
