import type { ComponentType } from 'react'
import type { FiltroPainel } from './filtro'
import CardEquipe from '../escalas/CardEquipe'
import CardCafe from '../cafes/CardCafe'

/**
 * Cards do painel. Cada módulo registra o seu aqui quando fica pronto; o card só aparece
 * para quem tem permissão de "ver" o módulo.
 */
export type CardPainel = { id: string; modulo: string; Componente: ComponentType<{ filtro: FiltroPainel }> }

export const CARDS: CardPainel[] = [
  { id: 'cafe', modulo: 'cafes', Componente: CardCafe },
  { id: 'equipe', modulo: 'escalas', Componente: CardEquipe },
]
