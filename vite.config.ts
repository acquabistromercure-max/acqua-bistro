import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// "base" relativo: o mesmo site funciona em https://acquabistro.site/ e no endereço antigo
// do GitHub Pages (/acqua-bistro/). As páginas usam "#/", então tudo parte do index.html.
export default defineConfig({
  base: './',
  plugins: [react()],
  // O pacote base (React + Supabase) tem ~160 KB comprimido; as telas são carregadas sob demanda.
  build: { chunkSizeWarningLimit: 700 },
})
