import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ClipboardList, Download, Lock, Plus, Printer, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarDataHora, formatarMoeda, hojeISO, lerMoeda, normalizar } from '../../lib/formatos'
import { baixarCSV } from '../../lib/exportar'
import { esc, imprimirDocumento, tabelaHtml } from '../../lib/imprimir'
import { comSinal, qtd, relatorioContagem, type LinhaRelatorio, type MovimentoBase } from '../../lib/inventario'
import { Botao, Campo, Carregando, Confirmar, Janela, Mensagem, Selecao, Selo, Tabela, cx, mensagemErro } from '../../components/ui'
import { BotaoExcluir } from '../../components/registros'
import { useAtualizarInventario } from './Itens'
import { useCategoriasInventario, useContagens, useItens, type Contagem, type Item, type ItemContado } from './dados'

/** Inventários (contagens): abrir, contar item por item, fechar e ver o que mudou desde o anterior. */
export default function Contagens() {
  const { pode } = usePermissoes()
  const contagens = useContagens()
  const [nova, setNova] = useState(false)
  const [aberta, setAberta] = useState<string | null>(null)
  const lista = contagens.data ?? []
  const emAberto = lista.find((c) => c.situacao === 'aberta')
  const atual = lista.find((c) => c.id === aberta)

  if (atual) return <DetalheContagem contagem={atual} todas={lista} aoVoltar={() => setAberta(null)} />

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-slate-600">
          Abra um inventário, conte item por item e feche. O sistema compara com o inventário anterior: o que mudou por compra ou
          quebra registrada é normal; o que mudou <b>sem ocorrência</b> aparece em vermelho no relatório.
        </p>
        {pode('inventario', 'criar') && !emAberto && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setNova(true)}>Novo inventário</Botao>}
        {emAberto && <Botao icone={<ClipboardList className="h-4 w-4" />} onClick={() => setAberta(emAberto.id)}>Continuar contagem</Botao>}
      </div>
      {contagens.isLoading ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={lista}
          chave={(c) => c.id}
          aoClicar={(c) => setAberta(c.id)}
          vazio="Nenhum inventário feito ainda."
          colunas={[
            { titulo: 'Data', celula: (c) => formatarData(c.data) },
            { titulo: 'Inventário', celula: (c) => <b>{c.titulo}</b> },
            { titulo: 'Situação', celula: (c) => (c.situacao === 'aberta' ? <Selo cor="amarelo">Contando</Selo> : <Selo cor="verde">Fechado</Selo>) },
          ]}
        />
      )}
      {nova && <NovaContagem aoFechar={() => setNova(false)} aoCriar={(id) => { setNova(false); setAberta(id) }} />}
    </>
  )
}

function NovaContagem({ aoFechar, aoCriar }: { aoFechar: () => void; aoCriar: (id: string) => void }) {
  const qc = useQueryClient()
  const hoje = hojeISO()
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const [data, setData] = useState(hoje)
  const [titulo, setTitulo] = useState(`Inventário de ${meses[Number(hoje.slice(5, 7)) - 1]} ${hoje.slice(0, 4)}`)
  const criar = useMutation({
    mutationFn: async () => {
      const { data: c, error } = await supabase.from('inventario_contagens').insert({ data, titulo: titulo.trim() }).select('id').single()
      if (error) throw error
      return c.id as string
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['inventario_contagens'] })
      aoCriar(id)
    },
  })
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Novo inventário"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-contagem" carregando={criar.isPending}>Começar a contar</Botao>
        </>
      }
    >
      <form id="form-contagem" className="grid gap-3" onSubmit={(e) => { e.preventDefault(); criar.mutate() }}>
        <Campo rotulo="Nome" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        <Campo rotulo="Data da contagem" type="date" value={data} onChange={(e) => setData(e.target.value)} required ajuda="Movimentos até esta data entram na conta." />
        {criar.error && <Mensagem tipo="erro">{mensagemErro(criar.error)}</Mensagem>}
      </form>
    </Janela>
  )
}

