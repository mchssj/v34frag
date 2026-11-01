import type { AnchorHTMLAttributes, ReactNode } from "react"
import { vi } from "vitest"

/** `useNavigate` de las pruebas del ranking: se revisa con qué búsqueda se llamó. */
export const navigate = vi.fn()

/** Router simulado: `Link` como `<a href>` y `useNavigate` espiado. Para `vi.mock`. */
export async function mockRouter(
  orig: () => Promise<typeof import("@tanstack/react-router")>
) {
  return {
    ...(await orig()),
    useNavigate: () => navigate,
    Link: ({
      to,
      children,
      params,
      ...rest
    }: { to: string; params?: unknown; children: ReactNode } & Omit<
      AnchorHTMLAttributes<HTMLAnchorElement>,
      "href"
    >) => {
      void params
      return (
        <a href={to} {...rest}>
          {children}
        </a>
      )
    },
  }
}
