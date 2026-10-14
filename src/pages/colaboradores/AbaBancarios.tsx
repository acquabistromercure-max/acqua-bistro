import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { Botao, Campo, Cartao, Carregando, Mensagem, Selecao, mensagemErro } from '../../components/ui'
import { BotaoExcluir } from '../../components/registros'
import type { Colaborador } from './tipos'

const CAMPOS = ['banco', 'agencia', 'conta', 'tipo_conta', 'titular', 'pix_tipo', 'pix_chave'] as const
type Dados = Record<(typeof CAMPOS)[number], string>

export default function AbaBancarios({ colaborador }: { colaborador: Colaborador }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const podeEditar = pode('dados_bancarios', 'editar')
  const [f, setF] = useState<Dados>(Object.fromEntries(CAMPOS.map((c) => [c, ''])) as Dados)
  const [salvo, setSalvo] = useState(false)

  const dados = useQuery({
    queryKey: ['bancarios', colaborador.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('colaboradores_bancarios').select('*').eq('colaborador_id', colaborador.id).maybeSingle()
      if (error) throw error
      return data
    },
  })

  useEffect(() => {
    if (dados.data) setF(Object.fromEntries(CAMPOS.map((c) => [c, dados.data[c] ?? ''])) as Dados)
  }, [dados.data])

  const salvar = useMutation({
    mutationFn: async () => {
      const linha = { colaborador_id: colaborador.id, ...Object.fromEntries(CAMPOS.map((c) => [c, f[c].trim() || null])) }
      const { error } = await supabase.from('colaboradores_bancarios').upsert(linha)
      if (error) throw error
    },
    onSuccess: () => {
      setSalvo(true)
      qc.invalidateQueries({ queryKey: ['bancarios', colaborador.id] })
    },
  })

  const campo = (k: keyof Dados) => ({
    value: f[k],
    disabled: !podeEditar,
    onChange: (e: { target: { value: string } }) => {
      setSalvo(false)
      setF((x) => ({ ...x, [k]: e.target.value }))
    },
  })

  if (dados.isLoading) return <Carregando />
  return (
    <Cartao titulo={<span className="flex items-center gap-2"><Lock className="h-4 w-4 text-acqua-dourado" /> Dados bancários protegidos</span>}>
      <p className="mb-4 text-xs text-slate-500">Visíveis só para quem tem a permissão "Dados bancários". Toda alteração fica no histórico.</p>
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
              setF(Object.fromEntries(CAMPOS.map((c) => [c, ''])) as Dados)
              qc.invalidateQueries({ queryKey: ['bancarios', colaborador.id] })
            }}
          />
        )}
        {podeEditar && <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Botao>}
      </div>
    </Cartao>
  )
}
