/**
 * Efectos de cambio de tema: flashbang (a claro) y smoke (a oscuro). Port de
 * `theme-fx.reference.js` del handoff; tiempos y valores en segundos desde el clic.
 */
import { getSample, type SampleName } from "./samples"

export type FxRun = {
  /** Cambia el tema; el efecto lo llama en el momento justo (pico blanco o pantalla tapada). */
  applyTheme: () => void
  sound: boolean
  onEnd: () => void
}

type Audio = { ac: AudioContext; out: GainNode; now: number }

const MASTER_GAIN = 0.55

// Un AudioContext por efecto; se cierra al terminar. Sin soporte, el efecto sigue sin sonido.
function createAudio(sound: boolean): Audio | null {
  if (!sound) return null
  const Ctx =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctx) return null
  try {
    const ac = new Ctx()
    const out = ac.createGain()
    out.gain.value = MASTER_GAIN
    out.connect(ac.destination)
    return { ac, out, now: ac.currentTime }
  } catch {
    return null
  }
}

function noiseBuffer(ac: AudioContext, dur: number, decay = 0) {
  const n = Math.floor(ac.sampleRate * dur)
  const b = ac.createBuffer(1, n, ac.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < n; i++)
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay)
  return b
}

/** Sample precargado en `at`. Con `dur`: pleno hasta el 55% y baja a 0 en `dur`. false si no está. */
function sample(
  a: Audio,
  name: SampleName,
  at: number,
  vol: number,
  rate = 1,
  dur = 0
) {
  const raw = getSample(name)
  if (!raw) return false
  a.ac
    .decodeAudioData(raw.slice(0))
    .then((b) => {
      const s = a.ac.createBufferSource()
      const g = a.ac.createGain()
      s.buffer = b
      s.playbackRate.value = rate
      g.gain.value = vol
      s.connect(g).connect(a.out)
      const t = Math.max(a.ac.currentTime, at)
      s.start(t)
      if (dur) {
        g.gain.setValueAtTime(vol, t + dur * 0.55)
        g.gain.linearRampToValueAtTime(0.0001, t + dur)
        s.stop(t + dur + 0.02)
      }
    })
    .catch(() => {})
  return true
}

function tone(
  a: Audio,
  t: number,
  f: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine"
) {
  const o = a.ac.createOscillator()
  const g = a.ac.createGain()
  o.type = type
  o.frequency.value = f
  g.gain.setValueAtTime(0, a.now + t)
  g.gain.linearRampToValueAtTime(vol, a.now + t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, a.now + t + dur)
  o.connect(g).connect(a.out)
  o.start(a.now + t)
  o.stop(a.now + t + dur + 0.05)
}

function env(a: Audio, node: GainNode, t: number, v: number, dec: number) {
  node.gain.setValueAtTime(0.0001, a.now + t)
  node.gain.exponentialRampToValueAtTime(v, a.now + t + 0.002)
  node.gain.exponentialRampToValueAtTime(0.0001, a.now + t + dec)
}

/** Ruido lowpass con caída (estallido de la flashbang). */
function burst(
  a: Audio,
  t: number,
  dur: number,
  f: number,
  q: number,
  vol: number,
  decay: number
) {
  const s = a.ac.createBufferSource()
  s.buffer = noiseBuffer(a.ac, dur, decay)
  const fl = a.ac.createBiquadFilter()
  fl.type = "lowpass"
  fl.frequency.value = f
  fl.Q.value = q
  const g = a.ac.createGain()
  g.gain.value = vol
  s.connect(fl).connect(g).connect(a.out)
  s.start(a.now + t)
}

/** Silbido de lanzamiento: ruido bandpass con barrido de frecuencia. */
function sweep(
  a: Audio,
  t: number,
  dur: number,
  f0: number,
  f1: number,
  vol: number
) {
  const s = a.ac.createBufferSource()
  s.buffer = noiseBuffer(a.ac, dur)
  const fl = a.ac.createBiquadFilter()
  fl.type = "bandpass"
  fl.Q.value = 1.2
  fl.frequency.setValueAtTime(f0, a.now + t)
  fl.frequency.exponentialRampToValueAtTime(f1, a.now + t + dur)
  const g = a.ac.createGain()
  g.gain.setValueAtTime(0, a.now + t)
  g.gain.linearRampToValueAtTime(vol, a.now + t + dur * 0.55)
  g.gain.linearRampToValueAtTime(0, a.now + t + dur)
  s.connect(fl).connect(g).connect(a.out)
  s.start(a.now + t)
  s.stop(a.now + t + dur)
}

