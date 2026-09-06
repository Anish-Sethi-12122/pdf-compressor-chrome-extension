import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // REQUIRED for Chrome extension: Vite defaults to base='/' which produces
  // absolute /assets/... paths in index.html.  Absolute paths resolve against
  // the server origin, which does not exist in a chrome-extension:// context.
  // Empty-string base makes every emitted path relative (./assets/...) so the
  // popup HTML works correctly when loaded from chrome-extension://[id]/index.html
  base: '',

  // Treat .wasm files as static assets so Vite emits them with stable URLs
  // and the ?url import syntax works inside the Web Worker.
  assetsInclude: ['**/*.wasm'],

  build: {
    outDir: 'dist',
    emptyOutDir: true,

    // pdf-lib is ~620 KB minified — expected and acceptable for a local extension bundle.
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        // Keep WASM files adjacent to the JS that loads them
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.wasm')) {
            return 'assets/[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },

  worker: {
    // ES module workers are required for Vite's ?worker import syntax in MV3
    format: 'es',
  },
})
