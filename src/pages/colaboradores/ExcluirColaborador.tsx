import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { Botao, Confirmar, Mensagem, mensagemErro } from '../../components/ui'
import type { Colaborador } from './tipos'

const NOMES: Record<string, string> = {
  escalas: 'dia(s) de escala',
  ponto: 'marcação(ões) de ponto',
  fechamentos: 'fechamento(s) de folha-ponto',
  ocorrencias: 'ocorrência(s)',
  financeiro: 'lançamento(s) financeiro(s)',
  diarias: 'diária(s)',
  bancarios: 'cadastro de dados bancários',
}

/** Excluir colaborador cadastrado por engano, junto com o que foi lançado para ele (fica no Histórico). */
export default function ExcluirColaborador({ colaborador }: { colaborador: Colaborador }) {
  const { pode } = usePermissoes()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [aberto, setAberto] = useState(false)

  const contagem = useQuery({
    queryKey: ['contagem-colaborador', colaborador.id],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contar_registros_colaborador', { p_id: colaborador.id })
      if (error) throw error
      return data as Record<string, number>
    },
  })

  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('excluir_colaborador', { p_id: colaborador.id })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries()
      navigate('/colaboradores', { replace: true })
    },
  })

  if (!pode('colaboradores', 'excluir')) return null
  const ligados = Object.entries(contagem.data ?? {}).filter(([, n]) => Number(n) > 0)

  return (
    <>
      <Botao variante="secundario" icone={<Trash2 className="h-4 w-4" />} onClick={() => setAberto(true)}>
        Excluir
      </Botao>
      <Confirmar
        aberta={aberto}
        titulo={`Excluir ${colaborador.nome}`}
        perigo
        textoConfirmar="Excluir tudo"
        carregando={excluir.isPending}
        aoFechar={() => setAberto(false)}
        aoConfirmar={() => excluir.mutate()}
        mensagem={
          <div className="space-y-3">
            <p>
              Use para um cadastro feito <b>por engano</b>. Se a pessoa saiu da equipe, prefira <b>Editar → Situação: Desligado</b>, que
              mantém o histórico de trabalho.
            </p>
            {contagem.isLoading ? (
              <p className="text-slate-500">Conferindo registros ligados…</p>
            ) : ligados.length ? (
              <Mensagem tipo="alerta">
                Também serão excluídos: {ligados.map(([k, n]) => `${n} ${NOMES[k] ?? k}`).join(', ')}.
              </Mensagem>
            ) : (
              <p className="text-slate-500">Não há outros registros ligados a este cadastro.</p>
            )}
            <p className="text-xs text-slate-500">Uma cópia de tudo fica guardada no Histórico.</p>
            {excluir.error && <Mensagem tipo="erro">{mensagemErro(excluir.error)}</Mensagem>}
          </div>
        }
      />
    </>
  )
}