/** Rebote sintetizado (respaldo de grenade_hit1). */
function tick(a: Audio, t: number, f: number, vol: number, dur: number) {
  const o = a.ac.createOscillator()
  const g = a.ac.createGain()
  o.type = "triangle"
  o.frequency.setValueAtTime(f * 1.04, a.now + t)
  o.frequency.exponentialRampToValueAtTime(f, a.now + t + 0.02)
  env(a, g, t, vol, dur)
  o.connect(g).connect(a.out)
  o.start(a.now + t)
  o.stop(a.now + t + dur + 0.03)

  const o2 = a.ac.createOscillator()
  const g2 = a.ac.createGain()
  o2.frequency.value = f * 2.02
  env(a, g2, t, vol * 0.3, dur * 0.6)
  o2.connect(g2).connect(a.out)
  o2.start(a.now + t)
  o2.stop(a.now + t + dur + 0.03)

  const c = a.ac.createBufferSource()
  c.buffer = noiseBuffer(a.ac, 0.008)
  const cf = a.ac.createBiquadFilter()
  cf.type = "bandpass"
  cf.frequency.value = f * 3
  cf.Q.value = 1.5
  const cg = a.ac.createGain()
  env(a, cg, t, vol * 0.9, 0.01)
  c.connect(cf).connect(cg).connect(a.out)
  c.start(a.now + t)
}

/** Ruido filtrado con envolvente de puntos [segundos, volumen] (respaldo de la smoke). */
function shapedNoise(
  a: Audio,
  t: number,
  dur: number,
  type: BiquadFilterType,
  f: number,
  q: number,
  points: [number, number][]
) {
  const s = a.ac.createBufferSource()
  s.buffer = noiseBuffer(a.ac, dur)
  const fl = a.ac.createBiquadFilter()
  fl.type = type
  fl.frequency.value = f
  fl.Q.value = q
  const g = a.ac.createGain()
  g.gain.setValueAtTime(0, a.now + t)
  for (const [dt, v] of points)
    g.gain.linearRampToValueAtTime(v, a.now + t + dt)
  s.connect(fl).connect(g).connect(a.out)
  s.start(a.now + t)
  s.stop(a.now + t + dur)
}

/** Flashbang (~4,5 s): el tema cambia a claro en el pico blanco (0,9 s). */
export function flashbang({ applyTheme, sound, onEnd }: FxRun) {
  const a = createAudio(sound)
  if (a) {
    sweep(a, 0.12, 0.24, 350, 1300, 0.08)
    const bounces: [number, number][] = [
      [0.4, 1],
      [0.53, 0.6],
      [0.62, 0.36],
      [0.68, 0.2],
    ]
    bounces.forEach(([t, v], i) => {
      if (!sample(a, "bounce", a.now + t, 0.9 * v, 1 - i * 0.02))
        tick(a, t, 860 - i * 35, 0.08 * v, 0.075)
    })
    burst(a, 0.75, 1.4, 1800, 0.7, 0.9, 3)
    burst(a, 0.75, 0.25, 9000, 0.5, 0.35, 4)
    tone(a, 0.75, 55, 0.6, 0.5)
    // Pitido de aturdimiento: dos senos cercanos que baten.
    tone(a, 0.85, 3600, 3.2, 0.05)
    tone(a, 0.85, 3640, 3.2, 0.03)
  }

  const overlay = document.createElement("div")
  overlay.setAttribute("aria-hidden", "true")
  overlay.dataset.themeFx = "flashbang"
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:9999;pointer-events:none;background:#fff;opacity:0;backdrop-filter:blur(0px)"
  document.body.appendChild(overlay)
  const body = document.body.style

  setTimeout(() => {
    overlay.style.opacity = "1"
    overlay.style.backdropFilter = "blur(14px)"
  }, 750)
  setTimeout(() => {
    applyTheme()
    body.transition = "none"
    body.filter = "blur(10px) brightness(1.4)"
  }, 900)
  setTimeout(() => {
    overlay.style.transition =
      "opacity 2600ms cubic-bezier(.2,.6,.3,1), backdrop-filter 2600ms ease-out"
    overlay.style.opacity = "0"
    overlay.style.backdropFilter = "blur(0px)"
    body.transition = "filter 2800ms cubic-bezier(.2,.6,.3,1)"
    body.filter = "blur(0px) brightness(1)"
  }, 1500)
  setTimeout(() => {
    overlay.remove()
    body.filter = ""
    body.transition = ""
    onEnd()
    void a?.ac.close()
  }, 4500)
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)

