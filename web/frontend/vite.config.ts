import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  // Caché de dependencias siempre dentro de web/frontend (si no, puede terminar en web/node_modules).
  cacheDir: resolve(import.meta.dirname, "node_modules/.vite"),
  plugins: [
    // Tiene que ir antes que react(): genera src/routeTree.gen.ts desde src/routes.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
})
