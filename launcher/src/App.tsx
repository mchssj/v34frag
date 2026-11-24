import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { api, getSession, login, logout, onSession, type Session } from "./api"
import { connectMm } from "./socket"
import { attention, connectLine, copyConnect, detectGame, launchGame, saveGameDir, savedGameDir, type GameInfo } from "./game"
import type { MmLobby, MmState } from "./types"

const WEB_URL = import.meta.env.VITE_WEB_URL ?? "https://cmleague.lat"

export function App() {
  const [session, setSession] = useState<Session | null>(getSession())
  useEffect(() => onSession(setSession), [])
  return session ? <Home /> : <Login />
}

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="center">
      <form className="card login" onSubmit={submit}>
        <h1>CMLeague</h1>
        <p className="muted">Iniciá sesión con tu cuenta de la web.</p>
        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Contraseña
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        <a href={`${WEB_URL}/signup`} target="_blank" rel="noreferrer">Crear una cuenta</a>
      </form>
    </main>
  )
}

/** Segundos que faltan hasta una fecha ISO. */
function useCountdown(iso: string | null | undefined) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!iso) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [iso])
  return iso ? Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000)) : null
}

function Home() {
  const [state, setState] = useState<MmState | null>(null)
  const [online, setOnline] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<string>("")
  const [region, setRegion] = useState<string>("")

  const load = useCallback(async () => {
    try {
      const live = await api<MmState>("GET", "/api/v1/mm/state/live")
      setState((prev) => ({ ...(prev ?? ({} as MmState)), ...live }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  // Estado completo una vez (modos y regiones) y después el liviano en cada evento del socket.
  useEffect(() => {
    void api<MmState>("GET", "/api/v1/mm/state").then(setState, (err) => setError(String(err?.message ?? err)))
    const stop = connectMm(() => void load(), setOnline)
    // Respaldo mientras el socket está caído, como la web.
    const poll = setInterval(() => { if (!onlineRef.current) void load() }, 5000)
    return () => {
      stop()
      clearInterval(poll)
    }
  }, [load])
  const onlineRef = useRef(online)
  onlineRef.current = online

  useEffect(() => {
    if (!mode && state?.modes?.length) setMode(state.modes[0].mode)
  }, [state?.modes, mode])

  const act = async (method: string, path: string, body?: unknown) => {
    setError(null)
    try {
      const next = await api<Partial<MmState>>(method, path, body)
      setState((prev) => ({ ...(prev ?? ({} as MmState)), ...next }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const lobby = state?.lobby ?? null
  const accepting = lobby?.status === "accepting" && !lobby.players.find((p) => p.is_me)?.accepted

  // Partida encontrada: ventana al frente y sonido hasta aceptar, rechazar o vencer.
  useEffect(() => {
    if (!accepting) return
    void attention(true)
    const audio = new Audio("/match.wav")
    audio.loop = true
    void audio.play().catch(() => undefined)
    return () => {
      audio.pause()
      void attention(false)
    }
  }, [accepting])

  return (
    <main>
      <header>
        <strong>CMLeague</strong>
        <span className={online ? "dot on" : "dot"} title={online ? "Conectado" : "Reconectando…"} />
        <span className="muted">
          {state ? `${state.queue_size} en cola · ${state.live_matches} en vivo` : "Cargando…"}
        </span>
        <span className="grow" />
        <a href={`${WEB_URL}/play`} target="_blank" rel="noreferrer">Abrir la web</a>
        <button className="link" onClick={() => void logout()}>Cerrar sesión</button>
      </header>

      {error && <p className="error banner">{error}</p>}
      {state?.penalty && (
        <p className="error banner">Tenés una sanción de la cola hasta {new Date(state.penalty.until).toLocaleString()}.</p>
      )}

      {lobby ? (
        <Lobby lobby={lobby} onAccept={() => act("POST", "/api/v1/mm/lobby/accept")} onDecline={() => act("POST", "/api/v1/mm/lobby/decline")} />
      ) : state?.queue ? (
        <Queue state={state} onLeave={() => act("DELETE", "/api/v1/mm/queue")} />
      ) : (
        <section className="card">
          <h2>Buscar partida</h2>
          {state && !state.open && <p className="muted">El matchmaking está cerrado ahora.</p>}
          <div className="row">
            <label>
              Modo
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                {state?.modes?.map((m) => <option key={m.mode} value={m.mode}>{m.mode}</option>)}
              </select>
            </label>
            {!!state?.regions?.length && (
              <label>
                Región
                <select value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option value="">Cualquiera</option>
                  {state.regions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            )}
          </div>
          <button className="primary big" disabled={!state?.open || !mode} onClick={() => act("POST", "/api/v1/mm/queue", { mode, region: region || null })}>
            Buscar partida
          </button>
        </section>
      )}

      <GameSetup />
    </main>
  )
}

function Queue({ state, onLeave }: { state: MmState; onLeave: () => void }) {
  const q = state.queue!
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const s = Math.max(0, Math.floor((now - Date.parse(q.joined_at)) / 1000))
  return (
    <section className="card">
      <h2>Buscando partida · {q.mode}</h2>
      <p className="timer">{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</p>
      <p className="muted">
        Posición {q.position}
        {q.eta_s != null && ` · espera estimada ${Math.ceil(q.eta_s / 60)} min`}
      </p>
      <p className="muted">Podés minimizar el launcher: te avisa cuando aparezca la partida.</p>
      <button onClick={onLeave}>Salir de la cola</button>
    </section>
  )
}

const STATUS: Record<string, string> = {
  accepting: "Partida encontrada",
  veto: "Veto de mapas (en la web)",
  waiting_server: "Esperando un servidor libre",
  assigned: "Servidor listo",
  connecting: "Entrando al servidor",
  live: "En vivo",
  finished: "Terminada",
  cancelled: "Cancelada",
}

function Lobby({ lobby, onAccept, onDecline }: { lobby: MmLobby; onAccept: () => void; onDecline: () => void }) {
  const me = lobby.players.find((p) => p.is_me)
  const acceptLeft = useCountdown(lobby.status === "accepting" ? lobby.accept_deadline : null)
  const connectLeft = useCountdown(lobby.connect_deadline)
  const accepted = lobby.players.filter((p) => p.accepted).length

  return (
    <section className="card">
      <h2>{STATUS[lobby.status] ?? lobby.status}{lobby.map ? ` · ${lobby.map}` : ""}</h2>
      {lobby.status === "accepting" && (
        <>
          <p className="timer">{acceptLeft ?? "–"} s</p>
          <p className="muted">Aceptaron {accepted} de {lobby.players.length}</p>
          {me?.accepted ? (
            <p>Aceptaste. Esperando al resto…</p>
          ) : (
            <div className="row">
              <button className="primary big" onClick={onAccept}>Aceptar</button>
              <button onClick={onDecline}>Rechazar</button>
            </div>
          )}
        </>
      )}
      {lobby.server && ["assigned", "connecting", "live"].includes(lobby.status) && (
        <Connect address={lobby.server.address} password={lobby.server.password} left={me?.connected ? null : connectLeft} />
      )}
      <ul className="players">
        {[1, 2].map((t) => (
          <li key={t}>
            <strong>Equipo {t === 1 ? "A" : "B"}</strong>
            {lobby.players.filter((p) => p.team === t).map((p) => (
              <span key={p.player_id} className={p.is_me ? "me" : ""}>
                {p.nick}{p.connected ? " ●" : p.accepted ? " ✓" : ""}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Connect({ address, password, left }: { address: string; password: string; left: number | null }) {
  const [msg, setMsg] = useState<string | null>(null)
  const dir = savedGameDir()

  const enter = async () => {
    setMsg(null)
    try {
      await copyConnect(address, password).catch(() => undefined)
      if (!dir) {
        setMsg("Configurá la carpeta de ClientMod abajo. El connect ya está copiado: pegalo en la consola (º).")
        return
      }
      setMsg(await launchGame(dir, address, password))
    } catch (err) {
      setMsg(`${err instanceof Error ? err.message : String(err)} El connect quedó copiado: pegalo en la consola (º).`)
    }
  }

  return (
    <div className="connect">
      {left != null && <p className="muted">Tenés {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} para entrar.</p>}
      <div className="row">
        <button className="primary big" onClick={() => void enter()}>Entrar al servidor</button>
        <button onClick={() => void copyConnect(address, password).then(() => setMsg("Copiado. Pegalo en la consola del juego (º)."))}>
          Copiar connect
        </button>
      </div>
      <code>{connectLine(address, "••••")}</code>
      {msg && <p className="muted">{msg}</p>}
    </div>
  )
}

function GameSetup() {
  const [dir, setDir] = useState(savedGameDir() ?? "")
  const [info, setInfo] = useState<GameInfo | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void detectGame(savedGameDir()).then((g) => {
      setInfo(g)
      if (g && !savedGameDir()) {
        saveGameDir(g.dir)
        setDir(g.dir)
      }
    })
  }, [])

  const check = async () => {
    const g = await detectGame(dir)
    setInfo(g)
    if (g) {
      saveGameDir(g.dir)
      setMsg("Listo: ClientMod encontrado.")
    } else setMsg("No encontré CMLauncher.exe en esa carpeta.")
  }

  return (
    <section className="card small">
      <h3>ClientMod</h3>
      <div className="row">
        <input value={dir} placeholder="C:\CSSv34_ClientMod" onChange={(e) => setDir(e.target.value)} />
        <button onClick={() => void check()}>Guardar</button>
      </div>
      {info ? (
        <p className="muted">CMLauncher.exe en {info.dir}</p>
      ) : (
        <p className="muted">Indicá la carpeta donde instalaste ClientMod.</p>
      )}
      {msg && <p className="muted">{msg}</p>}
    </section>
  )
}
