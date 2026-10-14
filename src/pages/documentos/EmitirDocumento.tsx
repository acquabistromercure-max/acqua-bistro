import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatarData, formatarMinutos, formatarMoeda, hojeISO, lerMoeda } from '../../lib/formatos'
import { formatarCPF } from '../../lib/documentos-br'
import { valorPorExtenso } from '../../lib/extenso'
import { TIPOS_DOCUMENTO, corpoTexto, dataPorExtenso, mesPorExtenso, type TipoDocumento } from '../../lib/documentos'
import { esc, imprimirDocumento, tabelaHtml } from '../../lib/imprimir'
import { NOMES_DIAS, diaDaSemana, diasDoMes, horaCurta, linhaDoDia, totalizar } from '../../lib/ponto'
import { AreaTexto, Botao, Campo, Janela, Mensagem, Selecao, cx, mensagemErro } from '../../components/ui'
import type { Colaborador } from '../colaboradores/tipos'
import { TIPOS_OCORRENCIA, rotulo } from '../colaboradores/tipos'
import { chaveDia, escalaDoDia, porDia, useRegrasPonto, type Escala, type RegistroPonto } from '../escalas/dados'
import { useEmpresa, useTextos } from './dados'

type Origem = { id: string; rotulo: string; valor?: number; data: string; descricao?: string; tipo?: string }

