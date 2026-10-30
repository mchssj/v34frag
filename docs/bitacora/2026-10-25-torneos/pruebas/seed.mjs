// Crea torneos de prueba en la API local con la cuenta admin de siembra.
// Uso: node seed.mjs <token>
import { writeFileSync } from "node:fs"

const API = "http://localhost:8787/api/v1"
const token = process.argv[2]
const T = (n) => `eeeeeeee-0000-4000-8000-${String(n).padStart(12, "0")}`
const P = (t, p) => `eeeeeeee-1111-4000-8000-${String(t * 100 + p).padStart(12, "0")}`

async function call(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function event(body, teams) {
  const e = await call("POST", "/events", body)
  for (const t of teams)
    await call("PUT", `/events/${e.id}/registrations/${T(t)}`, {
      players: [1, 2, 3, 4, 5].map((p) => P(t, p)),
    })
  return e
}

const matches = async (id) =>
  (await call("GET", `/events/${id}/matches?per=200`)).items

/** Juega las partidas pendientes que ya tienen los dos equipos; gana el lado 1 salvo `flip`. */
async function play(id, filter = () => true, flip = () => false) {
  for (const m of await matches(id)) {
    if (m.status !== "upcoming" || !m.side1.team || !m.side2.team || !filter(m)) continue
    const wins = Math.ceil(m.best_of / 2)
    const maps = Array.from({ length: wins }, () =>
      flip(m) ? { r1: 9, r2: 13 } : { r1: 13, r2: 8 }
    )
    await call("POST", `/matches/${m.id}/result`, { maps })
  }
}

const out = {}
const base = { starts_on: "2026-10-20", ends_on: "2026-11-15", prize: "USD 500" }

// En curso: eliminación directa de 8 con cuartos jugados y una semifinal.
const single = await event({ ...base, name: "Prueba · Copa Otoño", template: "single", max_teams: 8 }, [1, 2, 3, 4, 5, 6, 7, 8])
await call("POST", `/events/${single.id}/generate`)
await play(single.id, (m) => m.round === 1, (m) => m.pos === 2)
await play(single.id, (m) => m.round === 2 && m.pos === 1)
out.single = single.id

// Finalizado: grupos + playoffs con 8.
const groups = await event({ ...base, name: "Prueba · Copa Invierno", template: "groups", max_teams: 8, prize: "USD 250" }, [1, 2, 3, 4, 5, 6, 7, 8])
await call("POST", `/events/${groups.id}/generate`)
for (let i = 0; i < 8; i++) await play(groups.id, () => true, (m) => (m.pos ?? 0) % 2 === 0)
out.groups = groups.id

// En curso: doble eliminación de 4 a medio jugar.
const dbl = await event({ ...base, name: "Prueba · Doble Primavera", template: "double", max_teams: 8 }, [1, 2, 3, 4])
await call("POST", `/events/${dbl.id}/generate`)
await play(dbl.id, (m) => m.stage === "upper")
out.double = dbl.id

// Inscripciones: 3 de 12 inscriptos.
const reg = await event({ ...base, name: "Prueba · Liga Verano", template: "single", max_teams: 12, rules: "Roster de 5.\nVeto en la sala." }, [3, 4, 5])
out.registration = reg.id

writeFileSync(new URL("./seeded.json", import.meta.url), JSON.stringify(out, null, 2))
console.log(out)
