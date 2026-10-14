import type { ComponentType } from 'react'
import type { FiltroPainel } from './filtro'

/**
 * Cards do painel. Cada módulo registra o seu aqui quando fica pronto; o card só aparece
 * para quem tem permissão de "ver" o módulo.
 */
export type CardPainel = { id: string; modulo: string; Componente: ComponentType<{ filtro: FiltroPainel }> }

export const CARDS: CardPainel[] = []
