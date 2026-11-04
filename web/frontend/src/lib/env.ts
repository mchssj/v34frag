import { z } from "zod"

const EnvSchema = z.object({
  VITE_API_URL: z.url({
    message: "tiene que ser una URL (ej. http://localhost:8787)",
  }),
})

function loadEnv() {
  const parsed = EnvSchema.safeParse(import.meta.env)
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")
    throw new Error(
      `Configuración inválida (${problems}). Copia .env.example como .env.local.`
    )
  }
  return { apiUrl: parsed.data.VITE_API_URL.replace(/\/+$/, "") }
}

export const env = loadEnv()
