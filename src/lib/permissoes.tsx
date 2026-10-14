import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'

export type Papel = 'administrador' | 'gerente' | 'financeiro' | 'rh' | 'operador' | 'consulta'
export type Acao = 'ver' | 'criar' | 'editar' | 'aprovar' | 'cancelar' | 'exportar' | 'excluir'

export const PAPEIS: { valor: Papel; rotulo: string; descricao: string }[] = [
  { valor: 'administrador', rotulo: 'Administrador', descricao: 'Usuários, permissões, configurações e auditoria' },
  { valor: 'gerente', rotulo: 'Gerente', descricao: 'Operações, relatórios e aprovações' },
  { valor: 'financeiro', rotulo: 'Financeiro', descricao: 'Caixa, contas, conciliação e pagamentos' },
  { valor: 'rh', rotulo: 'RH', descricao: 'Colaboradores, escalas, documentos e jornadas' },
  { valor: 'operador', rotulo: 'Operador', descricao: 'Lançamentos operacionais do dia a dia' },
  { valor: 'consulta', rotulo: 'Consulta', descricao: 'Somente leitura' },
]

export const ACOES: { valor: Acao; rotulo: string }[] = [
  { valor: 'ver', rotulo: 'Ver' },
  { valor: 'criar', rotulo: 'Criar' },
  { valor: 'editar', rotulo: 'Editar' },
  { valor: 'aprovar', rotulo: 'Aprovar' },
  { valor: 'cancelar', rotulo: 'Cancelar' },
  { valor: 'exportar', rotulo: 'Exportar' },
  { valor: 'excluir', rotulo: 'Excluir' },
]

export function rotuloPapel(papel: string | null | undefined) {
  return PAPEIS.find((p) => p.valor === papel)?.rotulo ?? papel ?? ''
}

export type Perfil = { id: string; email: string; nome: string | null; papel: Papel; ativo: boolean }

type Estado = {
  perfil: Perfil | null
  carregando: boolean
  pode: (modulo: string, acao?: Acao) => boolean
}

const Contexto = createContext<Estado>({ perfil: null, carregando: true, pode: () => false })

export function PermissoesProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth()
  const id = sessao?.user.id

  const perfil = useQuery({
    queryKey: ['meu-perfil', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('perfis').select('id, email, nome, papel, ativo').eq('id', id!).maybeSingle()
      if (error) throw error
      return data as Perfil | null
    },
  })

  const papel = perfil.data?.ativo ? perfil.data.papel : null
  const regras = useQuery({
    queryKey: ['permissoes', papel],
    enabled: !!papel && papel !== 'administrador',
    queryFn: async () => {
      const { data, error } = await supabase.from('permissoes').select('modulo, acao').eq('papel', papel!)
      if (error) throw error
      return new Set(data.map((r) => `${r.modulo}:${r.acao}`))
    },
  })

  const pode = (modulo: string, acao: Acao = 'ver') => {
    if (!papel) return false
    if (papel === 'administrador') return true
    return regras.data?.has(`${modulo}:${acao}`) ?? false
  }

  const carregando = perfil.isLoading || (!!papel && papel !== 'administrador' && regras.isLoading)

  return <Contexto.Provider value={{ perfil: perfil.data ?? null, carregando, pode }}>{children}</Contexto.Provider>
}

export function usePermissoes() {
  return useContext(Contexto)
}
