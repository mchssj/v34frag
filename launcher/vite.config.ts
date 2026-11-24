import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// Tauri abre la interfaz desde el servidor de Vite en desarrollo (puerto fijo) y desde dist/ al compilar.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "es2022", outDir: "dist" },
})
