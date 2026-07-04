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
  build: {
    rollupOptions: {
      output: {
        // Split large shared libraries into their own long-term-cacheable
        // chunks. They are only pulled in by the lazily-loaded routes that
        // use them, so this keeps them out of the entry bundle while avoiding
        // duplicating them across every route chunk.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-pdf') || id.includes('pdfjs-dist')) return 'pdf';
          if (id.includes('katex') || id.includes('rehype-katex') || id.includes('remark') || id.includes('micromark') || id.includes('mdast')) return 'katex';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('socket.io')) return 'socket';
          if (id.includes('react-router') || id.includes('/react-dom/') || id.includes('/react/') || id.includes('scheduler')) return 'react-vendor';
          return undefined;
        }
      }
    }
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
