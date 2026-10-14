import DiariasLista from './DiariasLista'
import type { Colaborador } from './tipos'

export default function AbaDiarias({ colaborador }: { colaborador: Colaborador }) {
  return <DiariasLista colaborador={colaborador} />
}
