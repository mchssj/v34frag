// Escenarios de PCW en la web local (http://localhost:5181) con cuentas nuevas de la base LOCAL.
// Uso (con la Supabase local, la API en :8787 y, para la web, el front en :5181 con VITE_API_URL=http://localhost:8787):
//   cd web/backend && SB_STATUS="$(./node_modules/.bin/supabase status -o json)" BE="$PWD" FE="$PWD/../frontend" OUT=<carpeta> node <este archivo>
import { createRequire } from "module"
const rq = createRequire(process.env.BE + "/package.json")
const { createClient } = rq("@supabase/supabase-js")
const { chromium } = createRequire(process.env.FE + "/package.json")("@playwright/test")
const st = JSON.parse(process.env.SB_STATUS)
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(st.API_URL)) throw new Error("no es local")
const adm = createClient(st.API_URL, st.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const W = "http://localhost:5181", OUT = process.env.OUT, PASS = "clave-de-prueba-123"
const rnd = () => Math.random().toString(36).slice(2, 7)
const steam = () => "7656119" + String(Math.floor(Math.random() * 1e10)).padStart(10, "0")
const results = []

async function user(tag, { vip = false, team = false } = {}) {
  const email = `ui-${tag.toLowerCase()}-${rnd()}@test.local`
  const { data } = await adm.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: { tag: `${tag}${rnd()}` } })
  const id = data.user.id
  if (vip) await adm.from("vip_memberships").insert({ user_id: id, source: "manual" })
  const pl = (await adm.from("players").insert({ nick: `${tag}${rnd()}`, user_id: id, steam_id: steam() }).select("id").single()).data.id
  let teamId = null
  if (team) {
    teamId = (await adm.from("teams").insert({ name: `${tag} ${rnd()}`, tag: tag.slice(0, 3).toUpperCase(), kind: "official", captain_id: id, owner_id: id }).select("id").single()).data.id
    const others = (await adm.from("players").insert(Array.from({ length: 4 }, (_, i) => ({ nick: `${tag[0]}${i}${rnd()}`, steam_id: steam() }))).select("id")).data
    await adm.from("team_members").insert([pl, ...others.map((o) => o.id)].map((p) => ({ team_id: teamId, player_id: p, joined_at: new Date().toISOString() })))
  }
  return { id, email, pl, teamId, tag }
}
const b = await chromium.launch()
async function login(u, mobile = false) {
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark" } : { viewport: { width: 1440, height: 900 }, colorScheme: "dark" })
  const p = await ctx.newPage()
  p.errors = []
  p.on("pageerror", (e) => p.errors.push(e.message.slice(0, 150)))
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && p.errors.push(m.text().slice(0, 150)))
  await p.goto(W + "/login", { waitUntil: "networkidle" })
  await p.getByLabel("Email").fill(u.email)
  await p.getByLabel("Contraseña").fill(PASS)
  await p.getByRole("button", { name: "Iniciar sesión" }).click()
  await p.waitForTimeout(2500)
  await p.goto(W + "/pcw", { waitUntil: "networkidle" })
  await p.waitForTimeout(1500)
  return p
}
async function check(name, p, fn, shot) {
  try {
    await fn()
    if (p.errors.length) throw new Error("errores en la consola: " + p.errors.join(" | "))
    results.push(["ok", name])
  } catch (e) {
    results.push(["FALLA", name, e.message.split("\n")[0]])
  }
  if (shot) await p.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true })
}
const expect = (c, m) => { if (!c) throw new Error(m) }

// A: VIP con equipo. N: sin VIP con equipo. S: sin VIP y sin equipo. Z: con equipo sancionado.
const A = await user("Alfa", { vip: true, team: true })
const N = await user("Nova", { team: true })
const S = await user("Solo")
const Z = await user("Zeta", { vip: true, team: true })
await adm.from("pcw_bans").insert({ team_id: Z.teamId, until: new Date(Date.now() + 3 * 86400_000).toISOString(), reason: "prueba de la web" })

