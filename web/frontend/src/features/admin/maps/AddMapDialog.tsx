import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { newMapError, type DraftMap } from "./catalog"

/** Mapa nuevo: entra al borrador al final de la lista; se crea al guardar el catálogo. */
export function AddMapDialog({
  draft,
  onClose,
  onAdd,
}: {
  draft: DraftMap[]
  onClose: () => void
  onAdd: (m: DraftMap) => void
}) {
  const id = useId()
  const [name, setName] = useState("")
  const [mixes, setMixes] = useState(true)
  const [veto, setVeto] = useState(false)
  const n = name.trim().toLowerCase()
  const err = n ? newMapError(draft, n) : null

  function submit() {
    if (!n || err) return
    onAdd({ name: n, versions: [n], active: true, mixes, veto_default: veto })
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Agregar mapa</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-n`}>Nombre</Label>
            <Input
              id={`${id}-n`}
              value={name}
              placeholder="de_russka"
              className="font-mono"
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
            <span
              className={
                err
                  ? "text-xs text-destructive"
                  : "text-xs text-muted-foreground"
              }
            >
              {err ??
                (n
                  ? `Se va a llamar ${n} en toda la web.`
                  : "El nombre del .bsp, sin la extensión.")}
            </span>
          </div>
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2 text-sm font-medium">Dónde sale</legend>
            <Label className="font-normal">
              <Checkbox
                checked={mixes}
                onCheckedChange={(v) => setMixes(v === true)}
              />
              En el select de Mixes
            </Label>
            <Label className="font-normal">
              <Checkbox
                checked={veto}
                onCheckedChange={(v) => setVeto(v === true)}
              />
              En el pool por defecto del veto
            </Label>
          </fieldset>
          <p className="rounded-lg bg-muted px-3 py-2.5 text-[13px] leading-relaxed">
            Tiene que estar subido en los servidores con ese nombre de .bsp.
            Queda al final de la lista; la foto y otras versiones se agregan
            después de guardar el catálogo.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!n || !!err}>
              Agregar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
