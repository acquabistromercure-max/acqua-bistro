import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarData, formatarMoeda } from '../../lib/formatos'
import { Carregando, Vazio } from '../../components/ui'
import { SeloSituacao } from '../../components/registros'
import { TIPOS_LANCAMENTO, TIPOS_OCORRENCIA, rotulo, type Colaborador } from './tipos'

type Evento = { data: string; titulo: string; detalhe?: string; situacao?: string }

/** Junta tudo o que aconteceu com o colaborador, do mais recente ao mais antigo. */
export default function AbaLinhaDoTempo({ colaborador }: { colaborador: Colaborador }) {
  const { pode } = usePermissoes()
  const eventos = useQuery({
    queryKey: ['linha-do-tempo', colaborador.id],
    queryFn: async () => {
      const lista: Evento[] = []
      if (colaborador.data_admissao) lista.push({ data: colaborador.data_admissao, titulo: 'Admissão', detalhe: colaborador.funcao ?? undefined })
      if (colaborador.data_desligamento)
        lista.push({ data: colaborador.data_desligamento, titulo: 'Desligamento', detalhe: colaborador.motivo_desligamento ?? undefined })
      const [ocorr, lanc, diar] = await Promise.all([
        pode('ocorrencias') ? supabase.from('ocorrencias').select('data, tipo, descricao, situacao').eq('colaborador_id', colaborador.id) : null,
        pode('financeiro') ? supabase.from('lancamentos_colaborador').select('data, tipo, valor, situacao').eq('colaborador_id', colaborador.id) : null,
        supabase.from('diarias').select('data, turno, valor, situacao').eq('colaborador_id', colaborador.id),
      ])
      for (const o of ocorr?.data ?? []) lista.push({ data: o.data, titulo: rotulo(TIPOS_OCORRENCIA, o.tipo), detalhe: o.descricao, situacao: o.situacao })
      for (const l of lanc?.data ?? []) lista.push({ data: l.data, titulo: rotulo(TIPOS_LANCAMENTO, l.tipo), detalhe: formatarMoeda(l.valor), situacao: l.situacao })
      for (const d of diar.data ?? []) lista.push({ data: d.data, titulo: 'Diária', detalhe: [d.turno, formatarMoeda(d.valor)].filter(Boolean).join(' · '), situacao: d.situacao })
      return lista.sort((a, b) => b.data.localeCompare(a.data))
    },
  })

  if (eventos.isLoading) return <Carregando />
  if (!eventos.data?.length) return <Vazio>Nada registrado ainda.</Vazio>
  return (
    <ol className="relative ml-3 border-l-2 border-acqua-suave">
      {eventos.data.map((e, i) => (
        <li key={i} className="mb-4 ml-5">
          <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-acqua-dourado" />
          <p className="text-xs text-slate-500">{formatarData(e.data)}</p>
          <p className="text-sm font-semibold text-acqua-titulo">
            {e.titulo} {e.situacao && <SeloSituacao situacao={e.situacao} />}
          </p>
          {e.detalhe && <p className="text-sm text-slate-600">{e.detalhe}</p>}
        </li>
      ))}
    </ol>
  )
}
