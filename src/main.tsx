import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { supabase } from './lib/supabase'
import './index.css'

/**
 * O link do e-mail de recuperação volta para o site com os dados no fim do endereço
 * (ex.: "#access_token=...&type=recovery" ou "#error=...&error_code=otp_expired").
 * O site usa "#/" para as páginas, então tratamos esse retorno antes de desenhar a tela.
 */
async function tratarRetornoDoEmail() {
  const hash = window.location.hash
  if (hash.includes('type=recovery') || hash.includes('type=invite')) {
    await supabase.auth.getSession() // espera o Supabase ler o link e abrir a sessão temporária
    window.location.replace('#/redefinir-senha')
  } else if (hash.includes('error_code=') || hash.includes('error=')) {
    window.location.replace('#/esqueci-senha?link=invalido')
  }
}

tratarRetornoDoEmail().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
