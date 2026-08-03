import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest config
// for DOM-dependent tests (useHighlightCapture) and use the React plugin
// so any future component tests can import JSX freely.
export default defineConfig({
  plugins: [react()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react'
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    // Isolate each test file's fake timers so we don't accidentally share
    // debounce state between files.
    isolate: true
  }
});
