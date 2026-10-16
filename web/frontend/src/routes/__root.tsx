import type { QueryClient } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import {
  Link,
  Outlet,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

import { AuthSync } from "@/auth/AuthSync"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { RouteError } from "@/components/RouteError"

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RouteError,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <>
      <AuthSync />
      <Outlet />
      <Toaster richColors position="top-center" />
      {import.meta.env.DEV && (
        <>
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools buttonPosition="bottom-left" />
        </>
      )}
    </>
  )
}

function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-heading text-2xl font-semibold">
        Página no encontrada
      </h1>
      <p className="text-muted-foreground">
        La dirección no existe o se movió.
      </p>
      <Button asChild>
        <Link to="/">Ir al inicio</Link>
      </Button>
    </main>
  )
}
