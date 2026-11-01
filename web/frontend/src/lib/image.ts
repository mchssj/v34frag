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

function toBlob(
  canvas: HTMLCanvasElement,
  type: "image/jpeg" | "image/png",
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Área a recortar, en píxeles de la imagen original. */
export type CropArea = { x: number; y: number; width: number; height: number }

type CropOptions = {
  width: number
  height: number
  maxBytes: number
  /** PNG conserva la transparencia (logos); si pesa demasiado se pasa a JPEG. */
  png?: boolean
}

/**
 * Recorta `area` (el encuadre que eligió la persona) al tamaño pedido. JPEG por defecto (Safari
 * viejo no genera WebP y devuelve PNG sin avisar); baja la calidad si hace falta para no pasar de
 * `maxBytes`.
 */
export async function cropImage(
  file: File,
  area: CropArea,
  { width, height, maxBytes, png }: CropOptions
): Promise<Blob> {
  checkAvatarSource(file)
  const img = await loadImage(file)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new ImageError("Tu navegador no permite procesar imágenes.")
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    width,
    height
  )
  if (png) {
    const blob = await toBlob(canvas, "image/png")
    if (blob?.type === "image/png" && blob.size <= maxBytes) return blob
  }
  for (const quality of [0.9, 0.8, 0.7]) {
    const blob = await toBlob(canvas, "image/jpeg", quality)
    if (!blob || blob.type !== "image/jpeg")
      throw new ImageError("No se pudo procesar la imagen.")
    if (blob.size <= maxBytes) return blob
  }
  throw new ImageError(
    `La imagen sigue pesando más de ${Math.round(maxBytes / 1024 / 1024)} MB después de recortarla.`
  )
}

/** Foto de perfil: 256×256 en JPEG, hasta 1 MB. */
export const cropAvatar = (file: File, area: CropArea) =>
  cropImage(file, area, {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    maxBytes: AVATAR_MAX_BYTES,
  })

/** Logo del equipo: 512×512 (el backend acepta de 128 a 1024, cuadrado), hasta 2 MB. */
export const LOGO_SIZE = 512
export const cropLogo = (file: File, area: CropArea) =>
  cropImage(file, area, {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    maxBytes: 2 * 1024 * 1024,
    png: true,
  })
