import { useState } from 'react'
import { hojeISO } from '../../lib/formatos'
import { intervalo } from '../../lib/periodos'
import { Campo } from '../../components/ui'
import DiariasLista from './DiariasLista'

/** Aba "Diárias" da lista: todas as convocações do período. */
export default function Diarias() {
  const mes = intervalo('mes', hojeISO())
  const [inicio, setInicio] = useState(mes.inicio)
  const [fim, setFim] = useState(mes.fim)
  return (
    <>
      <div className="mb-4 grid max-w-md grid-cols-2 gap-3">
        <Campo rotulo="De" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        <Campo rotulo="Até" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
      </div>
      <DiariasLista inicio={inicio} fim={fim} />
    </>
  )
}
