import { useSearchParams } from 'react-router-dom'
import { Abas, Pagina } from '../../components/ui'
import Faturas from './Faturas'
import ComprasCartao from './Compras'
import Cartoes from './Cartoes'

type Aba = 'faturas' | 'compras' | 'cartoes'
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'faturas', rotulo: 'Faturas' },
  { valor: 'compras', rotulo: 'Compras' },
  { valor: 'cartoes', rotulo: 'Cartões' },
]

export default function CartaoEmpresa() {
  const [params, setParams] = useSearchParams()
  const pedida = params.get('aba') as Aba | null
  const aba: Aba = ABAS.some((a) => a.valor === pedida) ? pedida! : 'faturas'
  return (
    <Pagina titulo="Cartão empresa" descricao="Compras no cartão com itens e parcelas, faturas por mês e pagamentos.">
      <Abas abas={ABAS} ativa={aba} aoMudar={(v) => setParams(v === 'faturas' ? {} : { aba: v }, { replace: true })} />
      {aba === 'faturas' && <Faturas />}
      {aba === 'compras' && <ComprasCartao />}
      {aba === 'cartoes' && <Cartoes />}
    </Pagina>
  )
}