/** Humo difuso: ~10 gradientes radiales teñidos, dibujado una sola vez. */
function smokeSprite() {
  const c0 = document.createElement("canvas")
  c0.width = c0.height = 128
  const c = c0.getContext("2d")
  if (!c) return c0
  for (let i = 0; i < 10; i++) {
    const x = 64 + (Math.random() - 0.5) * 44
    const y = 64 + (Math.random() - 0.5) * 44
    const r = 26 + Math.random() * 30
    const g = c.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, "rgba(255,255,255,.4)")
    g.addColorStop(1, "rgba(255,255,255,0)")
    c.fillStyle = g
    c.fillRect(0, 0, 128, 128)
  }
  c.globalCompositeOperation = "source-in"
  c.fillStyle = "#b4b8be"
  c.fillRect(0, 0, 128, 128)
  return c0
}

/** Smoke (~2,6 s): el tema cambia a oscuro cuando el velo tapa la pantalla. */
export function smoke({ applyTheme, sound, onEnd }: FxRun) {
  const a = createAudio(sound)
  if (a) {
    const bounces: [number, number][] = [
      [0.18, 1],
      [0.3, 0.5],
    ]
    bounces.forEach(([t, v], i) => {
      if (!sample(a, "bounce", a.now + t, 0.9 * v, 0.97 - i * 0.02))
        tone(a, t, 850 - i * 90, 0.07, 0.07 * v, "triangle")
    })
    if (!getSample("explode")) {
      tone(a, 0.38, 90, 0.2, 0.25)
      shapedNoise(a, 0.38, 0.12, "lowpass", 1200, 0.7, [
        [0.005, 0.4],
        [0.12, 0],
      ])
    }
    if (!sample(a, "explode", a.now + 0.38, 1, 1, 1.6)) {
      shapedNoise(a, 0.4, 2.4, "bandpass", 2400, 0.6, [
        [0.12, 0.55],
        [1.2, 0.35],
        [2.4, 0],
      ])
      shapedNoise(a, 0.4, 2.4, "highpass", 6000, 0.5, [
        [0.15, 0.12],
        [1.2, 0.07],
        [2.4, 0],
      ])
    }
  }
  const closeAudio = () => a && setTimeout(() => void a.ac.close(), 4000)

  // A media resolución: el humo es difuso y así rinde mejor.
  const S = 0.5
  const W = window.innerWidth
  const H = window.innerHeight
  const cv = document.createElement("canvas")
  cv.setAttribute("aria-hidden", "true")
  cv.dataset.themeFx = "smoke"
  cv.width = Math.ceil(W * S)
  cv.height = Math.ceil(H * S)
  cv.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;z-index:9999;pointer-events:none;will-change:opacity"
  const ctx = cv.getContext("2d")
  if (!ctx) {
    applyTheme()
    onEnd()
    closeAudio()
    return
  }
  document.body.appendChild(cv)
  ctx.scale(S, S)

  const sprite = smokeSprite()
  const ox = W / 2
  const oy = H * 0.68
  const D = Math.hypot(W, H)
  const particles = Array.from({ length: 70 }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = D * (0.25 + Math.random() * 0.75)
    return {
      delay: Math.random() * 0.3,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * 0.8,
      r0: 30 + Math.random() * 40,
      r1: D * (0.12 + Math.random() * 0.14),
    }
  })

  let switched = false
  // El humo arranca con el estallido (0,38 s).
  const t0 = performance.now() + 380
  const frame = (now: number) => {
    const t = (now - t0) / 1000
    if (t < 0) {
      requestAnimationFrame(frame)
      return
    }
    if (!switched && t > 0.75) {
      switched = true
      applyTheme()
    }
    ctx.clearRect(0, 0, W, H)
    const veil =
      t < 0.35
        ? 0
        : t < 0.75
          ? clamp01((t - 0.35) / 0.4) * 0.92
          : t < 0.95
            ? 0.92
            : 0.92 * (1 - easeOutCubic(clamp01((t - 0.95) / 0.9)))
    if (veil > 0) {
      ctx.globalAlpha = veil
      ctx.fillStyle = "#a7abb1"
      ctx.fillRect(0, 0, W, H)
    }
    const fade = 1 - clamp01((t - 1.0) / 1.2)
    for (const p of particles) {
      const k = easeOutCubic(clamp01((t - p.delay) / 1.1))
      if (k <= 0) continue
      const r = p.r0 + (p.r1 - p.r0) * k
      ctx.globalAlpha = Math.min(1, k * 4) * fade
      ctx.drawImage(
        sprite,
        ox + p.vx * k - r,
        oy + p.vy * k - r - t * 30,
        r * 2,
        r * 2
      )
    }
    ctx.globalAlpha = 1
    if (t < 2.25) {
      requestAnimationFrame(frame)
      return
    }
    cv.remove()
    onEnd()
    closeAudio()
  }
  requestAnimationFrame(frame)
}
