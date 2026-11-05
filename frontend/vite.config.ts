import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API lives on FastAPI at 127.0.0.1:8000. A dev proxy keeps the browser on
// one origin, which also avoids CORS surprises when we flip VITE_USE_FIXTURES=0.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
