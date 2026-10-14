import type { LucideIcon } from 'lucide-react'
import {
  CalendarClock, Coffee, CreditCard, FileText, History, LayoutDashboard, PartyPopper,
  ShieldCheck, ShoppingCart, Users, UserCog, Wallet,
} from 'lucide-react'

export type ItemMenu = {
  rota: string
  rotulo: string
  icone: LucideIcon
  /** Módulo de permissão que libera o item (precisa de "ver"). */
  modulo: string
  grupo: 'Operação' | 'Pessoas' | 'Financeiro' | 'Administração'
  /** Ainda não construído: aparece como "em breve". */
  emBreve?: boolean
}

export const MENU: ItemMenu[] = [
  { rota: '/', rotulo: 'Painel', icone: LayoutDashboard, modulo: 'painel', grupo: 'Operação' },
  { rota: '/cafes', rotulo: 'Café da manhã', icone: Coffee, modulo: 'cafes', grupo: 'Operação' },
  { rota: '/eventos', rotulo: 'Eventos', icone: PartyPopper, modulo: 'eventos', grupo: 'Operação', emBreve: true },
  { rota: '/compras', rotulo: 'Compras e pedidos', icone: ShoppingCart, modulo: 'compras', grupo: 'Operação' },
  { rota: '/colaboradores', rotulo: 'Colaboradores', icone: Users, modulo: 'colaboradores', grupo: 'Pessoas' },
  { rota: '/escalas', rotulo: 'Escalas e ponto', icone: CalendarClock, modulo: 'escalas', grupo: 'Pessoas' },
  { rota: '/caixa', rotulo: 'Caixa', icone: Wallet, modulo: 'caixa', grupo: 'Financeiro' },
  { rota: '/cartoes', rotulo: 'Cartão empresa', icone: CreditCard, modulo: 'cartoes', grupo: 'Financeiro', emBreve: true },
  { rota: '/documentos', rotulo: 'Documentos', icone: FileText, modulo: 'documentos', grupo: 'Pessoas', emBreve: true },
  { rota: '/usuarios', rotulo: 'Usuários', icone: UserCog, modulo: 'usuarios', grupo: 'Administração' },
  { rota: '/permissoes', rotulo: 'Permissões', icone: ShieldCheck, modulo: 'usuarios', grupo: 'Administração' },
  { rota: '/auditoria', rotulo: 'Histórico', icone: History, modulo: 'auditoria', grupo: 'Administração' },
]

/** Módulos que aparecem na tela de permissões (o que cada papel pode fazer). */
export const MODULOS_PERMISSAO: { modulo: string; rotulo: string }[] = [
  { modulo: 'painel', rotulo: 'Painel' },
  { modulo: 'colaboradores', rotulo: 'Colaboradores e diaristas' },
  { modulo: 'dados_bancarios', rotulo: 'Dados bancários' },
  { modulo: 'ocorrencias', rotulo: 'Ocorrências' },
  { modulo: 'escalas', rotulo: 'Escalas' },
  { modulo: 'ponto', rotulo: 'Ponto e horas' },
  { modulo: 'cafes', rotulo: 'Café da manhã' },
  { modulo: 'caixa', rotulo: 'Caixa' },
  { modulo: 'financeiro', rotulo: 'Financeiro do colaborador' },
  { modulo: 'contas', rotulo: 'Contas a pagar' },
  { modulo: 'eventos', rotulo: 'Eventos' },
  { modulo: 'compras', rotulo: 'Compras e pedidos' },
  { modulo: 'cartoes', rotulo: 'Cartão empresa' },
  { modulo: 'documentos', rotulo: 'Documentos' },
  { modulo: 'auditoria', rotulo: 'Histórico (auditoria)' },
]
