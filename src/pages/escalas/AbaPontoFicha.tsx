import type { Colaborador } from '../colaboradores/tipos'
import FolhaPonto from './FolhaPonto'

/** Aba "Ponto e horas" da ficha: a folha-ponto do mês da pessoa. */
export default function AbaPontoFicha({ colaborador }: { colaborador: Colaborador }) {
  return <FolhaPonto colaboradorId={colaborador.id} />
}
