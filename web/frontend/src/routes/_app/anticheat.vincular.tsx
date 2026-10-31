import { useMutation } from "@tanstack/react-query"
import { Link, createFileRoute } from "@tanstack/react-router"
import { CheckCircle2Icon, ShieldCheckIcon } from "lucide-react"
import { z } from "zod"

import { errorMessage } from "@/api/errors"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { approveAgent } from "@/features/anticheat/queries"

const searchSchema = z.object({
  code: z
    .string()
    .regex(/^[A-Z2-9]{8}$/)
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute("/_app/anticheat/vincular")({
  validateSearch: searchSchema,
  component: VincularPage,
})

function VincularPage() {
  const { code } = Route.useSearch()
  const approve = useMutation({ mutationFn: approveAgent })

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <ShieldCheckIcon className="size-12 text-primary" aria-hidden />
        <h1 className="text-2xl font-bold">Vincular CMLeague Anticheat</h1>
      </div>

      {!code ? (
        <Alert>
          <AlertDescription>
            Abre esta página con el botón de la aplicación CMLeague Anticheat.
          </AlertDescription>
        </Alert>
      ) : approve.isSuccess ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border p-6 text-center">
          <CheckCircle2Icon className="size-8 text-win" aria-hidden />
          <p className="font-semibold">{approve.data.device_name} quedó vinculada</p>
          <p className="text-sm text-muted-foreground">
            Ya puedes volver a la aplicación y entrar a un servidor.
          </p>
        </div>
      ) : (
        <>
          <p className="text-center text-sm text-muted-foreground">
            Aprueba solo si el código es el mismo que muestra la aplicación en
            tu PC. Si no abriste la aplicación recién, cierra esta página.
          </p>
          <p className="rounded-xl border p-5 text-center font-mono text-3xl font-bold tracking-widest text-primary">
            {code}
          </p>
          {approve.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {errorMessage(approve.error)}{" "}
                <Link to="/profile/link" className="underline">
                  Vincular mi SteamID
                </Link>
              </AlertDescription>
            </Alert>
          )}
          <Button
            size="lg"
            disabled={approve.isPending}
            onClick={() => approve.mutate(code)}
          >
            Aprobar este equipo
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Durante tus sesiones en servidores de CMLeague, la aplicación envía
            capturas del juego y la lista de programas abiertos. El staff las
            revisa y se guardan 30 días.
          </p>
        </>
      )}
    </div>
  )
}
