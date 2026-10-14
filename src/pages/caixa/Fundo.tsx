import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePermissoes } from '../../lib/permissoes'
import { formatarMoeda, hojeISO, somarDias } from '../../lib/formatos'
import { descreverPeriodo, intervalo } from '../../lib/periodos'
import { arred } from '../../lib/caixa'
import { Botao, Cartao, Carregando, Mensagem } from '../../components/ui'
import { ListaMovimentos, NovoMovimento } from './Movimentos'
import { totaisMovimentos, useMovimentos, useRegrasCaixa } from './dados'

/** Fundo de despesas (o "controle de entradas da empresa"): aportes e gastos pequenos, com saldo que passa de mês. */
export default function Fundo() {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const [ref, setRef] = useState(hojeISO())
  const { inicio, fim } = intervalo('mes', ref)
  const { saldo } = useRegrasCaixa()
  const [novo, setNovo] = useState<'entrada' | 'saida' | null>(null)
  const inicioSaldo = saldo.data ?? '2000-01-01'
  const mes = useMovimentos(inicio, fim, 'fundo')
  const antes = useMovimentos(inicioSaldo, somarDias(inicio, -1), 'fundo')
  const t = totaisMovimentos(mes.data ?? [])
  const a = totaisMovimentos(antes.data ?? [])
  const saldoAnterior = arred(saldo.fundo + a.entradas - a.saidas)
  const saldoAtual = arred(saldoAnterior + t.entradas - t.saidas)

  const mover = (n: 1 | -1) => {
    const d = new Date(`${inicio}T12:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + n)
    setRef(d.toISOString().slice(0, 10))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Botao variante="secundario" aria-label="Mês anterior" onClick={() => mover(-1)}><ChevronLeft className="h-4 w-4" /></Botao>
        <span className="min-w-36 text-center text-sm font-semibold capitalize text-acqua-titulo">{descreverPeriodo('mes', ref)}</span>
        <Botao variante="secundario" aria-label="Próximo mês" onClick={() => mover(1)}><ChevronRight className="h-4 w-4" /></Botao>
        {pode('caixa', 'criar') && (
          <div className="ml-auto flex gap-2">
            <Botao variante="secundario" icone={<ArrowDownCircle className="h-4 w-4" />} onClick={() => setNovo('entrada')}>Aporte</Botao>
            <Botao icone={<ArrowUpCircle className="h-4 w-4" />} onClick={() => setNovo('saida')}>Gasto</Botao>
          </div>
        )}
      </div>
      {!saldo.data && <Mensagem tipo="alerta">Informe o saldo inicial do fundo em <b>Caixa → Regras</b>.</Mensagem>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Resumo rotulo="Saldo do mês anterior" valor={saldoAnterior} />
        <Resumo rotulo="Aportes" valor={t.entradas} />
        <Resumo rotulo="Gastos" valor={-t.saidas} />
        <Resumo rotulo="Saldo atual" valor={saldoAtual} destaque />
      </div>
      <Cartao titulo="Movimentos do fundo">
        {mes.isLoading ? <Carregando /> : <ListaMovimentos lista={mes.data ?? []} mostrarData vazio="Nenhum movimento neste mês." />}
      </Cartao>
      {novo && (
        <NovoMovimento
          data={hojeISO()}
          conta="fundo"
          inicial={{ sentido: novo, categoria: novo === 'entrada' ? 'aporte' : undefined }}
          aoFechar={() => setNovo(null)}
          aoSalvar={() => {
            setNovo(null)
            qc.invalidateQueries({ queryKey: ['caixa_movimentos'] })
            qc.invalidateQueries({ queryKey: ['lancamentos-colaborador'] })
          }}
        />
      )}
    </div>
  )
}

function Resumo({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={destaque ? 'rounded-xl border border-acqua bg-acqua-suave p-3' : 'rounded-xl border border-acqua-suave bg-white p-3'}>
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className={valor < 0 ? 'text-lg font-semibold tabular-nums text-red-700' : 'text-lg font-semibold tabular-nums text-acqua-titulo'}>{formatarMoeda(valor)}</p>
    </div>
  )
}
