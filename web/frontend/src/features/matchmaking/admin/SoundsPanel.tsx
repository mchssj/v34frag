import { useQuery } from "@tanstack/react-query"
import { PlayIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { previewSound } from "../alert"
import { useMmAdminMutation } from "../queries"
import { useMmSource } from "../source"
import { SOUND_ACCEPT } from "../SoundSettings"

// Los sonidos de partida encontrada entre los que eligen los jugadores. Sin límite de cantidad.
export function SoundsPanel() {
  const source = useMmSource()
  const { data: sounds = [] } = useQuery({
    queryKey: ["mm", "admin", "sounds"],
    queryFn: ({ signal }) => source.adminSounds(signal),
  })
  const [name, setName] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const upload = useMmAdminMutation((file: File) =>
    source.uploadSound(name.trim(), file)
  )
  const remove = useMmAdminMutation((id: string) => source.deleteSound(id))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Nombre del sonido"
          placeholder="Nombre del sonido"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          className="h-8 max-w-64"
        />
        <input
          ref={input}
          type="file"
          hidden
          accept={SOUND_ACCEPT}
          aria-label="Archivo del sonido"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file)
              upload.mutate(file, {
                onSuccess: () => setName(""),
                onError: (err) => toast.error(errorMessage(err)),
              })
          }}
        />
        <Button
          size="sm"
          disabled={!name.trim() || upload.isPending}
          onClick={() => input.current?.click()}
        >
          <UploadIcon aria-hidden />
          Subir sonido
        </Button>
        <span className="text-xs text-muted-foreground">
          MP3, OGG o WAV, hasta 1 MB.
        </span>
      </div>
      {sounds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay sonidos. Los jugadores escuchan el predeterminado.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {sounds.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium"
            >
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Escuchar ${s.name}`}
                onClick={() => previewSound(s.url)}
              >
                <PlayIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Borrar ${s.name}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(s.id)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
