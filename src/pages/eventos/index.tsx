import { Route, Routes, useSearchParams } from 'react-router-dom'
import { Abas, Pagina } from '../../components/ui'
import Agenda from './Agenda'
import EventoDetalhe from './EventoDetalhe'
import { Clientes, Modelos, ProdutosAvulsos } from './Cadastros'

type Aba = 'agenda' | 'modelos' | 'produtos' | 'clientes'
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'agenda', rotulo: 'Agenda' },
  { valor: 'modelos', rotulo: 'Modelos de coffee break' },
  { valor: 'produtos', rotulo: 'Produtos avulsos' },
  { valor: 'clientes', rotulo: 'Clientes' },
]

function Inicio() {
  const [params, setParams] = useSearchParams()
  const pedida = params.get('aba') as Aba | null
  const aba: Aba = ABAS.some((a) => a.valor === pedida) ? pedida! : 'agenda'
  return (
    <Pagina titulo="Eventos e coffee break" descricao="Agenda, cardápios, consumos avulsos, equipe extra, faturamento e recebimento.">
      <Abas abas={ABAS} ativa={aba} aoMudar={(v) => setParams(v === 'agenda' ? {} : { aba: v }, { replace: true })} />
      {aba === 'agenda' && <Agenda />}
      {aba === 'modelos' && <Modelos />}
      {aba === 'produtos' && <ProdutosAvulsos />}
      {aba === 'clientes' && <Clientes />}
    </Pagina>
  )
}

export default function Eventos() {
  return (
    <Routes>
      <Route index element={<Inicio />} />
      <Route path=":id" element={<EventoDetalhe />} />
    </Routes>
  )
}
