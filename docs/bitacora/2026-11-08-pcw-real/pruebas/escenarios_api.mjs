// Escenarios de PCW contra la API LOCAL (http://localhost:8787) y la Supabase LOCAL. Nunca producción.
// Uso (con la Supabase local, la API en :8787 y, para la web, el front en :5181 con VITE_API_URL=http://localhost:8787):
//   cd web/backend && SB_STATUS="$(./node_modules/.bin/supabase status -o json)" BE="$PWD" FE="$PWD/../frontend" OUT=<carpeta> node <este archivo>
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

async function user(tag, { vip = false, admin = false } = {}) {
  const email = `esc-${tag.toLowerCase()}-${rnd()}@test.local`
  const { data, error } = await adm.auth.admin.createUser({ email, password: "clave-de-prueba-123", email_confirm: true, user_metadata: { tag: `${tag}${rnd()}` } })
  if (error) throw error
  if (vip) await adm.from("vip_memberships").insert({ user_id: data.user.id, source: "manual" })
  if (admin) await adm.from("profiles").update({ role: "admin" }).eq("id", data.user.id)
  const s = await anon().auth.signInWithPassword({ email, password: "clave-de-prueba-123" })
  const player = (await adm.from("players").insert({ nick: `${tag}${rnd()}`, user_id: data.user.id, steam_id: steam() }).select("id").single()).data
  return { id: data.user.id, token: s.data.session.access_token, player: player.id, tag }
}
async function team(cap, n = 5) {
  const t = (await adm.from("teams").insert({ name: `T ${cap.tag} ${rnd()}`, tag: "T", kind: "official", captain_id: cap.id, owner_id: cap.id }).select("id, name").single()).data
  const others = (await adm.from("players").insert(Array.from({ length: n - 1 }, (_, i) => ({ nick: `J${i}${rnd()}`, steam_id: steam() }))).select("id")).data.map((p) => p.id)
  const players = [cap.player, ...others]
  await adm.from("team_members").insert(players.map((p) => ({ team_id: t.id, player_id: p, joined_at: new Date().toISOString() })))
  return { id: t.id, name: t.name, players }
}
async function loose(n) {
  return (await adm.from("players").insert(Array.from({ length: n }, (_, i) => ({ nick: `S${i}${rnd()}`, steam_id: steam() }))).select("id")).data.map((p) => p.id)
}
async function check(name, fn) {
  try {
    await fn()
    results.push(["ok", name])
  } catch (e) {
    results.push(["FALLA", name, e.message])
  }
}
function expect(cond, msg) { if (!cond) throw new Error(msg) }
async function notifs(u) { return (await req("GET", "/api/v1/notifications?per=50", u.token)).body?.items ?? [] }
const publish = (u, body) => req("POST", "/api/v1/pcw/posts", u.token, { best_of: 1, ...body })
const offer = (u, post, body) => req("POST", `/api/v1/pcw/posts/${post}/offers`, u.token, body)
const choose = (u, o) => req("POST", `/api/v1/pcw/offers/${o}/choose`, u.token)

// ---------- Publicar ----------
const vip = await user("Vip", { vip: true })
const vipTeam = await team(vip)
const normal = await user("Normal")
const normalTeam = await team(normal)
const solo = await user("Solo")
const adminU = await user("Adm", { admin: true })