function DetalheContagem({ contagem: c, todas, aoVoltar }: { contagem: Contagem; todas: Contagem[]; aoVoltar: () => void }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const atualizar = useAtualizarInventario()
  const itens = useItens()
  const [confirmar, setConfirmar] = useState<'fechar' | 'reabrir' | null>(null)
  const [resultado, setResultado] = useState<number | null>(null)

  const contados = useQuery({
    queryKey: ['inventario_contados', c.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventario_contagem_itens').select('*').eq('contagem_id', c.id)
      if (error) throw error
      return data as ItemContado[]
    },
  })

  const fechar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('fechar_contagem', { p_id: c.id })
      if (error) throw error
      return data as number
    },
    onSuccess: (n) => {
      setResultado(n)
      setConfirmar(null)
      atualizar()
    },
  })
  const reabrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reabrir_contagem', { p_id: c.id })
      if (error) throw error
    },
    onSuccess: () => {
      setConfirmar(null)
      setResultado(null)
      atualizar()
    },
  })

  const aberta = c.situacao === 'aberta'
  const erro = fechar.error || reabrir.error
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Botao variante="fantasma" onClick={aoVoltar}>← Inventários</Botao>
        <div className="mr-auto">
          <h2 className="font-semibold text-acqua-titulo">{c.titulo}</h2>
          <p className="text-xs text-slate-500">
            {formatarData(c.data)} · aberto por {nome(c.criado_por)}
            {c.fechada_em && ` · fechado por ${nome(c.fechada_por)} em ${formatarDataHora(c.fechada_em)}`}
          </p>
        </div>
        {aberta ? (
          <>
            <BotaoExcluir modulo="inventario" tabela="inventario_contagens" id={c.id} descricao={`a contagem “${c.titulo}”`} className="" aoExcluir={() => { qc.invalidateQueries({ queryKey: ['inventario_contagens'] }); aoVoltar() }} />
            {pode('inventario', 'aprovar') && (
              <Botao icone={<Lock className="h-4 w-4" />} onClick={() => setConfirmar('fechar')} disabled={!contados.data?.length}>Fechar inventário</Botao>
            )}
          </>
        ) : (
          pode('inventario', 'aprovar') && (
            <Botao variante="secundario" icone={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirmar('reabrir')}>Reabrir</Botao>
          )
        )}
      </div>

      {resultado !== null && (
        <Mensagem tipo={resultado ? 'alerta' : 'sucesso'}>
          Inventário fechado. {resultado ? `${resultado} item(ns) mudaram sem ocorrência registrada — veja em vermelho abaixo.` : 'Tudo bateu com o registrado.'}
        </Mensagem>
      )}
      {erro && <Mensagem tipo="erro">{mensagemErro(erro)}</Mensagem>}

      {itens.isLoading || contados.isLoading ? (
        <Carregando />
      ) : aberta ? (
        <Contar contagem={c} itens={(itens.data ?? []).filter((i) => i.ativo)} contados={contados.data ?? []} />
      ) : (
        <Relatorio contagem={c} todas={todas} itens={itens.data ?? []} contados={contados.data ?? []} />
      )}

      <Confirmar
        aberta={confirmar === 'fechar'}
        titulo="Fechar inventário"
        textoConfirmar="Fechar"
        carregando={fechar.isPending}
        aoFechar={() => setConfirmar(null)}
        aoConfirmar={() => fechar.mutate()}
        mensagem={
          <p>
            Foram contados <b>{contados.data?.length ?? 0}</b> item(ns). Itens não contados ficam como estão. A quantidade dos contados passa a ser a
            contada, e as diferenças sem ocorrência ficam registradas. Movimentos até {formatarData(c.data)} ficam travados.
          </p>
        }
      />
      <Confirmar
        aberta={confirmar === 'reabrir'}
        titulo="Reabrir inventário"
        textoConfirmar="Reabrir"
        carregando={reabrir.isPending}
        aoFechar={() => setConfirmar(null)}
        aoConfirmar={() => reabrir.mutate()}
        mensagem={<p>As diferenças lançadas no fechamento são desfeitas e a contagem volta a ficar aberta para correção.</p>}
      />
    </div>
  )
}

/** Tela de contagem: digita o que tem de fato; salva sozinho ao sair do campo. */
function Contar({ contagem, itens, contados }: { contagem: Contagem; itens: Item[]; contados: ItemContado[] }) {
  const { pode } = usePermissoes()
  const categorias = useCategoriasInventario()
  const [categoria, setCategoria] = useState('')
  const [busca, setBusca] = useState('')
  const [soFaltam, setSoFaltam] = useState(false)
  const mapa = useMemo(() => new Map(contados.map((x) => [x.item_id, x])), [contados])
  const lista = itens.filter(
    (i) => (!categoria || i.categoria === categoria) && (!busca || normalizar(i.nome).includes(normalizar(busca))) && (!soFaltam || !mapa.has(i.id)),
  )
  const podeContar = pode('inventario', 'criar')

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <Campo rotulo="Buscar" className="w-56" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Selecao rotulo="Categoria" className="w-48" value={categoria} onChange={(e) => setCategoria(e.target.value)} vazio="Todas" opcoes={categorias.map((x) => ({ valor: x, rotulo: x }))} />
        <label className="mb-2 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={soFaltam} onChange={(e) => setSoFaltam(e.target.checked)} /> Só os que faltam contar
        </label>
        <p className="mb-2 ml-auto text-sm font-semibold text-acqua-titulo">
          {contados.length} de {itens.length} contados
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-acqua-suave">
        <div className="h-full bg-acqua-petroleo transition-all" style={{ width: `${itens.length ? (contados.length / itens.length) * 100 : 0}%` }} />
      </div>
      <ul className="divide-y divide-acqua-suave rounded-xl border border-acqua-suave bg-white">
        {lista.map((i) => (
          <LinhaContar key={i.id} contagemId={contagem.id} item={i} contado={mapa.get(i.id)} editavel={podeContar} />
        ))}
        {!lista.length && <li className="p-4 text-sm text-slate-500">Nada para mostrar.</li>}
      </ul>
    </>
  )
}