const pa = await login(A)
await check("1. VIP con equipo: el panel de publicar ofrece el equipo y el mix, sin desafío ni Discord", pa, async () => {
  await pa.getByRole("button", { name: /Publicar una PCW/ }).first().click()
  await pa.waitForTimeout(700)
  const dlg = pa.locator("[role=dialog]")
  expect(await dlg.getByText("Mix de amigos").count() > 0, "sin mix")
  expect(await dlg.getByText("Desafío directo").count() === 0, "muestra desafío directo")
  expect(await dlg.getByText(/Discord/).count() === 0, "muestra Discord")
}, "u01-publicar-equipo")
await check("2. Publicar una BO1 en un mapa fijo: aparece Tu anuncio con 'Esperando ofertas'", pa, async () => {
  const dlg = pa.locator("[role=dialog]")
  await dlg.getByRole("radio", { name: "BO1" }).or(dlg.getByText("BO1", { exact: true })).first().click()
  await dlg.getByText("Elegir los mapas").click().catch(() => {})
  await pa.waitForTimeout(400)
  const cache = dlg.getByRole("button", { name: /de_cache/ }).or(dlg.getByText("de_cache", { exact: true }))
  if (await cache.count()) await cache.first().click()
  await dlg.getByRole("button", { name: /^Publicar$/ }).click()
  await pa.waitForTimeout(2500)
  expect(await pa.getByText("Tu anuncio").count() > 0, "no aparece Tu anuncio")
}, "u02-tu-anuncio")

const pn = await login(N)
await check("3. Sin VIP: 'Publicar una PCW' abre Cómo ser VIP", pn, async () => {
  await pn.getByRole("button", { name: /Publicar una PCW/ }).first().click()
  await pn.waitForTimeout(800)
  expect(await pn.getByText("Cómo ser VIP").count() > 0, "no abre el diálogo VIP")
}, "u03-sin-vip")
await check("4. Sin VIP: manda una oferta con otra hora; la fila queda 'Enviada'", pn, async () => {
  await pn.keyboard.press("Escape")
  const row = pn.locator("li").filter({ hasText: "Alfa" }).first()
  await row.getByRole("button", { name: "Mandar oferta" }).click()
  const dlg = pn.locator("[role=dialog]")
  await dlg.getByLabel("Proponer otra hora").click()
  const later = new Date(Date.now() + 26 * 3600_000)
  const off = later.getTimezoneOffset() * 60_000
  await dlg.getByLabel("Hora propuesta").fill(new Date(later.getTime() - off).toISOString().slice(0, 16))
  await dlg.getByRole("button", { name: /Mandar oferta con otra hora/ }).click()
  await pn.waitForTimeout(2500)
  expect(await pn.getByText(/Enviada/).count() > 0, "la fila no dice Enviada")
}, "u04-oferta-enviada")

const ps = await login(S)
await check("5. Sin equipo: la oferta es solo como mix (sin elegir equipo) y avisa que faltan jugadores", ps, async () => {
  const row = ps.locator("li").filter({ hasText: "Alfa" }).first()
  await row.getByRole("button", { name: "Mandar oferta" }).click()
  const dlg = ps.locator("[role=dialog]")
  await ps.waitForTimeout(600)
  expect(await dlg.getByText("Nombre del equipo").count() > 0, "no muestra el mix")
  expect(await dlg.getByText(/Te faltan 3 jugadores/).count() > 0, "no avisa que faltan jugadores")
  expect(await dlg.getByRole("button", { name: "Mandar oferta" }).isDisabled(), "el botón no está deshabilitado")
}, "u05-mix-sin-equipo")

