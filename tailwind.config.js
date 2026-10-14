/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        acqua: {
          DEFAULT: '#83C7D8', // azul acqua
          profundo: '#354866', // azul profundo
          dourado: '#D9A126',
          gelo: '#F7FAFB', // branco gelo
          suave: '#E4F2F5', // azul suave
          petroleo: '#2C7D93', // tom do botão "Entrar" no mockup
          titulo: '#1F2F5C', // azul-marinho dos títulos no mockup
        },
      },
      fontFamily: {
        serif: ['"Libre Caslon Text"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