await check("1. Sin VIP no se publica (403 VIP_REQUIRED)", async () => {
  const r = await publish(normal, { team_id: normalTeam.id })
  expect(r.status === 403 && r.body.error.code === "VIP_REQUIRED", err(r))
})
await check("2. Un admin sin VIP publica (y lo borra)", async () => {
  const adTeam = await team(adminU)
  const r = await publish(adminU, { team_id: adTeam.id })
  expect(r.status === 201, err(r))
  const d = await req("DELETE", `/api/v1/pcw/posts/${r.body.id}`, adminU.token)
  expect(d.status === 204, err(d))
})
let postA
await check("3. VIP como equipo sin roster: el bando es el plantel (5) con el equipo y su ELO", async () => {
  const r = await publish(vip, { team_id: vipTeam.id, best_of: 3, note: "serio" })
  expect(r.status === 201, err(r))
  postA = r.body.id
  const mine = (await req("GET", "/api/v1/me/pcw/post", vip.token)).body
  expect(mine.side.roster.length === 5, `roster ${mine.side.roster.length}`)
  expect(mine.side.plays_as?.id === vipTeam.id, "plays_as")
  expect("rank" in mine.side && "elo" in mine.side.roster[0], "rank/elo")
  expect(Array.isArray(mine.offers) && mine.offers.length === 0, "offers vacío")
})
await check("4. Un segundo anuncio abierto del mismo usuario: rechazado", async () => {
  const r = await publish(vip, { team_id: vipTeam.id })
  expect(r.status === 400 && /Ya tenés un anuncio abierto/.test(r.body.error.message), err(r))
})
await check("5. Como equipo ajeno (no soy capitán ni dueño): 403", async () => {
  const v2 = await user("Vip2", { vip: true })
  const r = await publish(v2, { team_id: normalTeam.id })
  expect(r.status === 403, err(r))
})
await check("6. Mix con menos de 4 con ficha: rechazado", async () => {
  const v3 = await user("Vip3", { vip: true })
  const r = await publish(v3, { players: [v3.player], guests: ["Invi"] })
  expect(r.status === 400, err(r))
})
await check("7. Mix con 4 (3 sueltos + yo) y 1 invitado: publica con el nombre propio", async () => {
  const v4 = await user("Vip4", { vip: true })
  const r = await publish(v4, { name: "Pick de prueba", players: [v4.player, ...(await loose(3))], guests: ["Suplente"] })
  expect(r.status === 201, err(r))
  const p = (await req("GET", "/api/v1/me/pcw/post", v4.token)).body
  expect(p.side.name === "Pick de prueba" && p.side.plays_as === null && p.side.roster.length === 5, JSON.stringify(p.side).slice(0, 120))
  await req("DELETE", `/api/v1/pcw/posts/${r.body.id}`, v4.token)
})
await check("8. Pool con menos mapas que el BO: rechazado", async () => {
  const v5 = await user("Vip5", { vip: true })
  const t5 = await team(v5)
  const r = await publish(v5, { team_id: t5.id, best_of: 3, map_pool: ["de_cache", "de_cbble"] })
  expect(r.status === 400 && /al menos 3/.test(r.body.error.message), err(r))
})

// ---------- Tablón ----------
await check("9. El tablón sin sesión trae el anuncio, sin my_offer", async () => {
  const r = await req("GET", "/api/v1/pcw/posts?per=100")
  const p = r.body.items.find((x) => x.id === postA)
  expect(r.status === 200 && p && p.my_offer === undefined, err(r))
})
await check("10. Filtro por formato: BO1 no trae una BO3", async () => {
  const r = await req("GET", "/api/v1/pcw/posts?per=100&best_of=1")
  expect(!r.body.items.some((x) => x.id === postA), "apareció la BO3")
})

