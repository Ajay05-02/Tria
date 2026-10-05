import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The built site goes into ../static, which the FastAPI server already serves (and Docker already copies),
// so deploying needs no Node.js. During `npm run dev`, API calls are passed to the Python server on port 8000.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "../static", emptyOutDir: true, chunkSizeWarningLimit: 1200 },
  server: { proxy: { "/api": "http://127.0.0.1:8000" } },
})
