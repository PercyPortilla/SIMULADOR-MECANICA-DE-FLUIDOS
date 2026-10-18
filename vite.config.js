import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
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
