import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// Sin globals de Vitest, Testing Library no desmonta solo entre pruebas.
afterEach(() => cleanup())

// jsdom no trae ResizeObserver y Radix lo usa (Checkbox, Select).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
