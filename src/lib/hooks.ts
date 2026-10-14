import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

/** Mapa id → nome dos usuários do sistema (para mostrar "quem lançou"). */
export function useNomesUsuarios() {
  const q = useQuery({
    queryKey: ['nomes-usuarios'],
    queryFn: async () => {
      const { data } = await supabase.from('perfis').select('id, nome, email')
      return new Map((data ?? []).map((p) => [p.id as string, (p.nome || p.email) as string]))
    },
    staleTime: 5 * 60_000,
  })
  return (id: string | null | undefined) => (id ? q.data?.get(id) ?? '…' : 'Sistema')
}

/** Lista de turnos configurada pelo administrador. */
export function useTurnos() {
  const q = useQuery({
    queryKey: ['config', 'turnos'],
    queryFn: async () => {
      const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'turnos').maybeSingle()
      return (data?.valor as string[] | undefined) ?? ['Manhã', 'Tarde', 'Noite']
    },
    staleTime: 10 * 60_000,
  })
  return q.data ?? ['Manhã', 'Tarde', 'Noite']
}
