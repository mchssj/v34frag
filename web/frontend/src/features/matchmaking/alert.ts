import { useEffect, useState } from "react"

// Avisos con sonido y notificación del navegador (si la pestaña está en segundo plano): partida
// encontrada e invitación al grupo.
//
// Los navegadores no dejan sonar audio hasta que la persona toca la página (plan, decisión
// "Sonido bloqueado"): se usa un solo AudioContext que se activa con el primer clic o tecla.

let ctx: AudioContext | null = null
const listeners = new Set<() => void>()

function audio(): AudioContext | null {
  if (ctx) return ctx
  try {
    ctx = new AudioContext()
    ctx.onstatechange = () => listeners.forEach((fn) => fn())
  } catch {
    // Sin WebAudio: quedan las notificaciones.
  }
  return ctx
}

/** Activa el audio. Tiene que llamarse desde un clic o una tecla. */
export function unlockAudio() {
  void audio()?.resume()
}

/** Si el navegador ya deja sonar; activa el audio con la primera interacción con la página. */
export function useAudioReady() {
  const [ready, setReady] = useState(() => audio()?.state === "running")
  useEffect(() => {
    const update = () => setReady(audio()?.state === "running")
    listeners.add(update)
    const onFirst = () => unlockAudio()
    window.addEventListener("pointerdown", onFirst, { once: true })
    window.addEventListener("keydown", onFirst, { once: true })
    return () => {
      listeners.delete(update)
      window.removeEventListener("pointerdown", onFirst)
      window.removeEventListener("keydown", onFirst)
    }
  }, [])
  return ready
}

/** Pide el permiso una sola vez, al entrar a la cola (tiene que ser después de un clic). */
export function askNotificationPermission() {
  if (typeof Notification === "undefined") return
  if (Notification.permission === "default")
    void Notification.requestPermission()
}

export function alertMatchFound() {
  tones([880, 1320], 0.18)
  notify("Partida encontrada", "Tenés 20 segundos para aceptar.", "mm-found")
}

export function alertInvite(from: string) {
  // Tres tonos que suben, distintos a los de la partida encontrada.
  tones([660, 880, 990], 0.12)
  notify(
    "Invitación al grupo",
    `${from} te invitó a jugar en grupo.`,
    "mm-invite"
  )
}

function notify(title: string, body: string, tag: string) {
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "granted" &&
    document.hidden
  )
    new Notification(title, { body, tag })
}

function tones(freqs: number[], step: number) {
  const ac = audio()
  if (!ac || ac.state !== "running") return
  freqs.forEach((freq, i) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.frequency.value = freq
    gain.gain.value = 0.08
    osc.connect(gain).connect(ac.destination)
    osc.start(ac.currentTime + i * step)
    osc.stop(ac.currentTime + i * step + step * 0.8)
  })
}