// ---------- Ofertas ----------
let offerN, offerS
await check("11. Ofertar a mi propio anuncio: rechazado", async () => {
  const r = await offer(vip, postA, { team_id: vipTeam.id })
  expect(r.status === 400 && /propio anuncio/.test(r.body.error.message), err(r))
})
await check("12. Ofertar sin VIP como equipo, proponiendo otra hora: 201, y al que publicó le llega pcw_offer", async () => {
  const later = new Date(Date.now() + 5 * 3600_000).toISOString()
  const r = await offer(normal, postA, { team_id: normalTeam.id, starts_at: later })
  expect(r.status === 201, err(r))
  offerN = r.body.id
  const n = await notifs(vip)
  expect(n.some((x) => x.type === "pcw_offer"), "sin pcw_offer: " + n.map((x) => x.type).join(","))
})
await check("13. La misma cuenta no oferta dos veces al mismo anuncio", async () => {
  const r = await offer(normal, postA, { players: [normal.player, ...(await loose(3))] })
  expect(r.status === 400 && /Ya le mandaste/.test(r.body.error.message), err(r))
})
await check("14. Oferta con un jugador que está en los dos rosters: rechazada", async () => {
  const x = await user("Cruce")
  const r = await offer(x, postA, { players: [x.player, vipTeam.players[1], ...(await loose(2))] })
  expect(r.status === 400 && /dos rosters/.test(r.body.error.message), err(r))
})
await check("15. Oferta con hora en el pasado: rechazada", async () => {
  const x = await user("Pasado")
  const r = await offer(x, postA, { players: [x.player, ...(await loose(3))], starts_at: new Date(Date.now() - 3600_000).toISOString() })
  expect(r.status === 400 && /ya pasó/.test(r.body.error.message), err(r))
})
await check("16. Segunda oferta (mix de un jugador sin equipo) y el tablón le marca my_offer", async () => {
  const r = await offer(solo, postA, { name: "Mix Solo", players: [solo.player, ...(await loose(3))] })
  expect(r.status === 201, err(r))
  offerS = r.body.id
  const b = (await req("GET", "/api/v1/pcw/posts?per=100", solo.token)).body.items.find((x) => x.id === postA)
  expect(b.my_offer?.id === offerS, "my_offer " + JSON.stringify(b.my_offer))
})
await check("17. El que publicó ve las dos ofertas, con hora propuesta, equipo y roster", async () => {
  const p = (await req("GET", "/api/v1/me/pcw/post", vip.token)).body
  const o = p.offers.find((x) => x.id === offerN)
  expect(p.offers.length === 2 && o.starts_at && o.side.plays_as?.id === normalTeam.id && o.side.roster.length === 5, JSON.stringify(p.offers.map((x) => x.id)))
})
await check("18. Un tercero no puede retirar una oferta ajena", async () => {
  const r = await req("DELETE", `/api/v1/pcw/offers/${offerS}`, normal.token)
  expect(r.status === 400 && /no es tuya/.test(r.body.error.message), err(r))
})
await check("19. Retirar la propia y volver a mandarla", async () => {
  const r = await req("DELETE", `/api/v1/pcw/offers/${offerS}`, solo.token)
  expect(r.status === 204, err(r))
  const again = await offer(solo, postA, { name: "Mix Solo", players: [solo.player, ...(await loose(3))] })
  expect(again.status === 201, err(again))
  offerS = again.body.id
})
await check("20. Solo el que publicó elige (otro: 400)", async () => {
  const r = await choose(normal, offerN)
  expect(r.status === 400 && /Solo el que publicó/.test(r.body.error.message), err(r))
})
let matchA
await check("21. Elegir: crea la partida con la hora propuesta; la otra queda rechazada y avisada", async () => {
  const r = await choose(vip, offerN)
  expect(r.status === 201, err(r))
  matchA = r.body.id
  const m = (await req("GET", `/api/v1/matches/${matchA}`)).body
  expect(m.kind === "pcw" && m.status === "upcoming" && m.starts_at, "partida")
  expect((await notifs(normal)).some((x) => x.type === "pcw_offer_chosen"), "sin pcw_offer_chosen")
  expect((await notifs(solo)).some((x) => x.type === "pcw_offer_rejected"), "sin pcw_offer_rejected")
  expect((await req("GET", "/api/v1/me/pcw/post", vip.token)).body === null, "el anuncio sigue abierto")
})
await check("22. La oferta rechazada ya no se puede retirar ni elegir", async () => {
  const w = await req("DELETE", `/api/v1/pcw/offers/${offerS}`, solo.token)
  const c = await choose(vip, offerS)
  expect(w.status === 400 && c.status === 400, `${err(w)} / ${err(c)}`)
})
await check("23. Aceptar directo ya no existe (404)", async () => {
  const r = await req("POST", `/api/v1/pcw/posts/${postA}/accept`, normal.token, { players: [] })
  expect(r.status === 404, err(r))
})

