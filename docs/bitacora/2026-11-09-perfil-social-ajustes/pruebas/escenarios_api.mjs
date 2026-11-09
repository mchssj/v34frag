// Escenarios de los comentarios del perfil y la insignia contra la API LOCAL (http://localhost:8787) y la Supabase
// LOCAL. Nunca producción. Necesita la 89 a la 94 aplicadas.
// Uso: cd web/backend && SB_STATUS="$(./node_modules/.bin/supabase status -o json)" BE="$PWD" node <este archivo>
import { createRequire } from "module"
const require = createRequire(process.env.BE + "/package.json")
const { createClient } = require("@supabase/supabase-js")
const st = JSON.parse(process.env.SB_STATUS)
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(st.API_URL)) throw new Error("no es local")
const API = "http://localhost:8787"
const adm = createClient(st.API_URL, st.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = () => createClient(st.API_URL, st.ANON_KEY, { auth: { persistSession: false } })
const rnd = () => Math.random().toString(36).slice(2, 7)
const steam = () => "7656119" + String(Math.floor(Math.random() * 1e10)).padStart(10, "0")
const results = []

async function req(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { json = text }
  return { status: res.status, body: json }
}
const err = (r) => `${r.status} ${r.body?.error?.code ?? ""} ${r.body?.error?.message ?? ""}`.trim()
async function user(tag, role) {
  const email = `soc-${tag.toLowerCase()}-${rnd()}@test.local`
  const { data, error } = await adm.auth.admin.createUser({ email, password: "clave-de-prueba-123", email_confirm: true, user_metadata: { tag: `${tag}${rnd()}` } })
  if (error) throw error
  if (role) await adm.from("profiles").update({ role }).eq("id", data.user.id)
  const s = await anon().auth.signInWithPassword({ email, password: "clave-de-prueba-123" })
  const player = (await adm.from("players").insert({ nick: `${tag}${rnd()}`, user_id: data.user.id, steam_id: steam() }).select("id, nick, steam_id").single()).data
  return { id: data.user.id, token: s.data.session.access_token, player: player.id, nick: player.nick, steam: player.steam_id, tag }
}
async function check(name, fn) {
  try { await fn(); results.push(["ok", name]) } catch (e) { results.push(["FALLA", name, e.message]) }
}
const expect = (c, m) => { if (!c) throw new Error(m) }

const dueno = await user("Dueno"), a = await user("Ana"), b = await user("Beto"), ban = await user("Baneado")
const blq = await user("Bloq"), mod = await user("Mod", "moderator"), admin = await user("Admin", "admin")
// Solo letras: la base guarda la palabra normalizada (los números pasan a letras).
const word = "zq" + Array.from({ length: 6 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("")
await adm.from("blocked_words").insert({ word })

await check("1. Un comentario con una palabra bloqueada: 400 con la palabra; uno normal pasa", async () => {
  const r = await req("POST", `/api/v1/players/${dueno.player}/comments`, a.token, { body: `sos un ${word}` })
  expect(r.status === 400 && r.body.error.message.includes(word), err(r))
  const ok = await req("POST", `/api/v1/players/${dueno.player}/comments`, a.token, { body: "buen partido, gg" })
  expect(ok.status === 200 && ok.body.items.length === 1, err(ok))
})
await check("2. Una palabra que solo contiene la bloqueada no se frena", async () => {
  const r = await req("POST", `/api/v1/players/${dueno.player}/comments`, b.token, { body: `abc${word}xyz` })
  expect(r.status === 200, err(r))
})
await adm.from("bans").insert({ player_id: ban.player, steam_id: ban.steam, reason: "escenario", source: "web" })
await check("3. Baneado: 403 al comentar y al votar; el muro dice restriction=banned", async () => {
  const c = await req("POST", `/api/v1/players/${dueno.player}/comments`, ban.token, { body: "hola" })
  const v = await req("PUT", `/api/v1/players/${dueno.player}/vote`, ban.token, { value: 1 })
  const w = await req("GET", `/api/v1/players/${dueno.player}/wall`, ban.token)
  expect(c.status === 403 && v.status === 403, `${err(c)} / ${err(v)}`)
  expect(w.body.restriction === "banned" && !w.body.can_comment && !w.body.can_vote, JSON.stringify(w.body).slice(0, 200))
})
await adm.from("mm_blocks").insert({ user_id: dueno.id, player_id: blq.player })
await check("4. Bloqueado por el dueño: 403 en su perfil, restriction=blocked; en otro perfil puede", async () => {
  const c = await req("POST", `/api/v1/players/${dueno.player}/comments`, blq.token, { body: "hola" })
  const w = await req("GET", `/api/v1/players/${dueno.player}/wall`, blq.token)
  const otro = await req("PUT", `/api/v1/players/${a.player}/vote`, blq.token, { value: 1 })
  expect(c.status === 403 && w.body.restriction === "blocked" && otro.status === 200, `${err(c)} / ${w.body.restriction} / ${err(otro)}`)
})
let comment
await check("5. can_report: sí en el comentario ajeno, no en el propio", async () => {
  const w = await req("GET", `/api/v1/players/${dueno.player}/wall`, a.token)
  const mine = w.body.items.find((i) => i.mine), other = w.body.items.find((i) => !i.mine)
  comment = mine.id
  expect(mine.can_report === false && other.can_report === true, JSON.stringify(w.body.items.map((i) => [i.mine, i.can_report])))
})
await check("6. Denunciar: 204; repetida, 400; la propia, 400; un motivo inventado, 400", async () => {
  const r = await req("POST", `/api/v1/profile-comments/${comment}/report`, b.token, { reason: "toxic", note: "insulta" })
  const again = await req("POST", `/api/v1/profile-comments/${comment}/report`, b.token, { reason: "spam" })
  const own = await req("POST", `/api/v1/profile-comments/${comment}/report`, a.token, { reason: "spam" })
  const bad = await req("POST", `/api/v1/profile-comments/${comment}/report`, dueno.token, { reason: "feo" })
  expect(r.status === 204 && again.status === 400 && own.status === 400 && bad.status === 400, [r, again, own, bad].map(err).join(" / "))
  expect((await req("POST", `/api/v1/profile-comments/${comment}/report`, dueno.token, { reason: "harassment" })).status === 204, "el dueño no pudo denunciar")
})
let report
await check("7. La lista: un jugador 403; el moderador la ve con 2 denuncias del comentario", async () => {
  expect((await req("GET", "/api/v1/admin/profile-comment-reports", a.token)).status === 403, "un jugador ve la lista")
  const l = await req("GET", "/api/v1/admin/profile-comment-reports?per=100", mod.token)
  const mine = l.body.items.filter((i) => i.comment.id === comment)
  report = mine[0]?.id
  expect(l.status === 200 && mine.length === 2 && mine[0].reports === 2 && mine[0].comment.body === "buen partido, gg", err(l) + JSON.stringify(mine[0] ?? {}).slice(0, 200))
  const f = await req("GET", "/api/v1/admin/profile-comment-reports?reason=harassment&per=100", mod.token)
  expect(f.body.items.every((i) => i.reason === "harassment"), "el filtro por motivo no va")
})
await check("8. Borrar el comentario cierra sus 2 denuncias y el muro ya no lo muestra", async () => {
  const r = await req("POST", `/api/v1/admin/profile-comment-reports/${report}/resolve`, mod.token, { action: "delete" })
  expect(r.status === 204, err(r))
  const resolved = await req("GET", "/api/v1/admin/profile-comment-reports?status=resolved&per=100", mod.token)
  const mine = resolved.body.items.filter((i) => i.comment.id === comment)
  expect(mine.length === 2 && mine.every((i) => i.status === "removed" && i.comment.deleted_at), JSON.stringify(mine.map((i) => i.status)))
  const w = await req("GET", `/api/v1/players/${dueno.player}/wall`)
  expect(!w.body.items.some((i) => i.id === comment), "el muro sigue mostrando el comentario")
  const again = await req("POST", `/api/v1/admin/profile-comment-reports/${report}/resolve`, mod.token, { action: "dismiss" })
  expect(again.status === 400, err(again))
})
await check("9. Insignia: el admin verifica y sale en la lista de jugadores, el filtro Verificados y la ficha", async () => {
  const v = await req("PUT", `/api/v1/admin/players/${a.player}/verification`, admin.token, { kind: "gold", note: "escenario" })
  expect(v.status === 200, err(v))
  const l = await req("GET", `/api/v1/players?q=${encodeURIComponent(a.nick)}`)
  expect(l.body.items[0]?.verified === "gold", JSON.stringify(l.body.items[0] ?? {}).slice(0, 200))
  const f = await req("GET", "/api/v1/players?verified=true&per=100", admin.token)
  expect(f.body.items.some((p) => p.id === a.player) && f.body.items.every((p) => p.verified), "el filtro Verificados no va")
  const nf = await req("GET", `/api/v1/players?verified=false&q=${encodeURIComponent(a.nick)}`, admin.token)
  expect(nf.body.total === 0, "con verified=false aparece el verificado")
  const d = await req("GET", `/api/v1/players/${a.player}`)
  expect(d.body.verified === "gold" && d.body.verification?.kind === "gold", "la ficha no trae la insignia")
})
await check("10. Sin sesión no se denuncia (401) y el muro se lee", async () => {
  expect((await req("POST", `/api/v1/profile-comments/${comment}/report`, null, { reason: "spam" })).status === 401, "sin sesión denunció")
  expect((await req("GET", `/api/v1/players/${dueno.player}/wall`)).status === 200, "sin sesión no lee el muro")
})

for (const r of results) console.log(r.join(" | "))
console.log(`\n${results.filter((r) => r[0] === "ok").length} de ${results.length} en verde`)
