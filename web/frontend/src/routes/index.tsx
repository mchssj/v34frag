import { Link, createFileRoute } from "@tanstack/react-router"
import { useStore } from "zustand"

import { useMe } from "@/auth/queries"
import { tokenStore } from "@/auth/tokenStore"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/")({
  component: Landing,
})

// Provisoria: el diseño final llega con los artifacts.
function Landing() {
  const hasSession = useStore(tokenStore, (s) => s.session !== null)
  const { data: user } = useMe()

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="font-heading text-4xl font-bold tracking-tight">
        v34frag
      </h1>
      <p className="max-w-md text-muted-foreground">
        Mixes, torneos, PCW y ranking de la comunidad de Counter-Strike: Source
        v34.
      </p>
      {hasSession && user ? (
        <div className="flex flex-col items-center gap-3">
          <p>
            Hola,{" "}
            <span className="font-semibold">{user.tag ?? user.email}</span>
          </p>
          <Button asChild>
            <Link to="/panel">Ir al panel</Link>
          </Button>
        </div>
      ) : (
        <div className="flex gap-3">
          <Button asChild>
            <Link to="/ingresar" search={{}}>
              Ingresar
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/registro" search={{}}>
              Crear cuenta
            </Link>
          </Button>
        </div>
      )}
    </main>
  )
}
