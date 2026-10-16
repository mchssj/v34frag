import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"

import { meQueryOptions, type AuthUser, type Role } from "./queries"
import { safeRedirect } from "./redirect"
import { tokenStore } from "./tokenStore"

export class ForbiddenError extends Error {
  constructor() {
    super("No tienes permiso para ver esta página.")
    this.name = "ForbiddenError"
  }
}

type GuardArgs = {
  context: { queryClient: QueryClient }
  location: { href: string }
}

async function loadUser(queryClient: QueryClient): Promise<AuthUser | null> {
  // Espera breve a otras pestañas solo si esta no tiene sesión guardada.
  await tokenStore.ready()
  return queryClient.ensureQueryData({
    ...meQueryOptions,
    revalidateIfStale: true,
  })
}

/**
 * Exige sesión. Sin sesión (o sesión vencida) manda al login; un error de red o del servidor
 * se relanza para que lo muestre el errorComponent (no se manda al login por una API caída).
 */
export async function requireAuth({ context, location }: GuardArgs) {
  const user = await loadUser(context.queryClient)
  if (!user)
    throw redirect({ to: "/ingresar", search: { redirect: location.href } })
  return { user }
}

/** Páginas de cuenta: con sesión, se sale a `redirect` o al inicio. */
export async function requireGuest({
  context,
  search,
}: {
  context: { queryClient: QueryClient }
  search: { redirect?: string }
}) {
  let user: AuthUser | null
  try {
    user = await loadUser(context.queryClient)
  } catch {
    // Con la API caída se muestra igual la página de login.
    return
  }
  if (user) throw redirect({ href: safeRedirect(search.redirect) })
}

/** Exige un rol. beforeLoad no puede dibujar: lanza ForbiddenError y lo muestra el errorComponent. */
export function requireRole(...roles: Role[]) {
  return ({ context }: { context: { user: AuthUser } }) => {
    if (!roles.includes(context.user.role)) throw new ForbiddenError()
  }
}