/** Gera um documento a partir da ficha: escolhe o modelo, a origem (lançamento, ocorrência, diária ou mês) e imprime. */
export default function EmitirDocumento({ colaborador, tipoInicial, aoFechar }: { colaborador: Colaborador; tipoInicial?: TipoDocumento; aoFechar: () => void }) {
  const qc = useQueryClient()
  const empresa = useEmpresa()
  const textos = useTextos()
  const regras = useRegrasPonto()
  const [tipo, setTipo] = useState<TipoDocumento>(tipoInicial ?? 'recibo_adiantamento')
  const [origemId, setOrigemId] = useState('')
  const [valorManual, setValorManual] = useState('')
  const [dataDoc, setDataDoc] = useState(hojeISO())
  const [descricao, setDescricao] = useState('')
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const precisaMes = tipo === 'termo_domingo' || tipo === 'folha_ponto'

  // Origens possíveis por tipo de documento.
  const origens = useQuery({
    queryKey: ['origens-documento', colaborador.id, tipo],
    enabled: !precisaMes,
    queryFn: async (): Promise<Origem[]> => {
      if (tipo === 'recibo_adiantamento' || tipo === 'recibo_vale') {
        const { data } = await supabase
          .from('lancamentos_colaborador')
          .select('id, tipo, data, valor, descricao')
          .eq('colaborador_id', colaborador.id)
          .in('tipo', tipo === 'recibo_vale' ? ['vale'] : ['adiantamento', 'vale'])
          .neq('situacao', 'cancelado')
          .order('data', { ascending: false })
          .limit(30)
        return (data ?? []).map((l) => ({ id: l.id, data: l.data, valor: Number(l.valor), descricao: l.descricao ?? '', rotulo: `${formatarData(l.data)} · ${formatarMoeda(l.valor)}${l.descricao ? ` · ${l.descricao}` : ''}` }))
      }
      if (tipo === 'registro_ocorrencia' || tipo === 'advertencia') {
        const { data } = await supabase
          .from('ocorrencias')
          .select('id, tipo, data, descricao')
          .eq('colaborador_id', colaborador.id)
          .neq('situacao', 'cancelada')
          .order('data', { ascending: false })
          .limit(30)
        return (data ?? [])
          .filter((o) => (tipo === 'advertencia' ? o.tipo === 'advertencia' : true))
          .map((o) => ({ id: o.id, data: o.data, descricao: o.descricao, tipo: o.tipo, rotulo: `${formatarData(o.data)} · ${rotulo(TIPOS_OCORRENCIA, o.tipo)} · ${o.descricao}` }))
      }
      if (tipo === 'recibo_diaria') {
        const { data } = await supabase
          .from('diarias')
          .select('id, data, valor, turno, funcao')
          .eq('colaborador_id', colaborador.id)
          .neq('situacao', 'cancelada')
          .order('data', { ascending: false })
          .limit(30)
        return (data ?? []).map((d) => ({ id: d.id, data: d.data, valor: Number(d.valor), descricao: [d.turno, d.funcao].filter(Boolean).join(' · '), rotulo: `${formatarData(d.data)} · ${formatarMoeda(d.valor)}` }))
      }
      return []
    },
  })
  const origem = origens.data?.find((o) => o.id === origemId)

  // Mês para termo de domingo e folha-ponto.
  const inicio = `${mes}-01`
  const fim = diasDoMes(mes).slice(-1)[0]
  const doMes = useQuery({
    queryKey: ['doc-mes', colaborador.id, mes],
    enabled: precisaMes,
    queryFn: async () => {
      const [e, r] = await Promise.all([
        supabase.from('escalas').select('*').eq('colaborador_id', colaborador.id).gte('data', inicio).lte('data', fim),
        supabase.from('registros_ponto').select('*').eq('colaborador_id', colaborador.id).gte('data', inicio).lte('data', fim).neq('situacao', 'cancelada'),
      ])
      return { escalas: (e.data ?? []) as Escala[], registros: (r.data ?? []) as RegistroPonto[] }
    },
  })

  const linhas = useMemo(() => {
    if (!doMes.data) return []
    const e = porDia(doMes.data.escalas)
    const r = porDia(doMes.data.registros)
    return diasDoMes(mes).map((d) => linhaDoDia(d, escalaDoDia(e.get(chaveDia(colaborador.id, d)), colaborador, d), r.get(chaveDia(colaborador.id, d)) ?? null, regras, hojeISO()))
  }, [doMes.data, mes, colaborador.id, regras])
  const domingos = linhas.filter((l) => (l.domingo || l.feriado) && (l.trabalhado || l.escala?.tipo === 'turno'))

  const valor = origem?.valor ?? lerMoeda(valorManual) ?? 0
  const dados = {
    nome: colaborador.nome,
    cpf: formatarCPF(colaborador.cpf),
    funcao: colaborador.funcao ?? '',
    admissao: formatarData(colaborador.data_admissao),
    empresa: empresa.razao_social,
    cnpj: empresa.cnpj || '__________',
    cidade: empresa.cidade,
    valor: formatarMoeda(valor),
    valor_extenso: valorPorExtenso(valor),
    data: formatarData(origem?.data ?? dataDoc),
    data_extenso: dataPorExtenso(hojeISO()),
    mes: mesPorExtenso(mes),
    descricao: (descricao.trim() || origem?.descricao || '').trim(),
    tipo: origem?.tipo ? rotulo(TIPOS_OCORRENCIA, origem.tipo) : '',
  }

  const montarHtml = (): string => {
    const titulo = TIPOS_DOCUMENTO.find((t) => t.valor === tipo)!.rotulo
    if (tipo === 'folha_ponto') {
      const t = totalizar(linhas)
      return `<h1>Folha-ponto — ${esc(mesPorExtenso(mes))}</h1>
        <div class="campos"><div><b>Colaborador(a)</b>${esc(dados.nome)}</div><div><b>CPF</b>${esc(dados.cpf || '—')}</div>
        <div><b>Função</b>${esc(dados.funcao || '—')}</div><div><b>Empresa</b>${esc(dados.empresa)} ${esc(empresa.cnpj)}</div></div>
        ${tabelaHtml(
          [{ titulo: 'Dia' }, { titulo: 'Entrada' }, { titulo: 'Intervalo' }, { titulo: 'Saída' }, { titulo: 'Trabalhado', num: true }, { titulo: 'Obs.' }],
          linhas.map((l) => [
            `${l.data.slice(8, 10)} ${NOMES_DIAS[diaDaSemana(l.data)]}${l.feriado ? ' (fer.)' : ''}`,
            horaCurta(l.marcacao?.entrada),
            l.marcacao?.saida_intervalo ? `${horaCurta(l.marcacao.saida_intervalo)}–${horaCurta(l.marcacao.volta_intervalo)}` : '',
            horaCurta(l.marcacao?.saida),
            l.trabalhado === null ? '' : formatarMinutos(l.trabalhado),
            l.escala && l.escala.tipo !== 'turno' ? l.escala.tipo : '',
          ]),
        )}
        <p>Total trabalhado: <b>${formatarMinutos(t.trabalhado)}</b> · Previsto: ${formatarMinutos(t.previsto)} · Saldo: ${formatarMinutos(t.saldo)} · Noturno: ${formatarMinutos(t.noturno)}</p>
        <div class="assinaturas"><div>${esc(dados.nome)}</div><div>${esc(dados.empresa)}</div></div>`
    }
    if (tipo === 'termo_domingo') {
      const lista = domingos.length
        ? tabelaHtml(
            [{ titulo: 'Data' }, { titulo: 'Dia' }, { titulo: 'Horário' }],
            domingos.map((l) => [formatarData(l.data), l.feriado ? 'Feriado' : 'Domingo', l.marcacao ? `${horaCurta(l.marcacao.entrada)}–${horaCurta(l.marcacao.saida)}` : 'Escalado']),
          )
        : '<p><i>Nenhum domingo ou feriado trabalhado no mês.</i></p>'
      return corpoTexto(titulo, textos.termo_domingo, { ...dados, data: formatarData(hojeISO()) }, lista)
    }
    const texto = textos[tipo as keyof typeof textos]
    return corpoTexto(titulo, texto, dados)
  }

  const [aviso, setAviso] = useState('')
  const gerar = () => {
    setAviso('')
    if ((tipo === 'recibo_adiantamento' || tipo === 'recibo_vale' || tipo === 'recibo_diaria') && !valor) return setAviso('Escolha o lançamento ou informe o valor.')
    if ((tipo === 'registro_ocorrencia' || tipo === 'advertencia') && !dados.descricao) return setAviso('Escolha a ocorrência ou descreva o fato.')
    const html = montarHtml()
    // A janela de impressão abre no clique (senão o navegador bloqueia); o registro é salvo em seguida.
    imprimirDocumento(TIPOS_DOCUMENTO.find((t) => t.valor === tipo)!.rotulo, html, { subtitulo: colaborador.nome })
    emitir.mutate(html)
  }

  const emitir = useMutation({
    mutationFn: async (html: string) => {
      const titulo = TIPOS_DOCUMENTO.find((t) => t.valor === tipo)!.rotulo
      const { error } = await supabase.from('documentos').insert({
        colaborador_id: colaborador.id,
        tipo,
        titulo: `${titulo}${precisaMes ? ` — ${mesPorExtenso(mes)}` : origem ? ` — ${formatarData(origem.data)}` : ''}`,
        referencia: precisaMes ? mes : origem?.data ?? dataDoc,
        origem_tipo: origem ? (tipo.startsWith('recibo_d') ? 'diaria' : tipo.startsWith('recibo') ? 'lancamento' : 'ocorrencia') : null,
        origem_id: origem?.id ?? null,
        html,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documentos'] })
      aoFechar()
    },
  })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={`Documento · ${colaborador.nome}`}
      largura="max-w-2xl"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao carregando={emitir.isPending} onClick={gerar}>Gerar e imprimir</Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {TIPOS_DOCUMENTO.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => { setTipo(t.valor); setOrigemId('') }}
              className={cx('rounded-lg border px-2.5 py-1.5 text-xs font-semibold sm:text-sm', tipo === t.valor ? 'border-acqua-petroleo bg-acqua-titulo text-white' : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave')}
            >
              {t.rotulo}
            </button>
          ))}
        </div>

        {precisaMes ? (
          <div className="space-y-2">
            <Campo rotulo="Mês" type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="w-48" />
            {tipo === 'termo_domingo' && (
              <p className="text-sm text-slate-600">
                {doMes.isLoading ? 'Conferindo a escala e o ponto…' : `${domingos.length} domingo(s)/feriado(s) trabalhado(s) neste mês: ${domingos.map((l) => formatarData(l.data).slice(0, 5)).join(', ') || 'nenhum'}.`}
              </p>
            )}
            {tipo === 'folha_ponto' && <p className="text-sm text-slate-600">Gera a folha do mês com as marcações do ponto, para assinatura.</p>}
          </div>
        ) : (
          <>
            <Selecao
              rotulo={tipo === 'recibo_diaria' ? 'Diária' : tipo.startsWith('recibo') ? 'Lançamento' : 'Ocorrência'}
              value={origemId}
              onChange={(e) => setOrigemId(e.target.value)}
              vazio={origens.data?.length ? 'Escolha… (ou preencha abaixo)' : 'Nenhum registro — preencha abaixo'}
              opcoes={(origens.data ?? []).map((o) => ({ valor: o.id, rotulo: o.rotulo }))}
            />
            {!origem && (
              <div className="grid gap-3 sm:grid-cols-2">
                {tipo.startsWith('recibo') && <Campo rotulo="Valor (R$)" inputMode="decimal" value={valorManual} onChange={(e) => setValorManual(e.target.value)} />}
                <Campo rotulo="Data" type="date" value={dataDoc} onChange={(e) => setDataDoc(e.target.value)} />
              </div>
            )}
            <AreaTexto
              rotulo={tipo.startsWith('recibo') ? 'Complemento (opcional)' : 'Descrição do fato'}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={origem?.descricao || ''}
            />
            {tipo.startsWith('recibo') && valor > 0 && <p className="text-sm text-acqua-titulo">{formatarMoeda(valor)} ({valorPorExtenso(valor)})</p>}
          </>
        )}
        {!empresa.cnpj && <Mensagem tipo="alerta">O CNPJ da empresa ainda não foi preenchido em Documentos → Modelos.</Mensagem>}
        {aviso && <Mensagem tipo="erro">{aviso}</Mensagem>}
        {emitir.error && <Mensagem tipo="erro">{mensagemErro(emitir.error)}</Mensagem>}
      </div>
    </Janela>
  )
}