// ---------- Mis PCW y listos ----------
const my = async (u) => (await req("GET", "/api/v1/me/pcw/matches?per=50", u.token)).body.items.find((x) => x.id === matchA)
await check("24. Mis PCW: cada uno ve su lado, sin reserva, con los dos bandos", async () => {
  const a = await my(vip), b = await my(normal)
  expect(a.my_side === 1 && b.my_side === 2 && a.booking === null, JSON.stringify({ a: a.my_side, b: b.my_side, bk: a.booking }))
  expect(a.pcw_sides["2"].plays_as?.id === normalTeam.id, "pcw_sides")
})
await check("25. Alguien que no juega no puede marcar listos", async () => {
  const r = await req("POST", `/api/v1/matches/${matchA}/ready`, solo.token)
  expect(r.status >= 400, err(r))
})
await check("26. Listos de un lado, y 'Ya no estamos listos'", async () => {
  expect((await req("POST", `/api/v1/matches/${matchA}/ready`, vip.token)).status === 200, "ready")
  let a = await my(vip)
  expect(a.booking?.ready1 === true && a.booking?.ready2 === false, JSON.stringify(a.booking))
  expect((await req("DELETE", `/api/v1/matches/${matchA}/ready`, vip.token)).status === 200, "unready")
  a = await my(vip)
  expect(!a.booking || (!a.booking.ready1 && !a.booking.ready2), JSON.stringify(a.booking))
})
await check("27. Los dos listos: veto; veta el equipo 1 y el 2 no puede en ese turno", async () => {
  await req("POST", `/api/v1/matches/${matchA}/ready`, vip.token)
  await req("POST", `/api/v1/matches/${matchA}/ready`, normal.token)
  const bk = (await req("GET", `/api/v1/matches/${matchA}/booking`, vip.token)).body
  expect(bk.booking?.status === "veto" && bk.can_veto === true, JSON.stringify({ s: bk.booking?.status, c: bk.can_veto }))
  const bk2 = (await req("GET", `/api/v1/matches/${matchA}/booking`, normal.token)).body
  expect(bk2.can_veto === false, "el 2 puede vetar fuera de turno")
  const d = (await req("GET", `/api/v1/matches/${matchA}`, vip.token)).body
  const wrong = await req("POST", `/api/v1/matches/${matchA}/veto`, normal.token, { map: d.veto.pool[0].name })
  expect(wrong.status >= 400, "vetó fuera de turno: " + err(wrong))
  expect(d.veto.next.action === "ban", "primer turno no es ban")
})
await check("28. Veto alternado hasta los picks (BO3): ban, ban, pick, pick", async () => {
  const d = (await req("GET", `/api/v1/matches/${matchA}`, vip.token)).body
  const pool = d.veto.pool.map((x) => x.name)
  const turns = [vip, normal, vip, normal]
  for (let i = 0; i < 4; i++) {
    const r = await req("POST", `/api/v1/matches/${matchA}/veto`, turns[i].token, { map: pool[i] })
    expect(r.status === 204, `paso ${i + 1}: ${err(r)}`)
  }
  const after = (await req("GET", `/api/v1/matches/${matchA}`, vip.token)).body
  const kinds = after.veto.actions.map((x) => x.action).join(",")
  expect(kinds === "ban,ban,pick,pick", kinds)
})
await check("29. Un ajeno no cancela la PCW; el capitán sí (antes de jugar)", async () => {
  const r = await req("POST", `/api/v1/pcw/matches/${matchA}/cancel`, solo.token)
  expect(r.status >= 400, "canceló un ajeno")
  const ok = await req("POST", `/api/v1/pcw/matches/${matchA}/cancel`, vip.token)
  expect(ok.status === 204, err(ok))
})

// ---------- Mapas fijos ----------
async function fixed(bo, maps) {
  const v = await user("Fij", { vip: true }), t = await team(v)
  const o = await user("Riv"), to = await team(o)
  const p = await publish(v, { team_id: t.id, best_of: bo, map_pool: maps })
  expect(p.status === 201, err(p))
  const of = await offer(o, p.body.id, { team_id: to.id })
  const m = (await choose(v, of.body.id)).body.id
  await req("POST", `/api/v1/matches/${m}/ready`, v.token)
  await req("POST", `/api/v1/matches/${m}/ready`, o.token)
  const d = (await req("GET", `/api/v1/matches/${m}`, v.token)).body
  const bk = (await req("GET", `/api/v1/matches/${m}/booking`, v.token)).body
  await req("POST", `/api/v1/pcw/matches/${m}/cancel`, v.token)
  return { d, bk }
}
await check("30. BO3 con 3 mapas: sin veto, en el orden elegido, y la reserva pasa directo de largo el veto", async () => {
  const { d, bk } = await fixed(3, ["de_tuscan", "de_cache", "de_cbble"])
  expect(d.veto.sequence.length === 0 && d.veto.next === null, "hay veto")
  expect(d.veto.maps_to_play.map((x) => x.map).join(",") === "de_tuscan,de_cache,de_cbble", d.veto.maps_to_play.map((x) => x.map).join(","))
  expect(bk.booking?.status !== "veto", "la reserva quedó en veto: " + bk.booking?.status)
})
await check("31. BO1 con 1 mapa: sin veto, ese mapa", async () => {
  const { d } = await fixed(1, ["de_cache"])
  expect(d.veto.sequence.length === 0 && d.veto.maps_to_play[0]?.map === "de_cache", JSON.stringify(d.veto.maps_to_play))
})
await check("32. BO1 con 2 mapas: un ban (sigue habiendo veto)", async () => {
  const { d } = await fixed(1, ["de_cache", "de_cbble"])
  expect(d.veto.sequence.join(",") === "ban", d.veto.sequence.join(","))
})

