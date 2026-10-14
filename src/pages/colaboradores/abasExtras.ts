import type { ComponentType } from 'react'
import type { Colaborador } from './tipos'

/**
 * Abas da ficha que pertencem a outros módulos (escala, ponto, documentos).
 * Cada módulo registra a sua aqui; a aba só aparece para quem pode "ver" o módulo.
 */
export type AbaExtra = { valor: string; rotulo: string; modulo: string; Componente: ComponentType<{ colaborador: Colaborador }> }

export const ABAS_EXTRAS: AbaExtra[] = []
