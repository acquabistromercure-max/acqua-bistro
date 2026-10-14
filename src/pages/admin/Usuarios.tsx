import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, UserPlus } from 'lucide-react'
import { supabase, urlDoSite } from '../../lib/supabase'
import { PAPEIS, rotuloPapel, usePermissoes, type Papel, type Perfil } from '../../lib/permissoes'
import { formatarDataHora } from '../../lib/formatos'
import { Botao, Campo, Carregando, Confirmar, Janela, Mensagem, Pagina, Selecao, Selo, Tabela, mensagemErro } from '../../components/ui'

type Linha = Perfil & { criado_em: string }

async function chamarAdmin(corpo: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-usuarios', { body: corpo })
  if (error) {
    // A função devolve { erro } com a explicação; o supabase-js entrega isso dentro de error.context.
    const detalhe = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(detalhe?.erro ?? 'Não foi possível concluir. Tente novamente.')
  }
  if (data?.erro) throw new Error(data.erro)
  return data
}

const opcoesPapel = PAPEIS.map((p) => ({ valor: p.valor, rotulo: `${p.rotulo} — ${p.descricao}` }))

export default function Usuarios() {
  const qc = useQueryClient()
  const { perfil: eu } = usePermissoes()
  const [convidando, setConvidando] = useState(false)
  const [editando, setEditando] = useState<Linha | null>(null)
  const [aviso, setAviso] = useState('')

  const lista = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('perfis').select('id, email, nome, papel, ativo, criado_em').order('nome')
      if (error) throw error
      return data as Linha[]
    },
  })

  const atualizar = () => qc.invalidateQueries({ queryKey: ['usuarios'] })

  return (
    <Pagina
      titulo="Usuários"
      descricao="Quem acessa o sistema e com qual papel. Somente administradores veem esta tela."
      acoes={<Botao icone={<UserPlus className="h-4 w-4" />} onClick={() => setConvidando(true)}>Convidar usuário</Botao>}
    >
      {aviso && <div className="mb-4"><Mensagem tipo="sucesso">{aviso}</Mensagem></div>}
      {lista.isLoading ? (
        <Carregando />
      ) : lista.error ? (
        <Mensagem tipo="erro">{mensagemErro(lista.error)}</Mensagem>
      ) : (
        <Tabela
          linhas={lista.data ?? []}
          chave={(u) => u.id}
          aoClicar={(u) => setEditando(u)}
          colunas={[
            { titulo: 'Nome', celula: (u) => <span className="font-semibold">{u.nome || '—'}</span> },
            { titulo: 'E-mail', celula: (u) => u.email },
            { titulo: 'Papel', celula: (u) => <Selo cor={u.papel === 'administrador' ? 'dourado' : 'azul'}>{rotuloPapel(u.papel)}</Selo> },
            { titulo: 'Situação', celula: (u) => (u.ativo ? <Selo cor="verde">Ativo</Selo> : <Selo cor="vermelho">Desativado</Selo>) },
            { titulo: 'Desde', celula: (u) => formatarDataHora(u.criado_em).slice(0, 10) },
          ]}
        />
      )}

      <JanelaConvite
        aberta={convidando}
        aoFechar={() => setConvidando(false)}
        aoConcluir={(email) => {
          setConvidando(false)
          setAviso(`Convite enviado para ${email}. A pessoa recebe um e-mail para criar a própria senha.`)
          atualizar()
        }}
      />
      {editando && (
        <JanelaEdicao
          usuario={editando}
          souEu={editando.id === eu?.id}
          aoFechar={() => setEditando(null)}
          aoConcluir={(msg) => {
            setEditando(null)
            setAviso(msg)
            atualizar()
          }}
        />
      )}
    </Pagina>
  )
}

