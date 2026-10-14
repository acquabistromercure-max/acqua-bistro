import { Pagina, Vazio } from '../../components/ui'
import { usePermissoes } from '../../lib/permissoes'

export default function Painel() {
  const { perfil } = usePermissoes()
  return (
    <Pagina titulo={`Olá, ${perfil?.nome?.split(' ')[0] || perfil?.email || ''}!`} descricao="Resumo do dia no Acqua Bistrô.">
      <Vazio>O painel com cafés, caixa, equipe e eventos aparece aqui.</Vazio>
    </Pagina>
  )
}