function LinhaContar({ contagemId, item, contado, editavel }: { contagemId: string; item: Item; contado?: ItemContado; editavel: boolean }) {
  const qc = useQueryClient()
  const [valor, setValor] = useState(contado ? qtd(contado.contado) : '')
  useEffect(() => setValor(contado ? qtd(contado.contado) : ''), [contado])
  const salvar = useMutation({
    mutationFn: async (texto: string) => {
      if (texto.trim() === '') {
        if (!contado) return
        const { error } = await supabase.from('inventario_contagem_itens').delete().eq('id', contado.id)
        if (error) throw error
        return
      }
      const n = lerMoeda(texto)
      if (n === null || n < 0) throw new Error('Número inválido')
      if (contado && Number(contado.contado) === n) return
      const { error } = await supabase
        .from('inventario_contagem_itens')
        .upsert({ contagem_id: contagemId, item_id: item.id, contado: n }, { onConflict: 'contagem_id,item_id' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventario_contados', contagemId] }),
  })
  const diferente = contado && Number(contado.contado) !== Number(item.quantidade)
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-acqua-titulo">{item.nome}</p>
        <p className="text-xs text-slate-500">
          {[item.categoria, item.local].filter(Boolean).join(' · ')} · no sistema: {qtd(item.quantidade)} {item.unidade}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {salvar.isPending ? (
          <span className="text-xs text-slate-500">salvando…</span>
        ) : salvar.error ? (
          <span className="text-xs text-red-700">{mensagemErro(salvar.error)}</span>
        ) : contado ? (
          diferente ? <AlertTriangle className="h-4 w-4 text-amber-600" aria-label="Diferente do sistema" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Contado" />
        ) : null}
        <input
          aria-label={`Quantidade contada de ${item.nome}`}
          inputMode="decimal"
          className="w-24 rounded-lg border border-[#C4D3E8] px-3 py-2 text-right text-sm tabular-nums focus:border-acqua-petroleo focus:outline-none focus:ring-2 focus:ring-acqua/40 disabled:bg-slate-50"
          placeholder="contei"
          value={valor}
          disabled={!editavel}
          onChange={(e) => setValor(e.target.value)}
          onBlur={() => salvar.mutate(valor)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className="w-8 text-xs text-slate-500">{item.unidade}</span>
      </div>
    </li>
  )
}

/** Relatório do inventário fechado: anterior, entradas, saídas registradas, esperado, contado e diferença sem ocorrência. */
function Relatorio({ contagem: c, todas, itens, contados }: { contagem: Contagem; todas: Contagem[]; itens: Item[]; contados: ItemContado[] }) {
  const { pode } = usePermissoes()
  const [soDiferencas, setSoDiferencas] = useState(false)
  const anterior = todas.filter((x) => x.situacao === 'fechada' && x.data < c.data).sort((a, b) => b.data.localeCompare(a.data))[0] ?? null
  const ids = contados.map((x) => x.item_id)

  const movimentos = useQuery({
    queryKey: ['inventario_movimentos', 'relatorio', c.id],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventario_movimentos')
        .select('item_id, data, tipo, quantidade, situacao, contagem_id')
        .in('item_id', ids)
        .lte('data', c.data)
        .eq('situacao', 'registrado')
      if (error) throw error
      return data as MovimentoBase[]
    },
  })

  const nomeItem = new Map(itens.map((i) => [i.id, i]))
  const linhas: (LinhaRelatorio & { item?: Item })[] = useMemo(
    () =>
      relatorioContagem(contados, movimentos.data ?? [], anterior?.data ?? null, c.data, c.id)
        .map((l) => ({ ...l, item: nomeItem.get(l.item_id) }))
        .sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca) || (a.item?.nome ?? '').localeCompare(b.item?.nome ?? '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contados, movimentos.data, anterior?.data, c.data, c.id, itens],
  )
  const comDiferenca = linhas.filter((l) => l.diferenca !== 0)
  const valorDiferenca = comDiferenca.reduce((s, l) => s + l.diferenca * Number(l.item?.valor_unitario ?? 0), 0)
  const mostradas = soDiferencas ? comDiferenca : linhas

  const colunas: { titulo: string; valor: (l: (typeof linhas)[number]) => string | number }[] = [
    { titulo: 'Item', valor: (l) => l.item?.nome ?? '' },
    { titulo: anterior ? `Em ${formatarData(anterior.data)}` : 'Início', valor: (l) => qtd(l.anterior) },
    { titulo: 'Entradas', valor: (l) => (l.entradas ? `+${qtd(l.entradas)}` : '0') },
    { titulo: 'Saídas registradas', valor: (l) => (l.saidas ? `−${qtd(l.saidas)}` : '0') },
    { titulo: 'Deveria ter', valor: (l) => qtd(l.esperado) },
    { titulo: 'Contado', valor: (l) => qtd(l.contado) },
    { titulo: 'Sem ocorrência', valor: (l) => comSinal(l.diferenca) },
  ]
  const exportar = () => baixarCSV(`inventario-${c.data}`, mostradas, colunas)
  const imprimir = () =>
    imprimirDocumento(
      c.titulo,
      `<h1>${esc(c.titulo)} — ${esc(formatarData(c.data))}</h1>
       <p>${anterior ? `Comparado com o inventário de ${esc(formatarData(anterior.data))}.` : 'Primeiro inventário.'}
       ${comDiferenca.length} item(ns) com diferença sem ocorrência registrada${valorDiferenca ? ` (${esc(formatarMoeda(valorDiferenca))})` : ''}.</p>
       ${tabelaHtml(colunas.map((x, i) => ({ titulo: x.titulo, num: i > 0 })), mostradas.map((l) => colunas.map((x) => x.valor(l))))}
       <div class="assinaturas"><div>Responsável pela contagem</div><div>Gerência</div></div>`,
    )

  if (movimentos.isLoading) return <Carregando />
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Bloco rotulo="Itens contados" valor={String(linhas.length)} />
        <Bloco rotulo="Bateram" valor={String(linhas.length - comDiferenca.length)} />
        <Bloco rotulo="Mudaram sem ocorrência" valor={String(comDiferenca.length)} alerta={comDiferenca.length > 0} />
        <Bloco rotulo="Valor da diferença" valor={formatarMoeda(valorDiferenca)} alerta={valorDiferenca < 0} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-slate-600">{anterior ? `Comparado com “${anterior.titulo}” (${formatarData(anterior.data)}).` : 'Primeiro inventário: compara com o saldo inicial e as compras.'}</p>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={soDiferencas} onChange={(e) => setSoDiferencas(e.target.checked)} /> Só as diferenças
        </label>
        <Botao variante="secundario" icone={<Printer className="h-4 w-4" />} onClick={imprimir}>Imprimir</Botao>
        {pode('inventario', 'exportar') && <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportar}>Exportar</Botao>}
      </div>
      <div className="overflow-x-auto rounded-xl border border-acqua-suave bg-white">
        <table className="w-full text-right text-sm tabular-nums">
          <thead className="bg-acqua-gelo text-xs uppercase tracking-wider text-acqua-petroleo">
            <tr>
              {colunas.map((x, i) => <th key={x.titulo} className={cx('px-3 py-2 font-semibold', i === 0 && 'text-left')}>{x.titulo}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-acqua-suave">
            {mostradas.map((l) => (
              <tr key={l.item_id} className={cx(l.diferenca !== 0 && 'bg-red-50')}>
                {colunas.map((x, i) => (
                  <td
                    key={x.titulo}
                    className={cx('px-3 py-2', i === 0 && 'text-left font-semibold text-acqua-titulo', i === colunas.length - 1 && l.diferenca !== 0 && 'font-semibold text-red-700')}
                  >
                    {i === colunas.length - 1 && l.diferenca !== 0 && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}
                    {x.valor(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Entradas = saldo inicial, compras e entradas avulsas. Saídas registradas = quebras, perdas e saídas com ocorrência/motivo. “Sem ocorrência” = o que
        mudou sem nenhum registro que explique.
      </p>
    </>
  )
}

function Bloco({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className={cx('rounded-xl border border-acqua-suave bg-white p-3', alerta && 'border-red-300 bg-red-50')}>
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className={cx('text-lg font-semibold tabular-nums text-acqua-titulo', alerta && 'text-red-700')}>{valor}</p>
    </div>
  )
}
