import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"
import { afterEach, beforeEach } from "vitest"

import { tokenStore } from "@/auth/tokenStore"
import { session } from "./fakes"

export function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const user = userEvent.setup()
  return {
    user,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    ),
  }
}

/**
 * Pruebas con sesión: las consultas de la cuenta (`/me/profile`, `/me/teams`) no se piden sin ella,
 * porque las páginas públicas también las usan.
 */
export function withSession() {
  beforeEach(() => tokenStore.setState({ session: session(1) }))
  afterEach(() => tokenStore.setState({ session: null }))
}
