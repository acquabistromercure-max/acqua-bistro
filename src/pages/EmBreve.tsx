import { Construction } from 'lucide-react'
import { Pagina, Vazio } from '../components/ui'

export default function EmBreve({ titulo }: { titulo: string }) {
  return (
    <Pagina titulo={titulo}>
      <Vazio>
        <Construction className="mx-auto mb-2 h-8 w-8 text-acqua-dourado" />
        Esta área está em construção e aparece aqui assim que ficar pronta.
      </Vazio>
    </Pagina>
  )
}
