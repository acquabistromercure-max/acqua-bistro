import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Settings2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { chavePeriodo, type Frequencia } from '../../lib/periodos'
import { formatarDataHora } from '../../lib/formatos'
import { Abas, Botao, Cartao, Carregando, Mensagem, cx, mensagemErro } from '../../components/ui'
import GerenciarTarefas from './GerenciarTarefas'

export type Tarefa = {
  id: string
  titulo: string
  descricao: string | null
  frequencia: Frequencia
  papel: string | null
  ordem: number
  ativo: boolean
}
type Conclusao = { id: string; tarefa_id: string; periodo: string; concluido_por: string; concluido_em: string }

export const FREQUENCIAS: { valor: Frequencia; rotulo: string }[] = [
  { valor: 'diaria', rotulo: 'Hoje' },
  { valor: 'semanal', rotulo: 'Semana' },
  { valor: 'mensal', rotulo: 'Mês' },
  { valor: 'anual', rotulo: 'Ano' },
]

export default function Rotina({ data }: { data: string }) {
  const qc = useQueryClient()
  const { perfil, pode } = usePermissoes()
  const [aba, setAba] = useState<Frequencia>('diaria')
  const [gerenciando, setGerenciando] = useState(false)

  const periodos = FREQUENCIAS.map((f) => chavePeriodo(f.valor, data))

  const tarefas = useQuery({
    queryKey: ['rotina-tarefas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rotina_tarefas').select('*').eq('ativo', true).order('ordem')
      if (error) throw error
      return data as Tarefa[]
    },
  })

  const conclusoes = useQuery({
    queryKey: ['rotina-conclusoes', ...periodos],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rotina_conclusoes')
        .select('id, tarefa_id, periodo, concluido_por, concluido_em')
        .in('periodo', periodos)
      if (error) throw error
      return data as Conclusao[]
    },
  })

  const nomes = useQuery({
    queryKey: ['nomes-usuarios'],
    queryFn: async () => {
      const { data } = await supabase.from('perfis').select('id, nome, email')
      return new Map((data ?? []).map((p) => [p.id, p.nome || p.email]))
    },
  })

  const marcar = useMutation({
    mutationFn: async ({ tarefa, feita }: { tarefa: Tarefa; feita?: Conclusao }) => {
      const { error } = feita
        ? await supabase.from('rotina_conclusoes').delete().eq('id', feita.id)
        : await supabase.from('rotina_conclusoes').insert({ tarefa_id: tarefa.id, periodo: chavePeriodo(tarefa.frequencia, data) })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['rotina-conclusoes'] }),
  })

  const minhas = (tarefas.data ?? []).filter(
    (t) => !t.papel || t.papel === perfil?.papel || perfil?.papel === 'administrador',
  )
  const feitaDe = (t: Tarefa) =>
    conclusoes.data?.find((c) => c.tarefa_id === t.id && c.periodo === chavePeriodo(t.frequencia, data))
  const progresso = (f: Frequencia) => {
    const lista = minhas.filter((t) => t.frequencia === f)
    return `${lista.filter(feitaDe).length}/${lista.length}`
  }
  const daAba = minhas.filter((t) => t.frequencia === aba)

  return (
    <Cartao
      titulo="Minha rotina"
      acoes={
        pode('painel', 'editar') && (
          <Botao variante="fantasma" icone={<Settings2 className="h-4 w-4" />} onClick={() => setGerenciando(true)}>
            Tarefas
          </Botao>
        )
      }
    >
      <Abas abas={FREQUENCIAS.map((f) => ({ valor: f.valor, rotulo: `${f.rotulo} · ${progresso(f.valor)}` }))} ativa={aba} aoMudar={setAba} />
      {marcar.error && <div className="mb-3"><Mensagem tipo="erro">{mensagemErro(marcar.error)}</Mensagem></div>}
      {tarefas.isLoading || conclusoes.isLoading ? (
        <Carregando />
      ) : daAba.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Nenhuma tarefa para este período.</p>
      ) : (
        <ul className="space-y-1">
          {daAba.map((t) => {
            const feita = feitaDe(t)
            return (
              <li key={t.id}>
                <button
                  role="checkbox"
                  aria-checked={!!feita}
                  disabled={marcar.isPending}
                  onClick={() => marcar.mutate({ tarefa: t, feita })}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-acqua-gelo"
                >
                  <span
                    className={cx(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                      feita ? 'border-acqua-petroleo bg-acqua-petroleo text-white' : 'border-[#C4D3E8] bg-white',
                    )}
                  >
                    {feita && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className={cx('block text-sm', feita ? 'text-slate-400 line-through' : 'text-acqua-titulo')}>{t.titulo}</span>
                    {feita && (
                      <span className="block text-xs text-slate-500">
                        Feito por {nomes.data?.get(feita.concluido_por) ?? '…'} em {formatarDataHora(feita.concluido_em)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {gerenciando && <GerenciarTarefas aoFechar={() => setGerenciando(false)} />}
    </Cartao>
  )
}
