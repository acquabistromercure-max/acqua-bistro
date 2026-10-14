import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { formatarData, hojeISO, somarDias } from '../../lib/formatos'
import { NOMES_DIAS, diaDaSemana } from '../../lib/ponto'
import { quinzena } from '../../lib/cafe'
import { Botao, Campo, Carregando, Mensagem, mensagemErro } from '../../components/ui'
import DiaHotel from './DiaHotel'
import Ajustes from './Ajustes'
import Bordero from './Bordero'
import Vendas from './Vendas'
import { useQuinzena, useRegrasCafe, useTabelaPeriodo, type Ajuste, type CafeDia, type ConsumoQuarto, type Venda } from './dados'

/** Tudo do café num dia só: hotel, por fora da lista, borderô e cafés pagos na hora. */
export default function Dia() {
  const hoje = hojeISO()
  const [params] = useSearchParams()
  const [data, setData] = useState(hoje)
  const { regras, itens, precos, autorizadores, configurado } = useRegrasCafe()
  const q = quinzena(data)
  const fechamento = useQuinzena(q.inicio)
  const travado = !!fechamento.data?.ativa

  const dias = useTabelaPeriodo<CafeDia>('cafe_dias', data, data)
  const ajustes = useTabelaPeriodo<Ajuste>('cafe_ajustes', data, data)
  const bordero = useTabelaPeriodo<ConsumoQuarto>('consumos_quarto', data, data)
  const vendas = useTabelaPeriodo<Venda>('cafe_vendas', data, data)
  const erro = dias.error || ajustes.error || bordero.error || vendas.error

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Botao variante="secundario" aria-label="Dia anterior" onClick={() => setData(somarDias(data, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Botao>
        <Campo rotulo="Dia" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} className="w-40" />
        <Botao variante="secundario" aria-label="Próximo dia" onClick={() => setData(somarDias(data, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Botao>
        {data !== hoje && <Botao variante="fantasma" onClick={() => setData(hoje)}>Hoje</Botao>}
        <p className="mb-2 ml-1 text-sm text-slate-600">
          {NOMES_DIAS[diaDaSemana(data)]}, {formatarData(data)} · quinzena {q.rotulo}
        </p>
      </div>

      {!configurado && (
        <Mensagem tipo="alerta">
          As regras do café (valor por café e percentual garantido) ainda não foram preenchidas. O administrador preenche em
          <b> Café da manhã → Regras</b>.
        </Mensagem>
      )}
      {travado && (
        <Mensagem tipo="info">
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Esta quinzena já foi enviada ao hotel: hotel, ajustes e borderô ficam travados. Vendas pagas na hora continuam
            liberadas.
          </span>
        </Mensagem>
      )}
      {erro && <Mensagem tipo="erro">{mensagemErro(erro)}</Mensagem>}

      {dias.isLoading || ajustes.isLoading || bordero.isLoading || vendas.isLoading ? (
        <Carregando />
      ) : (
        <>
          <DiaHotel data={data} registro={dias.data?.[0] ?? null} regras={regras} travado={travado || (!configurado && !dias.data?.[0])} />
          <div className="grid gap-4 xl:grid-cols-2">
            <Ajustes data={data} lista={ajustes.data ?? []} valorCafe={regras.valor_cafe} autorizadores={autorizadores} travado={travado} />
            <Bordero data={data} lista={bordero.data ?? []} itens={itens} travado={travado} />
          </div>
          <Vendas data={data} lista={vendas.data ?? []} precos={precos} focar={params.get('novo') === '1'} />
        </>
      )}
    </div>
  )
}
