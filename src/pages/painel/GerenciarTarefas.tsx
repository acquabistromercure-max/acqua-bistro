import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PAPEIS } from '../../lib/permissoes'
import type { Frequencia } from '../../lib/periodos'
import { Botao, Campo, Janela, Mensagem, Selecao, Selo, mensagemErro } from '../../components/ui'
import { BotaoExcluir } from '../../components/registros'
import type { Tarefa } from './Rotina'

const OPCOES_FREQ = [
  { valor: 'diaria', rotulo: 'Diária' },
  { valor: 'semanal', rotulo: 'Semanal' },
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'anual', rotulo: 'Anual' },
]

/** Cadastro das tarefas da rotina (quem pode editar o painel). Tarefas não são apagadas, só desativadas. */
export default function GerenciarTarefas({ aoFechar }: { aoFechar: () => void }) {
  const qc = useQueryClient()
  const [titulo, setTitulo] = useState('')
  const [frequencia, setFrequencia] = useState<Frequencia>('diaria')
  const [papel, setPapel] = useState('')

  const todas = useQuery({
    queryKey: ['rotina-tarefas-todas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rotina_tarefas').select('*').order('frequencia').order('ordem')
      if (error) throw error
      return data as Tarefa[]
    },
  })

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['rotina-tarefas'] })
    qc.invalidateQueries({ queryKey: ['rotina-tarefas-todas'] })
  }

  const criar = useMutation({
    mutationFn: async () => {
      const ordem = (todas.data ?? []).filter((t) => t.frequencia === frequencia).length + 1
      const { error } = await supabase.from('rotina_tarefas').insert({ titulo: titulo.trim(), frequencia, papel: papel || null, ordem })
      if (error) throw error
    },
    onSuccess: () => {
      setTitulo('')
      atualizar()
    },
  })

  const alternar = useMutation({
    mutationFn: async (t: Tarefa) => {
      const { error } = await supabase.from('rotina_tarefas').update({ ativo: !t.ativo }).eq('id', t.id)
      if (error) throw error
    },
    onSuccess: atualizar,
  })

  const erro = criar.error || alternar.error

  return (
    <Janela aberta aoFechar={aoFechar} titulo="Tarefas da rotina" largura="max-w-2xl" rodape={<Botao variante="secundario" onClick={aoFechar}>Fechar</Botao>}>
      <form
        className="mb-5 grid gap-3 rounded-xl bg-acqua-gelo p-3 sm:grid-cols-[1fr,auto,auto,auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (titulo.trim()) criar.mutate()
        }}
      >
        <Campo rotulo="Nova tarefa" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Conferir estoque de frios" />
        <Selecao rotulo="Frequência" value={frequencia} onChange={(e) => setFrequencia(e.target.value as Frequencia)} opcoes={OPCOES_FREQ} />
        <Selecao
          rotulo="Para quem"
          value={papel}
          onChange={(e) => setPapel(e.target.value)}
          vazio="Todos"
          opcoes={PAPEIS.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))}
        />
        <Botao type="submit" icone={<Plus className="h-4 w-4" />} carregando={criar.isPending}>Incluir</Botao>
      </form>
      {erro && <div className="mb-3"><Mensagem tipo="erro">{mensagemErro(erro)}</Mensagem></div>}
      <ul className="divide-y divide-acqua-suave">
        {(todas.data ?? []).map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className={t.ativo ? 'text-sm text-acqua-titulo' : 'text-sm text-slate-400 line-through'}>{t.titulo}</p>
              <p className="text-xs text-slate-500">
                {OPCOES_FREQ.find((f) => f.valor === t.frequencia)?.rotulo}
                {t.papel && ` · só ${PAPEIS.find((p) => p.valor === t.papel)?.rotulo}`}
              </p>
            </div>
            {!t.ativo && <Selo>Desativada</Selo>}
            <BotaoExcluir modulo="painel" tabela="rotina_tarefas" id={t.id} descricao={`a tarefa “${t.titulo}”`} aoExcluir={atualizar} className="" />
            <Botao variante="secundario" onClick={() => alternar.mutate(t)} disabled={alternar.isPending}>
              {t.ativo ? 'Desativar' : 'Reativar'}
            </Botao>
          </li>
        ))}
      </ul>
    </Janela>
  )
}
