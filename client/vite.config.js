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
