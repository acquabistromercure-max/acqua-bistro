import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Hotel } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarMoeda } from '../../lib/formatos'
import { cafesGarantidos, tickets, totalDia } from '../../lib/cafe'
import { Botao, Campo, Cartao, Mensagem, mensagemErro } from '../../components/ui'
import type { CafeDia, RegrasCafe } from './dados'

/** Quadro do hotel no dia: hóspedes da lista e cafés servidos → garantido, tickets e total a cobrar. */
export default function DiaHotel({
  data,
  registro,
  regras,
  travado,
}: {
  data: string
  registro: CafeDia | null
  regras: RegrasCafe
  travado: boolean
}) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const [hospedes, setHospedes] = useState('')
  const [servidos, setServidos] = useState('')
  const [observacao, setObservacao] = useState('')

  useEffect(() => {
    setHospedes(registro ? String(registro.hospedes) : '')
    setServidos(registro ? String(registro.cafes_servidos) : '')
    setObservacao(registro?.observacao ?? '')
  }, [registro, data])

  const podeSalvar = !travado && (registro ? pode('cafes', 'editar') : pode('cafes', 'criar'))
  // Lançamento existente usa a regra "fotografada" no dia; novo usa a regra atual.
  const base = registro ? { valor_cafe: Number(registro.valor_cafe), percentual_garantido: Number(registro.percentual_garantido) } : regras
  const previa = {
    hospedes: Number(hospedes) || 0,
    cafes_servidos: Number(servidos) || 0,
    ...base,
  }
  const preenchido = hospedes !== '' && servidos !== ''

  const salvar = useMutation({
    mutationFn: async () => {
      const dados = { hospedes: previa.hospedes, cafes_servidos: previa.cafes_servidos, observacao: observacao.trim() || null }
      const { error } = registro
        ? await supabase.from('cafe_dias').update(dados).eq('id', registro.id)
        : await supabase.from('cafe_dias').insert({ ...dados, data, valor_cafe: regras.valor_cafe, percentual_garantido: regras.percentual_garantido })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cafe_dias'] }),
  })

  const alterado =
    !registro || String(registro.hospedes) !== hospedes || String(registro.cafes_servidos) !== servidos || (registro.observacao ?? '') !== observacao

  return (
    <Cartao titulo={<span className="flex items-center gap-2"><Hotel className="h-5 w-5 text-acqua-dourado" /> Café do hotel</span>}>
      <form
        className="grid gap-3 sm:grid-cols-[1fr,1fr,2fr,auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate()
        }}
      >
        <Campo rotulo="Hóspedes (lista)" type="number" min={0} inputMode="numeric" value={hospedes} disabled={!podeSalvar} onChange={(e) => setHospedes(e.target.value)} required />
        <Campo rotulo="Cafés servidos" type="number" min={0} inputMode="numeric" value={servidos} disabled={!podeSalvar} onChange={(e) => setServidos(e.target.value)} required />
        <Campo rotulo="Observação" value={observacao} disabled={!podeSalvar} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: hóspedes que não estavam na lista" />
        {podeSalvar && (
          <Botao type="submit" carregando={salvar.isPending} disabled={!preenchido || !alterado}>
            {registro ? 'Atualizar' : 'Salvar'}
          </Botao>
        )}
      </form>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero rotulo={`Garantido (${base.percentual_garantido}%)`} valor={preenchido ? String(cafesGarantidos(previa)).replace('.', ',') : '—'} />
        <Numero rotulo="Servidos" valor={preenchido ? String(previa.cafes_servidos) : '—'} />
        <Numero rotulo="Tickets do hotel" valor={preenchido ? String(tickets(previa)) : '—'} destaque={preenchido && tickets(previa) > 0} />
        <Numero rotulo="Total do dia" valor={preenchido ? formatarMoeda(totalDia(previa)) : '—'} />
      </dl>
      {preenchido && (
        <p className="mt-2 text-xs text-slate-500">
          ({previa.cafes_servidos} servidos + {tickets(previa)} tickets) × {formatarMoeda(base.valor_cafe)}
        </p>
      )}
      {salvar.isSuccess && !alterado && <div className="mt-3"><Mensagem tipo="sucesso">Dia salvo.</Mensagem></div>}
      {salvar.error && <div className="mt-3"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
    </Cartao>
  )
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={destaque ? 'rounded-lg bg-[#FBF3DF] px-3 py-2' : 'rounded-lg bg-acqua-gelo px-3 py-2'}>
      <dt className="text-[11px] text-slate-500">{rotulo}</dt>
      <dd className="text-lg font-semibold tabular-nums text-acqua-titulo">{valor}</dd>
    </div>
  )
}
