import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HandCoins, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarData, formatarMoeda, hojeISO } from '../../lib/formatos'
import { BANDEIRAS, FORMAS } from '../../lib/cafe'
import { Botao, Campo, Carregando, Janela, Mensagem, Selecao, Selo, Tabela, mensagemErro } from '../../components/ui'
import { useMensalistas, type Mensalista, type Venda } from './dados'

/** Hóspedes de longa estadia: cafés anotados, saldo a receber e acerto de uma vez. */
export default function Mensalistas() {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const mensalistas = useMensalistas()
  const [novo, setNovo] = useState(false)
  const [aberto, setAberto] = useState<Mensalista | null>(null)

  const pendentes = useQuery({
    queryKey: ['cafe_vendas', 'a-receber'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cafe_vendas')
        .select('*')
        .eq('pago', false)
        .eq('situacao', 'registrado')
        .order('data')
      if (error) throw error
      return data as Venda[]
    },
  })
  const saldo = (id: string) => (pendentes.data ?? []).filter((v) => v.mensalista_id === id).reduce((s, v) => s + Number(v.valor_total), 0)

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Os cafés do dia são anotados em <b>Dia → Cafés pagos na hora → Mensalista</b>. Aqui você vê o saldo e registra o acerto.
        </p>
        {pode('cafes', 'criar') && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setNovo(true)}>Novo mensalista</Botao>}
      </div>
      {mensalistas.isLoading || pendentes.isLoading ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={mensalistas.data ?? []}
          chave={(m) => m.id}
          aoClicar={setAberto}
          vazio="Nenhum mensalista cadastrado."
          colunas={[
            { titulo: 'Nome', celula: (m) => <b>{m.nome}</b> },
            { titulo: 'Apto', celula: (m) => m.apartamento || '—' },
            { titulo: 'A receber', celula: (m) => <span className="font-semibold tabular-nums">{formatarMoeda(saldo(m.id))}</span> },
            { titulo: 'Situação', celula: (m) => <Selo cor={m.ativo ? 'verde' : 'cinza'}>{m.ativo ? 'Hospedado' : 'Encerrado'}</Selo> },
          ]}
        />
      )}
      {novo && <NovoMensalista aoFechar={() => setNovo(false)} aoSalvar={() => { setNovo(false); qc.invalidateQueries({ queryKey: ['cafe_mensalistas'] }) }} />}
      {aberto && (
        <Acerto
          mensalista={aberto}
          lancamentos={(pendentes.data ?? []).filter((v) => v.mensalista_id === aberto.id)}
          aoFechar={() => setAberto(null)}
          aoSalvar={() => {
            setAberto(null)
            qc.invalidateQueries({ queryKey: ['cafe_vendas'] })
            qc.invalidateQueries({ queryKey: ['cafe_mensalistas'] })
          }}
        />
      )}
    </>
  )
}

function NovoMensalista({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: () => void }) {
  const [nome, setNome] = useState('')
  const [apartamento, setApartamento] = useState('')
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('cafe_mensalistas').insert({ nome: nome.trim(), apartamento: apartamento.trim() || null })
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Novo mensalista"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-mensalista" carregando={salvar.isPending}>Salvar</Botao>
        </>
      }
    >
      <form id="form-mensalista" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
        <Campo rotulo="Nome do hóspede" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
        <Campo rotulo="Apartamento" value={apartamento} onChange={(e) => setApartamento(e.target.value)} />
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}

function Acerto({ mensalista, lancamentos, aoFechar, aoSalvar }: { mensalista: Mensalista; lancamentos: Venda[]; aoFechar: () => void; aoSalvar: () => void }) {
  const { pode } = usePermissoes()
  const [forma, setForma] = useState('')
  const [bandeira, setBandeira] = useState('')
  const [data, setData] = useState(hojeISO())
  const total = lancamentos.reduce((s, v) => s + Number(v.valor_total), 0)
  const ehCartao = forma === 'credito' || forma === 'debito'

  const receber = useMutation({
    mutationFn: async () => {
      if (!forma) throw new Error('Escolha a forma de pagamento.')
      if (ehCartao && !bandeira) throw new Error('Escolha a bandeira.')
      const { error } = await supabase
        .from('cafe_vendas')
        .update({ pago: true, forma, bandeira: ehCartao ? bandeira : null, recebido_em: data })
        .in('id', lancamentos.map((v) => v.id))
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })

  const encerrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('cafe_mensalistas').update({ ativo: !mensalista.ativo }).eq('id', mensalista.id)
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={`${mensalista.nome}${mensalista.apartamento ? ` · apto ${mensalista.apartamento}` : ''}`}
      largura="max-w-xl"
      rodape={
        <>
          {pode('cafes', 'editar') && (
            <Botao variante="fantasma" className="mr-auto" carregando={encerrar.isPending} onClick={() => encerrar.mutate()}>
              {mensalista.ativo ? 'Encerrar estadia' : 'Reativar'}
            </Botao>
          )}
          <Botao variante="secundario" onClick={aoFechar}>Fechar</Botao>
          {pode('cafes', 'editar') && lancamentos.length > 0 && (
            <Botao icone={<HandCoins className="h-4 w-4" />} carregando={receber.isPending} onClick={() => receber.mutate()}>
              Receber {formatarMoeda(total)}
            </Botao>
          )}
        </>
      }
    >
      {lancamentos.length === 0 ? (
        <p className="text-sm text-slate-600">Nada a receber.</p>
      ) : (
        <div className="space-y-3">
          <ul className="max-h-60 divide-y divide-acqua-suave overflow-y-auto text-sm">
            {lancamentos.map((v) => (
              <li key={v.id} className="flex justify-between py-1.5">
                <span>{formatarData(v.data)} · {v.quantidade} café(s)</span>
                <span className="tabular-nums">{formatarMoeda(v.valor_total)}</span>
              </li>
            ))}
          </ul>
          <p className="text-right text-sm">Total: <b>{formatarMoeda(total)}</b></p>
          {pode('cafes', 'editar') && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Selecao rotulo="Forma" value={forma} onChange={(e) => setForma(e.target.value)} vazio="Escolha…" opcoes={FORMAS} />
              {ehCartao && <Selecao rotulo="Bandeira" value={bandeira} onChange={(e) => setBandeira(e.target.value)} vazio="Escolha…" opcoes={BANDEIRAS} />}
              <Campo rotulo="Recebido em" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          )}
        </div>
      )}
      {(receber.error || encerrar.error) && <div className="mt-3"><Mensagem tipo="erro">{mensagemErro(receber.error || encerrar.error)}</Mensagem></div>}
    </Janela>
  )
}
