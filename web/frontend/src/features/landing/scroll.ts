export type SectionId = "como-funciona" | "servidores" | "competencia"

/** Scroll a una sección (el header sticky se compensa con scroll-margin-top). */
export function scrollToSection(id: SectionId) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
}

export function scrollToTop() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
}
