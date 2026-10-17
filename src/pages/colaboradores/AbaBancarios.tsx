import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { Botao, Campo, Cartao, Carregando, Mensagem, Selecao, mensagemErro } from '../../components/ui'
import { BotaoExcluir } from '../../components/registros'
import type { Colaborador } from './tipos'

export const CAMPOS_BANCARIOS = ['banco', 'agencia', 'conta', 'tipo_conta', 'titular', 'pix_tipo', 'pix_chave'] as const
export type DadosBancarios = Record<(typeof CAMPOS_BANCARIOS)[number], string>
export const BANCARIOS_VAZIO = Object.fromEntries(CAMPOS_BANCARIOS.map((c) => [c, ''])) as DadosBancarios

/** Linha pronta para gravar (campos vazios viram null). */
export const linhaBancaria = (colaboradorId: string, f: DadosBancarios) => ({
  colaborador_id: colaboradorId,
  ...Object.fromEntries(CAMPOS_BANCARIOS.map((c) => [c, f[c].trim() || null])),
})

export const temDadosBancarios = (f: DadosBancarios) => CAMPOS_BANCARIOS.some((c) => f[c].trim())

/** Campos de banco e Pix (usados na aba da ficha e no cadastro). */
export function CamposBancarios({
  valores,
  aoMudar,
  desabilitado,
}: {
  valores: DadosBancarios
  aoMudar: (k: keyof DadosBancarios, v: string) => void
  desabilitado?: boolean
}) {
  const campo = (k: keyof DadosBancarios) => ({
    value: valores[k],
    disabled: desabilitado,
    onChange: (e: { target: { value: string } }) => aoMudar(k, e.target.value),
  })
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Campo rotulo="Banco" {...campo('banco')} />
      <Campo rotulo="Agência" {...campo('agencia')} />
      <Campo rotulo="Conta" {...campo('conta')} />
      <Selecao
        rotulo="Tipo de conta"
        vazio="—"
        opcoes={[
          { valor: 'corrente', rotulo: 'Corrente' },
          { valor: 'poupanca', rotulo: 'Poupança' },
          { valor: 'salario', rotulo: 'Salário' },
          { valor: 'pagamento', rotulo: 'Pagamento' },
        ]}
        {...campo('tipo_conta')}
      />
      <Campo rotulo="Titular" {...campo('titular')} />
      <Selecao
        rotulo="Tipo de chave Pix"
        vazio="—"
        opcoes={[
          { valor: 'cpf', rotulo: 'CPF' },
          { valor: 'telefone', rotulo: 'Telefone' },
          { valor: 'email', rotulo: 'E-mail' },
          { valor: 'aleatoria', rotulo: 'Aleatória' },
        ]}
        {...campo('pix_tipo')}
      />
      <Campo rotulo="Chave Pix" {...campo('pix_chave')} className="sm:col-span-2" />
    </div>
  )
}

export function useDadosBancarios(colaboradorId: string | undefined, ativo = true) {
  return useQuery({
    queryKey: ['bancarios', colaboradorId],
    enabled: !!colaboradorId && ativo,
    queryFn: async () => {
      const { data, error } = await supabase.from('colaboradores_bancarios').select('*').eq('colaborador_id', colaboradorId!).maybeSingle()
      if (error) throw error
      return data as (Record<string, string | null> & { colaborador_id: string }) | null
    },
  })
}

export const paraBancarios = (d: Record<string, string | null> | null | undefined) =>
  d ? (Object.fromEntries(CAMPOS_BANCARIOS.map((c) => [c, d[c] ?? ''])) as DadosBancarios) : BANCARIOS_VAZIO

export default function AbaBancarios({ colaborador }: { colaborador: Colaborador }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const podeEditar = pode('dados_bancarios', 'editar')
  const [f, setF] = useState<DadosBancarios>(BANCARIOS_VAZIO)
  const [salvo, setSalvo] = useState(false)
  const dados = useDadosBancarios(colaborador.id)

  useEffect(() => {
    if (dados.data) setF(paraBancarios(dados.data))
  }, [dados.data])

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('colaboradores_bancarios').upsert(linhaBancaria(colaborador.id, f))
      if (error) throw error
    },
    onSuccess: () => {
      setSalvo(true)
      qc.invalidateQueries({ queryKey: ['bancarios', colaborador.id] })
    },
  })

  if (dados.isLoading) return <Carregando />
  return (
    <Cartao titulo={<span className="flex items-center gap-2"><Lock className="h-4 w-4 text-acqua-dourado" /> Dados bancários protegidos</span>}>
      <p className="mb-4 text-xs text-slate-500">Visíveis só para quem tem a permissão "Dados bancários". Toda alteração fica no histórico.</p>
      <CamposBancarios
        valores={f}
        desabilitado={!podeEditar}
        aoMudar={(k, v) => {
          setSalvo(false)
          setF((x) => ({ ...x, [k]: v }))
        }}
      />
      {salvar.error && <div className="mt-3"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      {salvo && <div className="mt-3"><Mensagem tipo="sucesso">Dados bancários salvos.</Mensagem></div>}
      <div className="mt-4 flex justify-end gap-2">
        {dados.data && (
          <BotaoExcluir
            modulo="dados_bancarios"
            tabela="colaboradores_bancarios"
            coluna="colaborador_id"
            id={colaborador.id}
            descricao={`os dados bancários de ${colaborador.nome}`}
            aoExcluir={() => {
              setF(BANCARIOS_VAZIO)
              qc.invalidateQueries({ queryKey: ['bancarios', colaborador.id] })
            }}
          />
        )}
        {podeEditar && <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Botao>}
      </div>
    </Cartao>
  )
}
