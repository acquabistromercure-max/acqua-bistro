import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatarMoeda, hojeISO, lerMoeda } from '../../lib/formatos'
import { horaCurta } from '../../lib/ponto'
import { Alternador, AreaTexto, Botao, Campo, Janela, Mensagem, Selecao, mensagemErro } from '../../components/ui'
import { useClientes, useModelos, type Evento } from './dados'

/** Criar ou editar o evento (dados, cardápio escolhido e valores combinados). */
export default function FormEvento({ evento, aoFechar, aoSalvar }: { evento?: Evento; aoFechar: () => void; aoSalvar: (id: string) => void }) {
  const qc = useQueryClient()
  const clientes = useClientes()
  const modelos = useModelos()
  const txt = (n: number | null | undefined) => (n ? String(n).replace('.', ',') : '')
  const [f, setF] = useState({
    titulo: evento?.titulo ?? '',
    cliente: clientes.data?.find((c) => c.id === evento?.cliente_id)?.nome ?? '',
    contato: evento?.contato ?? '',
    telefone: evento?.telefone ?? '',
    data: evento?.data ?? hojeISO(),
    hora_inicio: horaCurta(evento?.hora_inicio),
    hora_fim: horaCurta(evento?.hora_fim),
    local: evento?.local ?? '',
    pessoas: evento ? String(evento.pessoas) : '',
    modelo_id: evento?.modelo_id ?? '',
    preco: txt(evento?.preco_por_pessoa),
    adicional: txt(evento?.valor_adicional),
    sinal: txt(evento?.sinal),
    sinal_pago_em: evento?.sinal_pago_em ?? '',
    cardapio: evento?.cardapio ?? '',
    observacao: evento?.observacao ?? '',
  })
  const [faturarHotel, setFaturarHotel] = useState(evento?.faturar_hotel ?? false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const escolherModelo = (id: string) => {
    const m = modelos.data?.find((x) => x.id === id)
    setF({
      ...f,
      modelo_id: id,
      preco: m ? txt(m.preco_por_pessoa) : f.preco,
      cardapio: m && !f.cardapio ? m.itens.map((i) => `• ${i.nome}`).join('\n') : f.cardapio,
    })
  }

  const salvar = useMutation({
    mutationFn: async () => {
      let clienteId: string | null = null
      const nomeCliente = f.cliente.trim()
      if (nomeCliente) {
        const existente = clientes.data?.find((c) => c.nome.toLowerCase() === nomeCliente.toLowerCase())
        if (existente) clienteId = existente.id
        else {
          const { data, error } = await supabase.from('clientes').insert({ nome: nomeCliente, contato: f.contato.trim() || null, telefone: f.telefone.trim() || null }).select('id').single()
          if (error) throw error
          clienteId = data.id
          qc.invalidateQueries({ queryKey: ['clientes'] })
        }
      }
      const dados = {
        titulo: f.titulo.trim(),
        cliente_id: clienteId,
        contato: f.contato.trim() || null,
        telefone: f.telefone.trim() || null,
        data: f.data,
        hora_inicio: f.hora_inicio || null,
        hora_fim: f.hora_fim || null,
        local: f.local.trim() || null,
        pessoas: Number(f.pessoas) || 0,
        modelo_id: f.modelo_id || null,
        preco_por_pessoa: lerMoeda(f.preco) ?? 0,
        valor_adicional: lerMoeda(f.adicional) ?? 0,
        sinal: lerMoeda(f.sinal) ?? 0,
        sinal_pago_em: f.sinal_pago_em || null,
        cardapio: f.cardapio.trim() || null,
        faturar_hotel: faturarHotel,
        observacao: f.observacao.trim() || null,
      }
      if (evento) {
        const { error } = await supabase.from('eventos').update(dados).eq('id', evento.id)
        if (error) throw error
        return evento.id
      }
      const { data, error } = await supabase.from('eventos').insert(dados).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['eventos'] })
      aoSalvar(id)
    },
  })

  const pacote = (Number(f.pessoas) || 0) * (lerMoeda(f.preco) ?? 0) + (lerMoeda(f.adicional) ?? 0)

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={evento ? 'Editar evento' : 'Novo evento'}
      largura="max-w-3xl"
      rodape={
        <>
          <span className="mr-auto self-center text-sm text-slate-600">Valor combinado: <b>{formatarMoeda(pacote)}</b></span>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-evento" carregando={salvar.isPending}>Salvar</Botao>
        </>
      }
    >
      <form id="form-evento" className="grid gap-3 sm:grid-cols-6" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
        <Campo rotulo="Nome do evento" className="sm:col-span-4" value={f.titulo} onChange={set('titulo')} required autoFocus placeholder="Ex.: Coffee break treinamento" />
        <Campo rotulo="Pessoas" className="sm:col-span-2" type="number" min={0} value={f.pessoas} onChange={set('pessoas')} required />
        <div className="sm:col-span-3">
          <Campo rotulo="Contratante" value={f.cliente} onChange={set('cliente')} list="clientes-evento" placeholder="Empresa ou pessoa" />
          <datalist id="clientes-evento">{(clientes.data ?? []).map((c) => <option key={c.id} value={c.nome} />)}</datalist>
        </div>
        <Campo rotulo="Contato" className="sm:col-span-2" value={f.contato} onChange={set('contato')} />
        <Campo rotulo="Telefone" className="sm:col-span-1" value={f.telefone} onChange={set('telefone')} inputMode="tel" />
        <Campo rotulo="Data" className="sm:col-span-2" type="date" value={f.data} onChange={set('data')} required />
        <Campo rotulo="Início" type="time" value={f.hora_inicio} onChange={set('hora_inicio')} />
        <Campo rotulo="Fim" type="time" value={f.hora_fim} onChange={set('hora_fim')} />
        <Campo rotulo="Local" className="sm:col-span-2" value={f.local} onChange={set('local')} placeholder="Ex.: Salão do hotel" />
        <Selecao
          rotulo="Modelo de coffee break"
          className="sm:col-span-3"
          value={f.modelo_id}
          onChange={(e) => escolherModelo(e.target.value)}
          vazio="Cardápio personalizado"
          opcoes={(modelos.data ?? []).filter((m) => m.ativo).map((m) => ({ valor: m.id, rotulo: `${m.nome} · ${formatarMoeda(m.preco_por_pessoa)}/pessoa` }))}
        />
        <Campo rotulo="Preço por pessoa (R$)" className="sm:col-span-2" inputMode="decimal" value={f.preco} onChange={set('preco')} />
        <Campo rotulo="Adicional (R$)" inputMode="decimal" value={f.adicional} onChange={set('adicional')} ajuda="Taxa, frete ou desconto (−)" />
        <AreaTexto rotulo="Cardápio" className="sm:col-span-6" rows={4} value={f.cardapio} onChange={set('cardapio')} />
        <Campo rotulo="Sinal recebido (R$)" className="sm:col-span-2" inputMode="decimal" value={f.sinal} onChange={set('sinal')} />
        <Campo rotulo="Sinal pago em" className="sm:col-span-2" type="date" value={f.sinal_pago_em} onChange={set('sinal_pago_em')} />
        <div className="sm:col-span-2 sm:self-end">
          <Alternador rotulo="Cobrar na quinzena do hotel" ligado={faturarHotel} aoMudar={setFaturarHotel} />
        </div>
        <AreaTexto rotulo="Observações" className="sm:col-span-6" value={f.observacao} onChange={set('observacao')} />
        {salvar.error && <div className="sm:col-span-6"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
