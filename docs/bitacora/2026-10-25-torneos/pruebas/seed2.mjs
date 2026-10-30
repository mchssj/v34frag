// Resuelve los empates del torneo de grupos y juega los playoffs hasta el campeón.
import ids from "./seeded.json" with { type: "json" }

const API = "http://localhost:8787/api/v1"
const token = process.argv[2]
const T = (n) => `eeeeeeee-0000-4000-8000-${String(n).padStart(12, "0")}`

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

const id = ids.groups
const order = { 1: [4, 5, 8], 2: [3, 6, 7] }
for (let i = 0; i < 3; i++) {
  const d = await call("GET", `/events/${id}`)
  if (!d.tie_pending) break
  const g = d.tie_pending.grp
  await call("POST", `/events/${id}/ties`, { grp: g, order: order[g].map(T) })
}
for (let i = 0; i < 4; i++) {
  const ms = (await call("GET", `/events/${id}/matches?per=200`)).items
  for (const m of ms) {
    if (m.status !== "upcoming" || !m.side1.team || !m.side2.team) continue
    const wins = Math.ceil(m.best_of / 2)
    await call("POST", `/matches/${m.id}/result`, {
      maps: Array.from({ length: wins }, (_, k) => ({ r1: 13, r2: 10 - k })),
    })
  }
}
const d = await call("GET", `/events/${id}`)
console.log(d.status, d.champion)
