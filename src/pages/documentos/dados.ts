import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useConfiguracao } from '../../lib/hooks'
import { TEXTOS_PADRAO } from '../../lib/documentos'

export type Documento = {
  id: string
  colaborador_id: string | null
  tipo: string
  titulo: string
  referencia: string | null
  origem_tipo: string | null
  origem_id: string | null
  html: string
  situacao: 'emitido' | 'enviado' | 'assinado' | 'cancelado'
  arquivo: string | null
  assinado_em: string | null
  motivo_cancelamento: string | null
  criado_por: string | null
  criado_em: string
}

export type Empresa = { razao_social: string; nome_fantasia: string; cnpj: string; endereco: string; cidade: string }

export function useEmpresa(): Empresa {
  const e = useConfiguracao<Partial<Empresa>>('empresa_dados', {})
  return {
    razao_social: e.razao_social || e.nome_fantasia || 'Acqua Bistrô',
    nome_fantasia: e.nome_fantasia || 'Acqua Bistrô',
    cnpj: e.cnpj || '',
    endereco: e.endereco || '',
    cidade: e.cidade || 'Fortaleza/CE',
  }
}

/** Texto de cada modelo: o personalizado pelo administrador ou o padrão. */
export function useTextos(): typeof TEXTOS_PADRAO {
  const personalizados = useConfiguracao<Partial<typeof TEXTOS_PADRAO>>('documentos_modelos', {})
  return { ...TEXTOS_PADRAO, ...Object.fromEntries(Object.entries(personalizados).filter(([, v]) => !!v && String(v).trim())) }
}

export function useDocumentos(colaboradorId?: string) {
  return useQuery({
    queryKey: ['documentos', colaboradorId ?? 'todos'],
    queryFn: async () => {
      let q = supabase.from('documentos').select('*').order('criado_em', { ascending: false }).limit(500)
      if (colaboradorId) q = q.eq('colaborador_id', colaboradorId)
      const { data, error } = await q
      if (error) throw error
      return data as Documento[]
    },
  })
}
