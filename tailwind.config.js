/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // computador com tela alta: usa o espaçamento generoso do mockup
        alto: { raw: '(min-width: 1024px) and (min-height: 880px)' },
      },
      colors: {
        acqua: {
          DEFAULT: '#83C7D8', // azul acqua
          profundo: '#354866', // azul profundo
          dourado: '#D9A126',
          gelo: '#F7FAFB', // branco gelo
          suave: '#E4F2F5', // azul suave
          petroleo: '#397C96', // subtítulo e destaques (cores do SVG da tela)
          titulo: '#102C61', // azul-marinho dos títulos (SVG da tela)
          icone: '#4D70A0', // ícones dos campos
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
