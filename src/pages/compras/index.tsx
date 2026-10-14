import { useSearchParams } from 'react-router-dom'
import { usePermissoes } from '../../lib/permissoes'
import { Abas, Pagina } from '../../components/ui'
import Pedidos from './Pedidos'
import Catalogo from './Catalogo'
import Fornecedores from './Fornecedores'
import ContasPagar from './ContasPagar'

type Aba = 'pedidos' | 'catalogo' | 'fornecedores' | 'contas'

export default function Compras() {
  const { pode } = usePermissoes()
  const [params, setParams] = useSearchParams()
  const abas: { valor: Aba; rotulo: string }[] = [
    { valor: 'pedidos', rotulo: 'Lista de pedidos' },
    { valor: 'catalogo', rotulo: 'Catálogo de produtos' },
    { valor: 'fornecedores', rotulo: 'Fornecedores' },
    ...(pode('contas') ? [{ valor: 'contas' as const, rotulo: 'Contas a pagar' }] : []),
  ]
  const pedida = params.get('aba') as Aba | null
  const aba: Aba = abas.some((a) => a.valor === pedida) ? pedida! : 'pedidos'
  return (
    <Pagina titulo="Compras e pedidos" descricao="Listas de pedidos por categoria, catálogo, fornecedores e boletos a pagar.">
      <Abas abas={abas} ativa={aba} aoMudar={(v) => setParams(v === 'pedidos' ? {} : { aba: v }, { replace: true })} />
      {aba === 'pedidos' && <Pedidos />}
      {aba === 'catalogo' && <Catalogo />}
      {aba === 'fornecedores' && <Fornecedores />}
      {aba === 'contas' && <ContasPagar />}
    </Pagina>
  )
}
