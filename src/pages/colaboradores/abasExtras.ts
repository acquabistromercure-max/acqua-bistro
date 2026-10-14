import type { ComponentType } from 'react'
import type { Colaborador } from './tipos'
import AbaEscalaFicha from '../escalas/AbaEscalaFicha'
import AbaPontoFicha from '../escalas/AbaPontoFicha'
import AbaDocumentos from '../documentos/AbaDocumentos'

/**
 * Abas da ficha que pertencem a outros módulos (escala, ponto, documentos).
 * Cada módulo registra a sua aqui; a aba só aparece para quem pode "ver" o módulo.
 */
export type AbaExtra = { valor: string; rotulo: string; modulo: string; Componente: ComponentType<{ colaborador: Colaborador }> }

export const ABAS_EXTRAS: AbaExtra[] = [
  { valor: 'escala', rotulo: 'Escala', modulo: 'escalas', Componente: AbaEscalaFicha },
  { valor: 'ponto', rotulo: 'Ponto e horas', modulo: 'ponto', Componente: AbaPontoFicha },
  { valor: 'documentos', rotulo: 'Documentos', modulo: 'documentos', Componente: AbaDocumentos },
]
