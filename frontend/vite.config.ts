import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// The API lives on FastAPI at 127.0.0.1:8000. A dev proxy keeps the browser on
// one origin, which also avoids CORS surprises when we flip VITE_USE_FIXTURES=0.
export default defineConfig({
  plugins: [react()],
  // Declared explicitly: some Windows checkouts fail to discover postcss.config.js.
  css: { postcss: { plugins: [tailwindcss(), autoprefixer()] } },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