function JanelaConvite({ aberta, aoFechar, aoConcluir }: { aberta: boolean; aoFechar: () => void; aoConcluir: (email: string) => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<Papel>('operador')
  const convite = useMutation({
    mutationFn: () => chamarAdmin({ acao: 'convidar', nome, email, papel, redirectTo: urlDoSite() }),
    onSuccess: () => {
      aoConcluir(email.trim())
      setNome('')
      setEmail('')
    },
  })
  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Convidar usuário"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-convite" carregando={convite.isPending}>Enviar convite</Botao>
        </>
      }
    >
      <form
        id="form-convite"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          convite.mutate()
        }}
      >
        <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
        <Campo rotulo="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Selecao rotulo="Papel" value={papel} onChange={(e) => setPapel(e.target.value as Papel)} opcoes={opcoesPapel} />
        <p className="text-xs text-slate-500">
          A pessoa recebe um e-mail com um link para criar a senha. Enquanto o envio próprio pelo Gmail não for configurado, o
          Supabase limita a poucos e-mails por hora.
        </p>
        {convite.error && <Mensagem tipo="erro">{(convite.error as Error).message}</Mensagem>}
      </form>
    </Janela>
  )
}

function JanelaEdicao({
  usuario,
  souEu,
  aoFechar,
  aoConcluir,
}: {
  usuario: Linha
  souEu: boolean
  aoFechar: () => void
  aoConcluir: (msg: string) => void
}) {
  const [nome, setNome] = useState(usuario.nome ?? '')
  const [papel, setPapel] = useState<Papel>(usuario.papel)
  const [confirmando, setConfirmando] = useState(false)

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('perfis').update({ nome: nome.trim() || null, papel }).eq('id', usuario.id)
      if (error) throw error
    },
    onSuccess: () => aoConcluir('Usuário atualizado.'),
  })

  const alternar = useMutation({
    mutationFn: () => chamarAdmin({ acao: usuario.ativo ? 'desativar' : 'reativar', id: usuario.id }),
    onSuccess: () => aoConcluir(usuario.ativo ? 'Usuário desativado. Ele não consegue mais entrar.' : 'Usuário reativado.'),
  })

  const redefinir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.resetPasswordForEmail(usuario.email, { redirectTo: urlDoSite() })
      if (error) throw error
    },
    onSuccess: () => aoConcluir(`Link para criar nova senha enviado para ${usuario.email}.`),
  })

  const erro = salvar.error || alternar.error || redefinir.error

  return (
    <>
      <Janela
        aberta
        aoFechar={aoFechar}
        titulo="Editar usuário"
        rodape={
          <>
            {!souEu && (
              <Botao variante={usuario.ativo ? 'perigo' : 'secundario'} onClick={() => setConfirmando(true)} className="mr-auto">
                {usuario.ativo ? 'Desativar' : 'Reativar'}
              </Botao>
            )}
            <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
            <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Botao>
          </>
        }
      >
        <div className="space-y-4">
          <Campo rotulo="E-mail" value={usuario.email} disabled />
          <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Selecao
            rotulo="Papel"
            value={papel}
            onChange={(e) => setPapel(e.target.value as Papel)}
            opcoes={opcoesPapel}
            ajuda={souEu ? 'Cuidado: se deixar de ser administrador, você perde acesso a esta tela.' : undefined}
          />
          <Botao variante="secundario" icone={<KeyRound className="h-4 w-4" />} carregando={redefinir.isPending} onClick={() => redefinir.mutate()}>
            Enviar link para nova senha
          </Botao>
          {erro && <Mensagem tipo="erro">{mensagemErro(erro)}</Mensagem>}
        </div>
      </Janela>
      <Confirmar
        aberta={confirmando}
        titulo={usuario.ativo ? 'Desativar usuário?' : 'Reativar usuário?'}
        mensagem={
          usuario.ativo
            ? `${usuario.nome || usuario.email} não conseguirá mais entrar e as sessões abertas serão encerradas. O histórico continua guardado.`
            : `${usuario.nome || usuario.email} volta a conseguir entrar com o papel ${rotuloPapel(usuario.papel)}.`
        }
        textoConfirmar={usuario.ativo ? 'Desativar' : 'Reativar'}
        perigo={usuario.ativo}
        carregando={alternar.isPending}
        aoConfirmar={() => {
          setConfirmando(false)
          alternar.mutate()
        }}
        aoFechar={() => setConfirmando(false)}
      />
    </>
  )
}
