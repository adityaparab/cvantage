import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // NestJS (ServeStaticModule) serves this folder in production.
    outDir: 'dist',
  },
  server: {
    port: 5173,
    // In development the client runs on Vite (5173) and the API on Nest (3000).
    // Proxying /api keeps everything same-origin, so no CORS is needed and the
    // same fetch('/api/...') calls work unchanged in production.
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