await pa.reload({ waitUntil: "networkidle" }); await pa.waitForTimeout(1500)
await check("6. El que publicó ve la oferta con la hora que propone y la campana de arriba avisa", pa, async () => {
  expect(await pa.getByText(/Propone/).count() > 0, "no muestra la hora propuesta")
  await pa.locator("header button:has(svg.lucide-bell), button[aria-label*='otificacion']").first().click()
  await pa.waitForTimeout(800)
  expect(await pa.getByText(/oferta/i).count() > 1, "la campana no muestra la oferta")
  await pa.keyboard.press("Escape")
}, "u06-oferta-y-campana")
await check("7. Elegir: la práctica pasa a Mis PCW con la hora propuesta", pa, async () => {
  await pa.getByRole("button", { name: "Elegir" }).first().click()
  await pa.waitForTimeout(2500)
  await pa.getByRole("tab", { name: /Mis PCW/ }).click()
  await pa.waitForTimeout(800)
  expect(await pa.getByText("Nova", { exact: false }).count() > 0, "no aparece el rival")
  expect(await pa.getByText(/Mañana|En 1 día|\d\d:\d\d/).count() > 0, "sin hora")
}, "u07-mis-pcw")

const pz = await login(Z)
await check("8. Equipo sancionado: aviso arriba y la oferta como equipo bloqueada", pz, async () => {
  expect(await pz.getByText(/sanción de PCW/).count() > 0, "sin aviso de sanción")
}, "u08-sancion")

await check("9. Rival marca listos: la tarjeta grande muestra 'Listos' del lado del rival", pa, async () => {
  await pn.goto(W + "/pcw", { waitUntil: "networkidle" }); await pn.waitForTimeout(1200)
  await pn.getByRole("tab", { name: /Mis PCW/ }).click()
  await pn.getByRole("button", { name: "Estamos listos" }).first().click()
  await pn.waitForTimeout(1500)
  await pa.reload({ waitUntil: "networkidle" }); await pa.waitForTimeout(1500)
  await pa.getByRole("tab", { name: /Mis PCW/ }).click()
  await pa.waitForTimeout(800)
  expect(await pa.getByText("Listos", { exact: true }).count() === 1, "no muestra al rival listo")
}, "u09-rival-listo")
await check("10. Los dos listos con mapa fijo: 'Ir a la sala' y la sala sin veto (Buscando servidor)", pa, async () => {
  await pa.getByRole("button", { name: "Estamos listos" }).first().click()
  await pa.waitForTimeout(2500)
  await pa.reload({ waitUntil: "networkidle" }); await pa.waitForTimeout(1500)
  await pa.getByRole("tab", { name: /Mis PCW/ }).click()
  await pa.getByRole("button", { name: /Ir a la sala/ }).first().click()
  await pa.waitForTimeout(4000)
  expect(await pa.getByText("Veto de mapas").count() === 0, "muestra el veto con mapas fijos")
  expect(await pa.getByText(/servidor/i).count() > 0, "no habla del servidor")
}, "u10-sala-sin-veto")
await check("11. 'Ya no estamos listos' desde la sala vuelve a Mis PCW", pa, async () => {
  await pa.getByRole("button", { name: "Ya no estamos listos" }).click()
  await pa.waitForTimeout(2500)
  expect(await pa.getByText("Mis PCW").count() > 0 && !pa.url().includes("sala="), "no volvió")
}, "u11-ya-no-listos")

const pm = await login(N, true)
await check("12. En celular: tablón y Mis PCW sin scroll horizontal", pm, async () => {
  const w = await pm.evaluate(() => document.documentElement.scrollWidth)
  expect(w <= 391, `ancho ${w}`)
  await pm.getByRole("tab", { name: /Mis PCW/ }).click(); await pm.waitForTimeout(800)
  const w2 = await pm.evaluate(() => document.documentElement.scrollWidth)
  expect(w2 <= 391, `ancho en Mis PCW ${w2}`)
}, "u12-celular")

const pv = await login(A)
await check("13. El menú del costado muestra PCW activo (sin 'Pronto')", pv, async () => {
  expect(await pv.getByText("Pronto").count() === 0, "dice Pronto")
})

for (const r of results) console.log(r.join(" | "))
console.log(`\n${results.filter((r) => r[0] === "ok").length} de ${results.length} en verde`)
await b.close()
