import type { QueryClient } from "@tanstack/react-query"
import { redirect } from "@tanstack/react-router"

import {
  adminSectionOf,
  canAccessAdminSection,
  canSeeAdmin,
} from "./permissions"
import { meQueryOptions, type AuthUser } from "./queries"
import { safeRedirect } from "./redirect"
import { tokenStore } from "./tokenStore"

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
    throw redirect({ to: "/login", search: { redirect: location.href } })
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
  if (user) throw redirect({ href: safeRedirect(search.redirect, "/home") })
}

/**
 * Landing: solo para visitantes. Sin sesión guardada no espera a otras pestañas (un visitante
 * nunca espera); si otra pestaña comparte una sesión, AuthSync re-ejecuta la guarda.
 */
export async function redirectIfSignedIn({
  context,
}: {
  context: { queryClient: QueryClient }
}) {
  if (!tokenStore.getState().session) return
  let user: AuthUser | null
  try {
    user = await context.queryClient.ensureQueryData(meQueryOptions)
  } catch {
    return
  }
  if (user) throw redirect({ to: "/home" })
}

/**
 * Administración: el admin entra a todas las secciones y el organizador solo a Torneos (si pide
 * otra, vuelve ahí). El resto de los usuarios va al inicio.
 */
export function requireAdminSection({
  context,
  location,
}: {
  context: { user: AuthUser }
  location: { pathname: string }
}) {
  const { role } = context.user
  const section = adminSectionOf(location.pathname)
  if (section && canAccessAdminSection(role, section)) return
  throw redirect({ to: canSeeAdmin(role) ? "/admin/events" : "/home" })
}
