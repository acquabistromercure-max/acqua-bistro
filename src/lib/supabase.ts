import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigurado = Boolean(url && anonKey)

if (!supabaseConfigurado) {
  console.error('Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY (arquivo .env ou secrets do GitHub).')
}

// Valores de reserva só evitam que a página quebre se o .env estiver faltando;
// nesse caso a tela de login mostra um aviso em vez de tentar entrar.
export const supabase = createClient(url || 'https://exemplo.supabase.co', anonKey || 'chave-ausente', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** Endereço da página inicial do site (funciona no Codespace e no GitHub Pages). */
export function urlDoSite(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}
