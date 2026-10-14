import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import LayoutLogin, { Aviso, TituloCartao } from '../components/LayoutLogin'
import CampoSenha from '../components/CampoSenha'
import { IconeEmail, IconeSeta } from '../components/Icones'
import { supabase, supabaseConfigurado } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const mensagem = (useLocation().state as { mensagem?: string } | null)?.mensagem
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!supabaseConfigurado) {
      setErro('O sistema ainda não está conectado ao banco de dados. Avise o administrador.')
      return
    }
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    if (error) {
      // Mensagem genérica de propósito: não revela se o e-mail existe.
      setErro(
        error.status === 429
          ? 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
          : 'E-mail ou senha incorretos. Confira e tente novamente.',
      )
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <LayoutLogin>
      <TituloCartao titulo="Bem-vindo(a) ao Acqua Bistrô" subtitulo="Acesse sua conta para continuar" />

      <form onSubmit={entrar} className="space-y-6 alto:space-y-9">
        {mensagem && <Aviso tipo="sucesso">{mensagem}</Aviso>}

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

        <div>
          <label htmlFor="senha" className="rotulo">Senha</label>
          <CampoSenha id="senha" valor={senha} aoMudar={setSenha} autoComplete="current-password" />
        </div>

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="pt-4 alto:pt-6">
          <button type="submit" className="botao-principal" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
            <IconeSeta className="absolute right-6 h-7 w-7" />
          </button>
          <div className="mt-6 text-right">
            <Link to="/esqueci-senha" className="link">Esqueci minha senha</Link>
          </div>
        </div>
      </form>

      <div className="mt-10 flex items-center gap-5 rounded-xl bg-[#F0F3F7] px-4 py-5 text-[13px] leading-relaxed sm:px-6 sm:text-[15px] text-acqua-titulo">
        <IconeEmail className="h-6 w-6 shrink-0 text-[#277B9D] sm:h-8 sm:w-8" />
        <p className="min-w-0 break-words">
          Os e-mails de recuperação de senha são enviados de <strong>acquabistromercure@gmail.com</strong>.
        </p>
      </div>
    </LayoutLogin>
  )
}
