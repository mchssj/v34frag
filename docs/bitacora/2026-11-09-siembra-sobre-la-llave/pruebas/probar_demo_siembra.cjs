// Prueba de /demo/siembra con Playwright: arrastrar, tocar y poner, vaciar, completar y formatos.
const { createRequire } = require("module")
// Correr desde cualquier lado con `node probar_demo_siembra.cjs <carpeta de capturas>`, con `pnpm dev --port 5199` en web/frontend.
const req = createRequire(require("path").resolve(__dirname, "../../../../web/frontend/package.json"))
const { chromium } = req("@playwright/test")
const out = process.argv[2]
const ok = []
const check = (name, cond) => { ok.push(`${cond ? "OK " : "MAL"} ${name}`) }

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, colorScheme: "dark" })
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto("http://localhost:5199/demo/siembra")
  await page.getByRole("heading", { name: "Llave" }).waitFor()
  await page.screenshot({ path: `${out}/1-inicial.png`, fullPage: true })

  const slot = (n) => page.getByRole("button", { name: new RegExp(`^Siembra ${n}: `) })
  check("8 equipos en la llave", (await page.getByRole("button", { name: /^Siembra \d+: / }).count()) === 8)

  // Arrastrar el #1 sobre el #8: intercambian.
  await slot(1).dragTo(slot(8))
  check("arrastrar intercambia", (await slot(1).getAttribute("aria-label")).includes("Kraken CS") && (await slot(8).getAttribute("aria-label")).includes("Ocaso Gaming"))
  check("guardar habilitado con cambios", await page.getByRole("button", { name: "Guardar siembra" }).isEnabled())

  // Sacar uno con la X: queda en Sin ubicar y Guardar se bloquea.
  await page.getByRole("button", { name: "Sacar a Vértigo de la llave" }).click()
  check("sacar deja un hueco", (await page.getByRole("button", { name: /^Vértigo, siembra guardada/ }).count()) === 1)
  check("guardar bloqueado con huecos", await page.getByRole("button", { name: "Guardar siembra" }).isDisabled())
  check("aviso faltan", (await page.getByText("Falta 1 equipo por ubicar").count()) === 1)

  // Tocar y poner: Vértigo al lugar libre.
  await page.getByRole("button", { name: /^Vértigo, siembra guardada/ }).click()
  await page.getByRole("button", { name: "Poner aquí a Vértigo" }).click()
  check("tocar y poner", (await slot(2).getAttribute("aria-label")).includes("Vértigo"))

  // Vaciar y completar en orden.
  await page.getByRole("button", { name: "Vaciar" }).click()
  check("vaciar", (await page.getByRole("button", { name: /^Siembra \d+: / }).count()) === 0)
  await page.screenshot({ path: `${out}/2-vacia.png`, fullPage: true })
  // Arrastrar desde Sin ubicar al #1.
  await page.getByRole("button", { name: /^Kraken CS, siembra guardada/ }).dragTo(page.getByRole("button", { name: "Lugar libre" }).first())
  check("arrastrar desde la columna", (await slot(1).getAttribute("aria-label")).includes("Kraken CS"))
  await page.getByRole("button", { name: "Completar huecos en orden" }).click()
  check("completar en orden", (await page.getByRole("button", { name: /^Siembra \d+: / }).count()) === 8 && (await slot(2).getAttribute("aria-label")).includes("Ocaso Gaming"))
  // Arrastrar uno de la llave a la columna lo saca.
  await slot(3).dragTo(page.getByRole("complementary", { name: "Equipos sin ubicar" }))
  check("soltar en la columna lo saca", (await page.getByRole("button", { name: /^Siembra \d+: / }).count()) === 7)
  await page.getByRole("button", { name: "Deshacer cambios" }).click()
  check("deshacer", (await slot(1).getAttribute("aria-label")).includes("Ocaso Gaming") && (await page.getByRole("button", { name: "Guardar siembra" }).isDisabled()))

  const formats = ["Eliminación directa · 6", "Doble eliminación · 8", "Grupos + playoffs · 8", "Grupos de doble eliminación · 8", "Suizo · 8", "Suizo · 24"]
  for (const [i, f] of formats.entries()) {
    await page.getByRole("button", { name: f, exact: true }).click()
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${out}/${i + 3}-${f.replace(/[^a-z0-9]+/gi, "_")}.png`, fullPage: true })
  }
  check("6 equipos: 2 byes", true)
  await page.getByRole("button", { name: "Eliminación directa · 6", exact: true }).click()
  check("byes", (await page.getByText("Libre: pasa solo").count()) === 2)
  await page.getByRole("button", { name: "Suizo · 24", exact: true }).click()
  check("suizo 24: 24 lugares", (await page.getByRole("button", { name: /^Siembra \d+: / }).count()) === 24)

  await page.getByRole("button", { name: "Simular fixture generado" }).click()
  check("fixture generado: sin botones", (await page.getByRole("button", { name: "Guardar siembra" }).count()) === 0 && (await page.getByRole("complementary").count()) === 0)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole("button", { name: "Volver a inscripciones" }).click()
  await page.getByRole("button", { name: "Eliminación directa · 8", exact: true }).click()
  await page.waitForTimeout(200)
  const sw = await page.evaluate(() => document.documentElement.scrollWidth)
  check(`celular sin scroll horizontal de página (${sw})`, sw <= 390)
  await page.screenshot({ path: `${out}/9-celular.png`, fullPage: true })

  check(`sin errores de página (${errors.join(" | ")})`, errors.length === 0)
  console.log(ok.join("\n"))
  await browser.close()
})().catch((e) => { console.log(ok.join("\n")); console.error(e); process.exit(1) })
