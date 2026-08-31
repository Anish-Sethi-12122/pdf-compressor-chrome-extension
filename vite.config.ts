import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // pdf-lib is ~620 KB minified and cannot be split further.
    // This is expected and acceptable for a local extension bundle.
    chunkSizeWarningLimit: 700,
  },
})