// ---------- Cancelar el anuncio con ofertas ----------
await check("33. Borrar mi anuncio con ofertas: a quien ofertó le llega pcw_offer_rejected", async () => {
  const v = await user("Bor", { vip: true }), t = await team(v)
  const o = await user("Ofe")
  const p = await publish(v, { team_id: t.id })
  await offer(o, p.body.id, { players: [o.player, ...(await loose(3))] })
  expect((await req("DELETE", `/api/v1/pcw/posts/${p.body.id}`, v.token)).status === 204, "borrar")
  expect((await notifs(o)).some((x) => x.type === "pcw_offer_rejected" && x.data?.reason === "cancelled"), "sin aviso")
})

// ---------- Sanción de PCW ----------
await check("34. Equipo sancionado: no publica ni oferta como equipo (403 PCW_BANNED) y el contexto lo dice", async () => {
  const v = await user("San", { vip: true }), t = await team(v)
  const until = new Date(Date.now() + 3 * 86400_000).toISOString()
  const ins = await adm.from("pcw_bans").insert({ team_id: t.id, until, reason: "prueba" })
  if (ins.error) throw new Error("pcw_bans: " + ins.error.message)
  const r = await publish(v, { team_id: t.id })
  expect(r.status === 403 && r.body.error.code === "PCW_BANNED", err(r))
  const other = await user("Pub", { vip: true }), ot = await team(other)
  const p = await publish(other, { team_id: ot.id })
  const o = await offer(v, p.body.id, { team_id: t.id })
  expect(o.status === 403 && o.body.error.code === "PCW_BANNED", "oferta: " + err(o))
  const ctx = (await req("GET", "/api/v1/me/pcw/context", v.token)).body
  expect(ctx.team?.ban_until, "contexto sin ban_until")
  await req("DELETE", `/api/v1/pcw/posts/${p.body.id}`, other.token)
})

// ---------- Contexto y servidores ----------
await check("35. Contexto: VIP, ficha, equipo con plantel; sin equipo, team null", async () => {
  const a = (await req("GET", "/api/v1/me/pcw/context", vip.token)).body
  const s = (await req("GET", "/api/v1/me/pcw/context", solo.token)).body
  expect(a.vip === true && a.team?.id === vipTeam.id && a.team.plantel.length === 5 && a.me.player_id === vip.player, JSON.stringify(a).slice(0, 150))
  expect(s.vip === false && s.team === null && s.me?.player_id === solo.player, JSON.stringify(s).slice(0, 150))
})
await check("36. Servidores libres: PCW para cualquiera (200); torneo para un jugador (403)", async () => {
  const p = await req("GET", "/api/v1/servers/free?kind=pcw", solo.token)
  const o = await req("GET", "/api/v1/servers/free?kind=official", solo.token)
  expect(p.status === 200 && o.status === 403, `${p.status} / ${o.status}`)
})
await check("37. Sin sesión: Mis PCW, contexto, publicar y ofertar dan 401", async () => {
  const rs = await Promise.all([req("GET", "/api/v1/me/pcw/matches"), req("GET", "/api/v1/me/pcw/context"), req("POST", "/api/v1/pcw/posts", null, { best_of: 1 }), req("POST", `/api/v1/pcw/posts/${postA}/offers`, null, {})])
  expect(rs.every((r) => r.status === 401), rs.map((r) => r.status).join(","))
})

