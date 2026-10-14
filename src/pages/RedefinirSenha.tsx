import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LayoutLogin, { Aviso, TituloCartao } from '../components/LayoutLogin'
import CampoSenha from '../components/CampoSenha'
import { IconeSeta } from '../components/Icones'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

const TAMANHO_MINIMO = 8

export default function RedefinirSenha() {
  const navigate = useNavigate()
  const { sessao, carregando } = useAuth()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha.length < TAMANHO_MINIMO) return setErro(`A senha precisa ter pelo menos ${TAMANHO_MINIMO} caracteres.`)
    if (senha !== confirmacao) return setErro('As duas senhas não são iguais.')

    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setEnviando(false)
      setErro(
        error.code === 'same_password'
          ? 'A nova senha precisa ser diferente da anterior.'
          : error.code === 'weak_password'
            ? 'Senha fraca. Use letras, números e algum símbolo.'
            : 'Não foi possível salvar a nova senha. Peça um novo link e tente de novo.',
      )
      return
    }
    // Encerra todas as sessões abertas (em qualquer aparelho) e pede para entrar de novo.
    await supabase.auth.signOut({ scope: 'global' })
    navigate('/login', { replace: true, state: { mensagem: 'Senha alterada! Entre com a sua nova senha.' } })
  }

  if (carregando) return null

  return (
    <LayoutLogin>
      <TituloCartao titulo="Crie sua nova senha" subtitulo="Escolha uma senha segura" />

      {!sessao ? (
        <div className="space-y-6 text-center">
          <Aviso tipo="erro">Esse link de recuperação expirou ou já foi usado.</Aviso>
          <Link to="/esqueci-senha" className="link">Pedir um novo link</Link>
        </div>
      ) : (
        <form onSubmit={salvar} className="space-y-6">
          <div>
            <label htmlFor="senha" className="rotulo">Nova senha</label>
            <CampoSenha
              id="senha"
              valor={senha}
              aoMudar={setSenha}
              autoComplete="new-password"
              placeholder={`Mínimo de ${TAMANHO_MINIMO} caracteres`}
            />
          </div>
          <div>
            <label htmlFor="confirmacao" className="rotulo">Repita a nova senha</label>
            <CampoSenha
              id="confirmacao"
              valor={confirmacao}
              aoMudar={setConfirmacao}
              autoComplete="new-password"
              placeholder="Digite a senha de novo"
            />
          </div>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <button type="submit" className="botao-principal" disabled={enviando}>
            {enviando ? 'Salvando…' : 'Salvar nova senha'}
            <IconeSeta className="absolute right-6 h-7 w-7" />
          </button>
        </form>
      )}
    </LayoutLogin>
  )
}
