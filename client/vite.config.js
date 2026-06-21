import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react-pdf'],
    // pdfjs-dist is a peer dependency; let Vite pre-bundle it consistently
    // so the worker URL resolution works in dev.
    exclude: ['pdfjs-dist']
  },
  worker: {
    format: 'es'
  },
  server: {
    // Pin the dev server to a single port. The backend's Google OAuth callback
    // always redirects to http://localhost:5173 (FRONTEND_URL), and the auth
    // token is saved in localStorage, which is scoped per origin (port).
    // Without this, Vite silently falls back to 5174/5175 when 5173 is busy,
    // landing you on a different origin with empty storage — so you appear
    // logged out and have to sign in again. strictPort makes a duplicate
    // `npm run dev` fail loudly instead of drifting to a new port.
    port: 5173,
    strictPort: true,
    // The PDF reader fetches PDFs from the backend (port 5000). Vite's dev
    // server doesn't proxy /uploads, so the request goes directly to the
    // Express server. Make sure the backend has CORS enabled.
    fs: {
      // Allow serving files from node_modules so the `?url` import for the
      // pdf.js worker resolves correctly.
      allow: ['..']
    }
  }
})
