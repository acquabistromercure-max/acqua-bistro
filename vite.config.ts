import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// "base" = nome do repositório, porque o GitHub Pages publica em /acqua-bistro/
export default defineConfig({
  base: '/acqua-bistro/',
  plugins: [react()],
})
