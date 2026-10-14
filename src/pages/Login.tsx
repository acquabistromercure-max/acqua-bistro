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

      <form onSubmit={entrar} className="space-y-5">
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
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <label htmlFor="senha" className="rotulo !mb-0">Senha</label>
            <Link to="/esqueci-senha" className="link text-sm">Esqueci minha senha</Link>
          </div>
          <CampoSenha id="senha" valor={senha} aoMudar={setSenha} autoComplete="current-password" />
        </div>

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="pt-3">
          <button type="submit" className="botao-principal" disabled={enviando}>
            {enviando ? 'Entrando…' : 'Entrar'}
            <IconeSeta className="absolute right-5 h-6 w-6" />
          </button>
        </div>
      </form>
    </LayoutLogin>
  )
}
