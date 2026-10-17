import type { ComponentType } from 'react'
import type { Colaborador } from './tipos'
import AbaPontoFicha from '../escalas/AbaPontoFicha'
import AbaDocumentos from '../documentos/AbaDocumentos'

/**
 * Abas da ficha que pertencem a outros módulos (ponto e horas, documentos). A escala fica na tela Escalas e ponto.
 * Cada módulo registra a sua aqui; a aba só aparece para quem pode "ver" o módulo.
 */
export type AbaExtra = { valor: string; rotulo: string; modulo: string; Componente: ComponentType<{ colaborador: Colaborador }> }

export const ABAS_EXTRAS: AbaExtra[] = [
  { valor: 'ponto', rotulo: 'Ponto e horas', modulo: 'ponto', Componente: AbaPontoFicha },
  { valor: 'documentos', rotulo: 'Documentos', modulo: 'documentos', Componente: AbaDocumentos },
]
