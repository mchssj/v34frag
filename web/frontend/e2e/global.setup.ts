import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { expect, test as setup } from "@playwright/test"

import {
  API,
  APP,
  PASSWORD,
  STORAGE_KEY,
  USER_INFO,
  USER_STATE,
  uniqueUser,
} from "./helpers"
import { spendAuth } from "./authBudget"

// Crea la cuenta compartida por la API y guarda su sesión, sin gastar un login por prueba.
setup("cuenta compartida", async ({ request }) => {
  const health = await request.get(`${API}/api/health?deep=1`)
  expect(
    health.ok(),
    `La API no responde en ${API}: levanta web/backend antes`
  ).toBeTruthy()

  const user = uniqueUser("main")
  await spendAuth()
  const res = await request.post(`${API}/auth/signup`, {
    data: { email: user.email, password: PASSWORD, tag: user.alias },
  })
  expect(res.status(), await res.text()).toBe(201)
  const body = await res.json()
  expect(
    body.needsConfirmation,
    "La Supabase local no debería pedir confirmación"
  ).toBe(false)

  const s = body.session
  const session = {
    accessToken: s.access_token,
    refreshToken: s.refresh_token,
    expiresAt: s.expires_at * 1000,
  }
  mkdirSync(dirname(USER_STATE), { recursive: true })
  writeFileSync(
    USER_STATE,
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: APP,
          localStorage: [
            { name: STORAGE_KEY, value: JSON.stringify(session) },
            // La Bienvenida ya vista: estas pruebas no tratan sobre ella.
            { name: `csstv.welcome-seen.${s.user.id}`, value: "1" },
          ],
        },
      ],
    })
  )
  writeFileSync(USER_INFO, JSON.stringify({ ...user, id: s.user.id }))
})
