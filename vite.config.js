import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  server: {
    // Chrome's local QA profile contains locked SQLite databases that cannot
    // be watched by Vite on Windows; it is not part of the application.
    watch: { ignored: ['**/qa-artifacts/pipe-cdp-profile/**'] },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        babylonPreview: resolve(rootDir, 'babylon-preview.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@babylonjs/')) return 'babylon';
          return undefined;
        },
      },
    },
  },
});
