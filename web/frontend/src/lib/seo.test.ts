import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useCanonical, usePageMeta } from "./seo"

const meta = (sel: string) =>
  document.head.querySelector<HTMLMetaElement>(`meta[${sel}]`)?.content

describe("usePageMeta", () => {
  it("pone título y descripción y al salir deja los de antes", () => {
    document.title = "CM League · Liga"
    const { unmount } = renderHook(() =>
      usePageMeta({
        title: "Ranking",
        description: "Los mejores",
        noindex: true,
      })
    )
    expect(document.title).toBe("Ranking · CM League")
    expect(meta('name="description"')).toBe("Los mejores")
    expect(meta('property="og:title"')).toBe("Ranking · CM League")
    expect(meta('name="robots"')).toBe("noindex")
    unmount()
    expect(document.title).toBe("CM League · Liga")
    expect(meta('name="robots"')).toBe("")
  })
})

describe("useCanonical", () => {
  it("usa la ruta sin la barra final", () => {
    renderHook(() => useCanonical("/ranking/"))
    expect(
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
        ?.href
    ).toBe("https://cmleague.lat/ranking")
    expect(meta('property="og:url"')).toBe("https://cmleague.lat/ranking")
  })
})
