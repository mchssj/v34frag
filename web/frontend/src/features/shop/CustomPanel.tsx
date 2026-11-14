import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { FilmIcon, ImageUpIcon, LockIcon, Trash2Icon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { AvatarCropDialog } from "@/features/profile/components/AvatarCropDialog"
import {
  checkAvatarSource,
  cropImage,
  ImageError,
  type CropArea,
} from "@/lib/image"

import {
  customOptions,
  useDeleteCustom,
  useEquip,
  useUploadCustom,
} from "./api"
import { AvatarMedia, CardBackground, MINI_CARD_ASPECT } from "./cosmetics"
import type { CustomKind, CustomMedia, Points } from "./types"

// Lo propio (bitácoras 2026-11-13-avatar-y-fondo-propios y 2026-11-14-inventario-de-lo-propio): cada jugador sube su
// fondo de miniperfil fijo (puntos) y, siendo VIP, su avatar y su fondo animados (monedas VIP). Se paga cada vez que
// se sube uno; lo subido queda guardado (hasta un tope por tipo) y ponerse cualquiera de los guardados no cuesta. Lo
// animado se recorta en el servidor (ffmpeg); el fondo fijo, acá.

/** Lo que acepta la API para lo animado (lib/media.ts): hasta 8 MB. */
const ANIMATED_TYPES = [
  "image/gif",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
]
const ANIMATED_MAX = 8 * 1024 * 1024
/** El fondo fijo se recorta acá con la forma de la tarjeta de Jugar (1:2), a 480×960. */
const BG_SIZE = { width: 480, height: 960 }

const num = (n: number) => n.toLocaleString("es")

type Pending = { animated: boolean; file: File; src: string; video: boolean }
type Ready = Pending & { blob: Blob; crop?: CropArea }

export function CustomPanel({
  kind,
  vip,
  points,
  onVip,
}: {
  kind: CustomKind
  vip: boolean
  points: Points | undefined
  onVip: () => void
}) {
  const q = useQuery(customOptions)
  const upload = useUploadCustom()
  const remove = useDeleteCustom()
  const equip = useEquip()
  const input = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<boolean>(true)
  const [pending, setPending] = useState<Pending | null>(null)
  const [ready, setReady] = useState<Ready | null>(null)
  const [deleting, setDeleting] = useState<CustomMedia | null>(null)

  useEffect(() => {
    const src = pending?.src
    return () => {
      if (src) URL.revokeObjectURL(src)
    }
  }, [pending?.src])

  if (!q.data) return null
  const saved = q.data[kind]
  const max = q.data.max[kind]
  const full = saved.length >= max
  const prices = q.data.prices
  const can = q.data.animated_available
  const isAvatar = kind === "avatar"
  const what = isAvatar ? "avatares" : "fondos de miniperfil"

  function choose(animated: boolean) {
    setMode(animated)
    if (input.current) {
      input.current.accept = animated
        ? ANIMATED_TYPES.join(",")
        : "image/jpeg,image/png,image/webp"
      input.current.value = ""
      input.current.click()
    }
  }

  function picked(file: File | undefined) {
    if (!file) return
    try {
      if (mode) {
        if (!ANIMATED_TYPES.includes(file.type))
          throw new ImageError(
            "Tiene que ser un GIF, un PNG o WebP animado, o un video MP4 o WebM."
          )
        if (file.size > ANIMATED_MAX)
          throw new ImageError("El archivo pesa más de 8 MB.")
      } else checkAvatarSource(file)
      setPending({
        animated: mode,
        file,
        src: URL.createObjectURL(file),
        video: file.type.startsWith("video/"),
      })
    } catch (e) {
      toast.error(e instanceof ImageError ? e.message : errorMessage(e))
    }
  }

  async function cropped(area: CropArea) {
    const p = pending
    if (!p) return
    try {
      // Lo animado va entero con el recuadro; el fondo fijo se recorta acá (hasta 2 MB).
      const blob = p.animated
        ? p.file
        : await cropImage(p.file, area, {
            ...BG_SIZE,
            maxBytes: 2 * 1024 * 1024,
          })
      setReady({ ...p, blob, crop: p.animated ? area : undefined })
    } catch (e) {
      toast.error(e instanceof ImageError ? e.message : errorMessage(e))
      setPending(null)
    }
  }

  function pay() {
    const r = ready
    if (!r) return
    const price = priceFor(kind, r.animated, prices)
    upload.mutate(
      {
        kind,
        file: r.blob,
        name: r.animated ? r.file.name : "fondo.jpg",
        price,
        animated: r.animated,
        crop: r.crop,
      },
      {
        onSuccess: (res) => {
          toast.success(
            `${isAvatar ? "Tu avatar" : "Tu fondo de miniperfil"} ya está puesto y guardado. Te quedan ${num(res.balance)} ${
              res.currency === "vip" ? "monedas VIP" : "puntos"
            }.`
          )
          setReady(null)
          setPending(null)
        },
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  }

  function wear(m: CustomMedia | null) {
    equip.mutate(
      { [kind]: m ? `custom:${m.id}` : null },
      {
        onSuccess: () =>
          toast.success(
            m ? "Te lo pusiste." : "Te lo sacaste. Sigue guardado."
          ),
        onError: (e) => toast.error(errorMessage(e)),
      }
    )
  }

  function erase() {
    const m = deleting
    if (!m) return
    remove.mutate(m.id, {
      onSuccess: () => {
        toast.success(
          isAvatar
            ? "Borraste ese avatar."
            : "Borraste ese fondo de miniperfil."
        )
        setDeleting(null)
      },
      onError: (e) => toast.error(errorMessage(e)),
    })
  }

  const lockedAnimated = !vip
  const fullHint = `Llegaste a ${max} ${what} guardados: borra uno para subir otro.`
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-[60ch] flex-col gap-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ImageUpIcon aria-hidden className="size-4 text-primary" />
            {isAvatar ? "Tus avatares animados" : "Tus fondos de miniperfil"}
            <span className="font-mono text-xs font-normal text-muted-foreground tabular-nums">
              {saved.length} de {max}
            </span>
          </h3>
          <p className="text-xs text-pretty text-muted-foreground">
            {isAvatar
              ? "Sube un GIF o un video corto y reemplaza tu foto en tu perfil, en el lobby y en las filas. Es para los VIP."
              : "Sube tu propia imagen para el fondo de tu tarjeta en el grupo de Jugar. Fijo, con puntos; animado, siendo VIP."}{" "}
            Se paga cada vez que subes uno, y queda guardado: puedes volver a
            cualquiera sin pagar. Si lo denuncian y no respeta las reglas, se
            saca sin devolver lo pagado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isAvatar && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => choose(false)}
              disabled={upload.isPending || full}
              title={full ? fullHint : undefined}
            >
              <ImageUpIcon /> Subir fondo fijo · {num(prices.background_static)}{" "}
              pts
            </Button>
          )}
          <Button
            size="sm"
            variant={isAvatar ? "default" : "outline"}
            onClick={() => (lockedAnimated ? onVip() : choose(true))}
            disabled={upload.isPending || (!lockedAnimated && (!can || full))}
            title={
              !can
                ? "La subida de animaciones no está disponible por ahora."
                : full
                  ? fullHint
                  : undefined
            }
          >
            {lockedAnimated ? <LockIcon /> : <FilmIcon />}
            {isAvatar ? "Subir avatar" : "Subir fondo animado"} ·{" "}
            {num(isAvatar ? prices.avatar : prices.background_animated)} VIP
          </Button>
        </div>
      </div>
      {!can && vip && (
        <p className="text-xs text-muted-foreground">
          La subida de animaciones no está disponible por ahora.
        </p>
      )}
      {full && <p className="text-xs text-muted-foreground">{fullHint}</p>}

      {saved.length ? (
        <ul className="flex flex-wrap gap-3">
          {saved.map((m) => (
            <li
              key={m.id}
              className={cn(
                "flex w-[112px] flex-col items-center gap-1.5 rounded-lg border bg-background/60 p-2",
                m.equipped &&
                  "border-primary shadow-[inset_0_0_0_1px_var(--primary)]"
              )}
            >
              <Thumb media={m} />
              <span className="text-center text-[11px] leading-tight text-muted-foreground">
                {m.animated ? "Animado" : "Fijo"} ·{" "}
                {new Date(m.created_at).toLocaleDateString("es", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
              {m.equipped && <Badge>Puesto</Badge>}
              {!m.visible && (
                <span className="inline-flex items-center gap-1 text-center text-[11px] leading-tight text-[#e8b53a]">
                  <LockIcon className="size-3 shrink-0" /> Vuelve siendo VIP
                </span>
              )}
              <div className="flex items-center gap-1">
                {m.equipped ? (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => wear(null)}
                    disabled={equip.isPending}
                  >
                    Sacármelo
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    onClick={() => wear(m)}
                    disabled={equip.isPending || !m.visible}
                  >
                    Ponérmelo
                  </Button>
                )}
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Borrar"
                  title="Borrar"
                  onClick={() => setDeleting(m)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          {isAvatar
            ? "Todavía no subiste un avatar."
            : "Todavía no subiste un fondo de miniperfil."}
        </p>
      )}

      <input
        ref={input}
        type="file"
        className="hidden"
        aria-label={isAvatar ? "Elegir avatar" : "Elegir fondo de miniperfil"}
        onChange={(e) => picked(e.target.files?.[0])}
      />

      {pending && !ready && (
        <AvatarCropDialog
          src={pending.src}
          video={pending.video}
          busy={false}
          shape="rect"
          aspect={isAvatar ? 1 : MINI_CARD_ASPECT}
          title={
            isAvatar ? "Encuadra tu avatar" : "Encuadra tu fondo de miniperfil"
          }
          description={
            (isAvatar
              ? ""
              : "Tiene la forma de tu tarjeta en el grupo de Jugar. ") +
            (pending.animated
              ? "Arrástralo y usa el zoom. Se usan los primeros 10 segundos, sin sonido."
              : "Arrástrala y usa el zoom para que quede como quieres.")
          }
          confirmLabel="Siguiente"
          onCancel={() => setPending(null)}
          onConfirm={(a) => void cropped(a)}
        />
      )}

      {ready && (
        <PayDialog
          kind={kind}
          ready={ready}
          price={priceFor(kind, ready.animated, prices)}
          points={points}
          saved={saved.length}
          max={max}
          busy={upload.isPending}
          onCancel={() => {
            setReady(null)
            setPending(null)
          }}
          onPay={pay}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isAvatar
                ? "¿Borrar este avatar?"
                : "¿Borrar este fondo de miniperfil?"}
            </DialogTitle>
            <DialogDescription>
              Se borra el archivo y no se devuelve lo que pagaste. Para volver a
              tenerlo, tienes que subirlo y pagarlo otra vez.
              {deleting?.equipped && " Ahora lo tienes puesto: te lo sacamos."}
            </DialogDescription>
          </DialogHeader>
          {deleting && (
            <div className="grid place-items-center">
              <Thumb media={deleting} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={erase}
              disabled={remove.isPending}
            >
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function priceFor(
  kind: CustomKind,
  animated: boolean,
  p: { avatar: number; background_animated: number; background_static: number }
) {
  return kind === "avatar"
    ? p.avatar
    : animated
      ? p.background_animated
      : p.background_static
}

/** Una subida, chica: el avatar cuadrado o el fondo con la forma de la tarjeta de Jugar (1:2). */
function Thumb({ media }: { media: CustomMedia }) {
  if (media.kind === "avatar")
    return (
      <AvatarMedia
        avatar={{ url: media.url, poster_url: media.poster_url }}
        className={cn(
          "size-20 rounded-xl border",
          !media.visible && "opacity-50"
        )}
      />
    )
  return (
    <div
      className={cn(
        "relative isolate aspect-[1/2] w-[64px] overflow-hidden rounded-lg border",
        !media.visible && "opacity-50"
      )}
    >
      <CardBackground src={media.url} poster={media.poster_url} />
    </div>
  )
}

/** Confirmación antes de pagar: el precio, lo que queda, el tope y la casilla de derechos. */
function PayDialog({
  kind,
  ready,
  price,
  points,
  saved,
  max,
  busy,
  onCancel,
  onPay,
}: {
  kind: CustomKind
  ready: Ready
  price: number
  points: Points | undefined
  saved: number
  max: number
  busy: boolean
  onCancel: () => void
  onPay: () => void
}) {
  const [rights, setRights] = useState(false)
  const [preview] = useState(() =>
    ready.animated ? ready.src : URL.createObjectURL(ready.blob)
  )
  useEffect(
    () => () => {
      if (!ready.animated) URL.revokeObjectURL(preview)
    },
    [preview, ready.animated]
  )
  const vipCoins = ready.animated
  const balance =
    (vipCoins ? points?.vip_coins.balance : points?.points.balance) ?? 0
  const unit = vipCoins ? "monedas VIP" : "puntos"
  const short = balance < price
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {kind === "avatar"
              ? "¿Subir este avatar?"
              : ready.animated
                ? "¿Subir este fondo de miniperfil animado?"
                : "¿Subir este fondo de miniperfil?"}
          </DialogTitle>
          <DialogDescription>
            Cuesta {num(price)} {unit}.{" "}
            {short
              ? `Te faltan ${num(price - balance)} ${unit}.`
              : `Te quedan ${num(balance - price)} ${unit}.`}{" "}
            Se te pone solo y queda guardado ({saved + 1} de {max}).
            {saved > 0 && " Los que ya subiste siguen guardados."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid place-items-center overflow-hidden rounded-lg border bg-muted/40 p-3">
          {ready.video ? (
            <video
              src={preview}
              className="max-h-48 rounded"
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            <img
              src={preview}
              alt=""
              className={cn(
                "max-h-48 rounded",
                kind === "background" && !ready.animated && "aspect-[1/2]"
              )}
            />
          )}
          {ready.animated && (
            <span className="mt-2 text-[11px] text-muted-foreground">
              Se recorta como lo encuadraste al subirlo.
            </span>
          )}
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="custom-rights"
            checked={rights}
            onCheckedChange={(v) => setRights(v === true)}
          />
          <Label
            htmlFor="custom-rights"
            className="text-sm leading-snug font-normal"
          >
            Tengo derecho a usar esta imagen: es mía o tengo permiso de quien la
            hizo. Sé que si la denuncian y no respeta las reglas, se saca sin
            devolver lo que pagué.
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onPay} disabled={!rights || short || busy}>
            {busy ? "Subiendo..." : `Pagar ${num(price)} y subir`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
