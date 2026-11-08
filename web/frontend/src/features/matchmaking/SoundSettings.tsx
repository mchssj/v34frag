import { cn } from "cn"
import {
  CheckIcon,
  LockIcon,
  PlayIcon,
  SettingsIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import { useRef } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { previewSound } from "./alert"
import { useMmMutation } from "./queries"
import { useMmSource } from "./source"
import type { MmState } from "./types"

// Sonido de partida encontrada (plan, decisión "Sonidos de partida"): todos eligen entre los que
// subieron los admins; los VIP, además, pueden subir el suyo, que solo escuchan ellos.

export const SOUND_ACCEPT = "audio/mpeg,audio/ogg,audio/wav"

export function SoundSettingsDialog({ sounds }: { sounds: MmState["sounds"] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SettingsIcon aria-hidden />
          Configuración
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sonido de partida encontrada</DialogTitle>
          <DialogDescription>
            Suena cuando te sale una partida.
          </DialogDescription>
        </DialogHeader>
        <SoundSettings sounds={sounds} />
      </DialogContent>
    </Dialog>
  )
}

function SoundSettings({ sounds }: { sounds: MmState["sounds"] }) {
  const source = useMmSource()
  const select = useMmMutation((id: string | null) => source.setSound(id))
  const upload = useMmMutation((file: File) => source.uploadMySound(file))
  const remove = useMmMutation(() => source.deleteMySound())
  const input = useRef<HTMLInputElement>(null)
  const options = [
    { id: null, name: "Predeterminado", url: null },
    ...sounds.catalog,
  ]
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {options.map((s) => (
          <SoundRow
            key={s.id ?? "default"}
            name={s.name}
            url={s.url}
            selected={sounds.selected === s.id}
            onSelect={() => select.mutate(s.id)}
          />
        ))}
      </ul>
      <div className="flex flex-col gap-2 border-t pt-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          Tu sonido <Badge variant="vip">VIP</Badge>
        </h3>
        {!sounds.can_upload ? (
          <p className="inline-flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
            <LockIcon aria-hidden className="size-4 text-muted-foreground" />
            Subir tu propio sonido es exclusivo para VIP
          </p>
        ) : sounds.custom ? (
          <ul>
            <SoundRow
              name={sounds.custom.name}
              url={sounds.custom.url}
              selected={sounds.selected === sounds.custom.id}
              onSelect={() => select.mutate(sounds.custom!.id)}
              onDelete={() => remove.mutate(undefined)}
            />
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            MP3, OGG o WAV, hasta 1 MB. Suena 10 segundos como máximo.
          </p>
        )}
        {sounds.can_upload && (
          <>
            <input
              ref={input}
              type="file"
              hidden
              accept={SOUND_ACCEPT}
              aria-label="Archivo de tu sonido"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ""
                if (file)
                  upload.mutate(file, {
                    onError: (err) => toast.error(errorMessage(err)),
                  })
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              disabled={upload.isPending}
              onClick={() => input.current?.click()}
            >
              <UploadIcon aria-hidden />
              {sounds.custom ? "Cambiar mi sonido" : "Subir mi sonido"}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function SoundRow({
  name,
  url,
  selected,
  onSelect,
  onDelete,
}: {
  name: string
  url: string | null
  selected: boolean
  onSelect: () => void
  onDelete?: () => void
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded-lg pr-1",
        selected && "bg-primary/10"
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] font-medium hover:bg-muted/60"
      >
        <span className="truncate">{name}</span>
        {selected && (
          <CheckIcon aria-hidden className="size-4 shrink-0 text-primary" />
        )}
      </button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Escuchar ${name}`}
        onClick={() => previewSound(url)}
      >
        <PlayIcon />
      </Button>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Borrar ${name}`}
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      )}
    </li>
  )
}
