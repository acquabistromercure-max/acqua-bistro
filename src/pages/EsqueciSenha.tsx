import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import LayoutLogin, { Aviso, TituloCartao } from '../components/LayoutLogin'
import { IconeEmail, IconeSeta } from '../components/Icones'
import { supabase, supabaseConfigurado, urlDoSite } from '../lib/supabase'

export default function EsqueciSenha() {
  const [params] = useSearchParams()
  const linkInvalido = params.get('link') === 'invalido'
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!supabaseConfigurado) {
      setErro('O sistema ainda não está conectado ao banco de dados. Avise o administrador.')
      return
    }
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlDoSite() })
    setEnviando(false)
    // Só mostramos erro de limite de envios; qualquer outro caso recebe a mesma resposta,
    // para não revelar se o e-mail está cadastrado.
    if (error?.status === 429) {
      setErro('Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo.')
      return
    }
    setEnviado(true)
  }

  return (
    <LayoutLogin>
      <TituloCartao titulo="Esqueceu sua senha?" subtitulo="Vamos te ajudar a criar uma nova" />

      {enviado ? (
        <div className="space-y-6">
          <Aviso tipo="sucesso">
            Se <strong>{email.trim()}</strong> estiver cadastrado, você vai receber em instantes um e-mail com um link
            para criar uma nova senha. O link vale por pouco tempo e só pode ser usado uma vez.
          </Aviso>
          <p className="text-sm text-slate-600">Não chegou? Confira a caixa de spam ou peça de novo daqui a alguns minutos.</p>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-6">
          {linkInvalido && (
            <Aviso tipo="erro">Esse link de recuperação expirou ou já foi usado. Peça um novo abaixo.</Aviso>
          )}
          <p className="text-[15px] leading-relaxed text-slate-600">
            Informe o e-mail que você usa para entrar. Enviaremos um link para você criar uma nova senha.
          </p>
          <div>
            <label htmlFor="email" className="rotulo">E-mail</label>
            <div className="campo">
              <IconeEmail className="h-6 w-6 shrink-0 text-acqua-icone" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@e-mail.com"
                autoComplete="username"
                inputMode="email"
                required
              />
            </div>
          </div>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <button type="submit" className="botao-principal" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar link'}
            <IconeSeta className="absolute right-6 h-7 w-7" />
          </button>
        </form>
      )}

      <div className="mt-8 text-center">
        <Link to="/login" className="link">Voltar para o login</Link>
      </div>
    </LayoutLogin>
  )
}
