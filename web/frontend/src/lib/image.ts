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
  /**
   * El área puede salirse de la foto (se alejó en el recortador): lo que sobra se rellena con la
   * misma foto agrandada, difuminada y oscurecida.
   */
  fill?: boolean
}

/** Pinta la foto agrandada para cubrir todo el canvas, difuminada y oscurecida: el fondo del relleno. */
function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number
) {
  // Un poco más grande que el canvas, para que el difuminado no aclare los bordes.
  const margin = 0.08
  const s =
    Math.max(width / img.naturalWidth, height / img.naturalHeight) *
    (1 + margin * 2)
  const w = img.naturalWidth * s
  const h = img.naturalHeight * s
  ctx.save()
  // Safari viejo no difumina el canvas: ahí queda solo oscurecida.
  ctx.filter = `blur(${Math.round(width / 60)}px)`
  ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h)
  ctx.restore()
  ctx.fillStyle = "rgb(0 0 0 / 0.45)"
  ctx.fillRect(0, 0, width, height)
}

/**
 * Recorta `area` (el encuadre que eligió la persona) al tamaño pedido. JPEG por defecto (Safari
 * viejo no genera WebP y devuelve PNG sin avisar); baja la calidad si hace falta para no pasar de
 * `maxBytes`.
 */
export async function cropImage(
  file: File,
  area: CropArea,
  { width, height, maxBytes, png, fill }: CropOptions
): Promise<Blob> {
  checkAvatarSource(file)
  const img = await loadImage(file)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new ImageError("Tu navegador no permite procesar imágenes.")
  // La parte del área que cae dentro de la foto; sin `fill`, el área está siempre adentro.
  const x0 = Math.max(area.x, 0)
  const y0 = Math.max(area.y, 0)
  const x1 = Math.min(area.x + area.width, img.naturalWidth)
  const y1 = Math.min(area.y + area.height, img.naturalHeight)
  const sx = width / area.width
  const sy = height / area.height
  const inside =
    x0 <= area.x &&
    y0 <= area.y &&
    x1 >= area.x + area.width &&
    y1 >= area.y + area.height
  if (fill && !inside) {
    paintBackdrop(ctx, img, width, height)
    if (x1 > x0 && y1 > y0)
      ctx.drawImage(
        img,
        x0,
        y0,
        x1 - x0,
        y1 - y0,
        (x0 - area.x) * sx,
        (y0 - area.y) * sy,
        (x1 - x0) * sx,
        (y1 - y0) * sy
      )
  } else {
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
  }
  if (png) {
    const blob = await toBlob(canvas, "image/png")
    if (blob?.type === "image/png" && blob.size <= maxBytes) return blob
  }
  for (const quality of [0.9, 0.8, 0.7, 0.6]) {
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

/** Banner de un torneo: 1600×400 (el backend acepta 4:1 entre 800×200 y 2400×600), hasta 4 MB. */
export const cropBanner = (file: File, area: CropArea) =>
  cropImage(file, area, { width: 1600, height: 400, maxBytes: 4 * 1024 * 1024 })

/** Imagen del inicio de sesión: 1600×2000 (4:5) en JPEG, hasta 1,5 MB (el backend acepta 4 MB). */
export const AUTH_IMAGE_SIZE = { width: 1600, height: 2000 }
export const cropAuthImage = (file: File, area: CropArea) =>
  cropImage(file, area, { ...AUTH_IMAGE_SIZE, maxBytes: 1.5 * 1024 * 1024 })

/** Logo del equipo: 512×512 (el backend acepta de 128 a 1024, cuadrado), hasta 2 MB. */
export const LOGO_SIZE = 512
export const cropLogo = (file: File, area: CropArea) =>
  cropImage(file, area, {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    maxBytes: 2 * 1024 * 1024,
    png: true,
  })