// ---------- Chat del grupo ----------
await check("38. Chat del grupo: solo con compañero; leer, escribir, ajeno no lee; denunciar; se borra con el grupo", async () => {
  const a = await user("ChA"), b = await user("ChB"), c = await user("ChC")
  const g = (await adm.from("mm_parties").insert({ leader_id: a.id }).select("id").single()).data.id
  await adm.from("mm_party_members").insert({ party_id: g, user_id: a.id })
  const alone = await req("POST", "/api/v1/mm/party/chat", a.token, { message: "hola" })
  expect(alone.status === 400, "escribió solo: " + err(alone))
  await adm.from("mm_party_members").insert({ party_id: g, user_id: b.id })
  const sent = await req("POST", "/api/v1/mm/party/chat", a.token, { message: "  ¿una más?  " })
  expect(sent.status === 200 && sent.body.message === "¿una más?" && sent.body.player_id === a.player, err(sent) + JSON.stringify(sent.body))
  const lb = (await req("GET", "/api/v1/mm/party/chat", b.token)).body.items
  expect(lb.length === 1 && lb[0].is_me === false, "b no lo lee")
  const lc = (await req("GET", "/api/v1/mm/party/chat", c.token)).body.items
  expect(lc.length === 0, "un ajeno lo lee")
  const long = await req("POST", "/api/v1/mm/party/chat", b.token, { message: "x".repeat(301) })
  expect(long.status === 400, "aceptó 301")
  const self = await req("POST", `/api/v1/mm/party/chat/${sent.body.id}/report`, a.token, { reason: "toxic" })
  expect(self.status === 400, "se denunció a sí mismo")
  const out = await req("POST", `/api/v1/mm/party/chat/${sent.body.id}/report`, c.token, { reason: "toxic" })
  expect(out.status === 400, "denunció un ajeno")
  const rep = await req("POST", `/api/v1/mm/party/chat/${sent.body.id}/report`, b.token, { reason: "toxic", note: "prueba" })
  expect(rep.status === 204, err(rep))
  const twice = await req("POST", `/api/v1/mm/party/chat/${sent.body.id}/report`, b.token, { reason: "other" })
  expect(twice.status === 400, "denunció dos veces")
  const list = (await req("GET", "/api/v1/admin/mm/reports", adminU.token)).body
  expect(Array.isArray(list) && list.some((r) => r.message === "¿una más?" && r.lobby_id === null), "el admin no la ve")
  await adm.from("mm_parties").delete().eq("id", g)
  const left = (await adm.from("mm_party_chat").select("id").eq("party_id", g)).data
  expect(left.length === 0, "el chat sobrevivió al grupo")
})
await check("39. Chat del grupo: más de 10 mensajes en 10 s se frena", async () => {
  const a = await user("RaA"), b = await user("RaB")
  const g = (await adm.from("mm_parties").insert({ leader_id: a.id }).select("id").single()).data.id
  await adm.from("mm_party_members").insert([{ party_id: g, user_id: a.id }, { party_id: g, user_id: b.id }])
  let last
  for (let i = 0; i < 11; i++) last = await req("POST", "/api/v1/mm/party/chat", a.token, { message: `m${i}` })
  expect(last.status === 400 && /muy rápido/.test(last.body.error.message), err(last))
  await adm.from("mm_parties").delete().eq("id", g)
})

// ---------- Vencimiento ----------
await check("40. Un anuncio de más de 7 días se borra en la limpieza y sus ofertas avisan rechazo", async () => {
  const v = await user("Vie", { vip: true }), t = await team(v)
  const o = await user("VieO")
  const p = await publish(v, { team_id: t.id })
  await offer(o, p.body.id, { players: [o.player, ...(await loose(3))] })
  await adm.from("pcw_posts").update({ created_at: new Date(Date.now() - 8 * 86400_000).toISOString() }).eq("id", p.body.id)
  const v2 = await user("Vie2", { vip: true }), t2 = await team(v2)
  await publish(v2, { team_id: t2.id }) // publicar corre pcw_cleanup()
  const gone = (await adm.from("pcw_posts").select("id").eq("id", p.body.id)).data
  expect(gone.length === 0, "el anuncio vencido sigue")
  expect((await notifs(o)).some((x) => x.type === "pcw_offer_rejected"), "sin aviso de rechazo")
})

for (const r of results) console.log(r.join(" | "))
console.log(`\n${results.filter((r) => r[0] === "ok").length} de ${results.length} en verde`)
