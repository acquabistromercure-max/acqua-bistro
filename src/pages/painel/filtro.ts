import type { Escala } from '../../lib/periodos'

/** Filtro do painel, repassado a cada card. */
export type FiltroPainel = { escala: Escala; data: string; inicio: string; fim: string }
