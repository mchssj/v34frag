import { THEME_FX_SOUNDS } from "@/config/site"

export type SampleName = keyof typeof THEME_FX_SOUNDS

const buffers: Partial<Record<SampleName, ArrayBuffer>> = {}
let started = false

/** Precarga los samples una sola vez. Si alguno falta, los efectos usan el sintetizado. */
export function preloadSamples() {
  if (started) return
  started = true
  for (const [name, url] of Object.entries(THEME_FX_SOUNDS)) {
    fetch(url)
      .then((r) => {
        // Vite responde index.html (200) para un archivo que no existe: se exige audio.
        const type = r.headers.get("content-type") ?? ""
        if (!r.ok || !type.startsWith("audio/")) throw new Error(url)
        return r.arrayBuffer()
      })
      .then((b) => {
        buffers[name as SampleName] = b
      })
      .catch(() => {})
  }
}

export function getSample(name: SampleName) {
  return buffers[name]
}
