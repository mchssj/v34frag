import { Outlet, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { requireAuth } from "@/auth/guards"
import { useMe } from "@/auth/queries"
import { RouteError } from "@/components/RouteError"
import {
  SIDEBAR_COOKIE_NAME,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/features/shell/AppSidebar"
import { CommandMenu } from "@/features/shell/CommandMenu"
import { NowBar } from "@/features/shell/NowBar"
import { Topbar } from "@/features/shell/Topbar"
import { useSyncThemeFx } from "@/features/theme-fx/useSyncThemeFx"

export const Route = createFileRoute("/_app")({
  beforeLoad: requireAuth,
  errorComponent: RouteError,
  component: AppLayout,
})

/** Estado guardado del sidebar (cookie de shadcn); sin estado, colapsado en ventanas de menos de 900px. */
function initialSidebarOpen() {
  const saved = document.cookie.match(
    new RegExp(`(?:^|; )${SIDEBAR_COOKIE_NAME}=(true|false)`)
  )?.[1]
  return saved ? saved === "true" : window.innerWidth >= 900
}

// Shell de la app con sesión: sidebar, topbar, franja "ahora" y búsqueda ⌘K.
function AppLayout() {
  const initial = Route.useRouteContext({ select: (c) => c.user })
  // useMe se mantiene al día (por ejemplo, si cambia el rol); la guarda garantiza el primer valor.
  const user = useMe().data ?? initial
  useSyncThemeFx()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <SidebarProvider defaultOpen={initialSidebarOpen()}>
      <AppSidebar user={user} />
      <SidebarInset className="min-h-[calc(100svh-16px)] min-w-0 md:peer-data-[variant=inset]:shadow-[0_1px_3px_rgb(0_0_0/.06),0_0_0_1px_var(--border)]">
        <Topbar onSearch={() => setSearchOpen(true)} />
        <NowBar />
        <div className="flex flex-1 justify-center p-6">
          {/* Columna flex: una vista puede ocupar todo el alto con flex-1 (p. ej. "Sin equipo"). */}
          <div className="flex w-full max-w-[1320px] min-w-0 flex-col">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
      <CommandMenu user={user} open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  )
}
