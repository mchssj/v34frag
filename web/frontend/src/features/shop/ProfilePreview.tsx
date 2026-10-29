import { cn } from "cn"
import { ImageUpIcon, Trash2Icon } from "lucide-react"
import { useRef } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { FramedAvatar, NameFx, Stickers, VipBadge } from "./cosmetics"
import type { ShopDemo } from "./demo"
import { KINDS } from "./types"

// Cómo se ve la ficha pública con la portada y lo equipado, y el editor de la portada (Mi perfil).
export function ProfilePreview({ shop, alias }: { shop: ShopDemo; alias: string }) {
  const file = useRef<HTMLInputElement>(null)
  const e = shop.visible
  const theme = e.theme ? shop.byId[e.theme] : null

  // Igual que la web: recorta a 1200 × 300. Acá queda en memoria, sin subir nada.
  async function pick(f: File) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) {
      toast.error("La portada tiene que ser JPG, PNG, WebP o GIF.")
      return
    }
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      const W = 1200
      const H = 300
      const c = document.createElement("canvas")
      c.width = W
      c.height = H
      const r = Math.max(W / img.width, H / img.height)
      const sw = W / r
      const sh = H / r
      c.getContext("2d")!.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H)
      URL.revokeObjectURL(url)
      shop.setCover(c.toDataURL("image/jpeg", 0.85))
      toast.success("¡Portada actualizada!")
    }
    img.src = url
  }

  return (
    <div className="flex flex-col gap-6">
      <section className={cn("overflow-hidden rounded-xl border bg-card", theme?.css_class)}>
        <div
          className="h-48 bg-muted bg-cover bg-center"
          style={
            shop.cover
              ? { backgroundImage: `url("${shop.cover}")` }
              : { backgroundImage: "linear-gradient(120deg,var(--primary),transparent 70%)" }
          }
        />
        <div className="-mt-16 flex flex-wrap items-end gap-5 px-6 pb-6">
          <FramedAvatar alias={alias} frame={e.frame ? shop.byId[e.frame] : null} size={150} />
          <div className="min-w-0 pb-2">
            <div className="flex items-center gap-2 text-3xl font-black text-primary">
              <NameFx text={alias} effect={e.name ? shop.byId[e.name] : null} />
              {shop.vip && <VipBadge />}
            </div>
            <p className="text-sm text-muted-foreground">Entry fragger · Argentina · ELO 1420 · Nivel 7</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {[
                ["K/D", "1,31"],
                ["Rating", "1,18"],
                ["G/P", "84/64"],
              ].map(([k, v]) => (
                <span key={k} className="rounded-md border bg-muted px-2 py-1">
                  {k} <b className="text-primary">{v}</b>
                </span>
              ))}
            </div>
          </div>
          <Stickers
            className="ml-auto pb-2"
            size={60}
            items={e.stickers.map((s) => shop.byId[s]).filter(Boolean)}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-bold">Mi perfil · Portada y personalización</h2>
        <p className="text-xs text-muted-foreground">
          Se recorta a 1200 × 300 px y se muestra arriba de tu perfil. Un admin la puede quitar si no
          respeta las reglas.
        </p>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(ev) => {
            const f = ev.target.files?.[0]
            if (f) void pick(f)
            ev.target.value = ""
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => file.current?.click()}>
            <ImageUpIcon /> Subir portada
          </Button>
          {shop.cover && (
            <Button size="sm" variant="outline" onClick={() => shop.setCover(null)}>
              <Trash2Icon /> Quitar portada
            </Button>
          )}
        </div>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {(["frame", "theme", "name"] as const).map((k) => (
            <li key={k}>
              <span className="text-muted-foreground">{KINDS[k].replace(/s$/, "")}: </span>
              {e[k] ? shop.byId[e[k]!]?.name : "nada"}
            </li>
          ))}
          <li>
            <span className="text-muted-foreground">Stickers: </span>
            {e.stickers.length ? e.stickers.map((s) => shop.byId[s]?.name).join(", ") : "ninguno"}
          </li>
        </ul>
      </section>
    </div>
  )
}
