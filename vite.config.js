import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        municipios: resolve(__dirname, 'municipios.html'),
        escolas: resolve(__dirname, 'escolas.html'),
        e404: resolve(__dirname, '404.html'),
        e402: resolve(__dirname, '402.html')
      }
    }
  },
  publicDir: 'public'
})
