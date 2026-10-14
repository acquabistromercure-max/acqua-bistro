import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ACOES, PAPEIS, type Acao, type Papel } from '../../lib/permissoes'
import { MODULOS_PERMISSAO } from '../../lib/modulos'
import { Abas, Carregando, Mensagem, Pagina, cx, mensagemErro } from '../../components/ui'

type Regra = { papel: Papel; modulo: string; acao: Acao }
const PAPEIS_EDITAVEIS = PAPEIS.filter((p) => p.valor !== 'administrador')

export default function Permissoes() {
  const qc = useQueryClient()
  const [papel, setPapel] = useState<Papel>('gerente')

  const regras = useQuery({
    queryKey: ['todas-permissoes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('permissoes').select('papel, modulo, acao')
      if (error) throw error
      return data as Regra[]
    },
  })

  const ativas = useMemo(
    () => new Set((regras.data ?? []).filter((r) => r.papel === papel).map((r) => `${r.modulo}:${r.acao}`)),
    [regras.data, papel],
  )

  const alternar = useMutation({
    mutationFn: async ({ modulo, acao, ligar }: { modulo: string; acao: Acao; ligar: boolean }) => {
      const { error } = ligar
        ? await supabase.from('permissoes').insert({ papel, modulo, acao })
        : await supabase.from('permissoes').delete().match({ papel, modulo, acao })
      if (error) throw error
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['todas-permissoes'] })
      qc.invalidateQueries({ queryKey: ['permissoes'] })
    },
  })

  return (
    <Pagina
      titulo="Permissões"
      descricao="Marque o que cada papel pode fazer em cada área. O Administrador sempre pode tudo. As mudanças valem na hora e ficam no histórico."
    >
      <Abas abas={PAPEIS_EDITAVEIS.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))} ativa={papel} aoMudar={setPapel} />
      <p className="mb-4 text-sm text-slate-600">{PAPEIS.find((p) => p.valor === papel)?.descricao}</p>
      {alternar.error && <div className="mb-4"><Mensagem tipo="erro">{mensagemErro(alternar.error)}</Mensagem></div>}
      {regras.isLoading ? (
        <Carregando />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-acqua-suave bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-acqua-gelo text-xs uppercase tracking-wider text-acqua-petroleo">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">Área</th>
                {ACOES.map((a) => (
                  <th key={a.valor} scope="col" className="px-2 py-3 text-center">{a.rotulo}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-acqua-suave">
              {MODULOS_PERMISSAO.map((m) => (
                <tr key={m.modulo}>
                  <th scope="row" className="px-4 py-2 text-left font-medium text-acqua-titulo">{m.rotulo}</th>
                  {ACOES.map((a) => {
                    const ligado = ativas.has(`${m.modulo}:${a.valor}`)
                    return (
                      <td key={a.valor} className="px-2 py-2 text-center">
                        <button
                          role="checkbox"
                          aria-checked={ligado}
                          aria-label={`${m.rotulo}: ${a.rotulo}`}
                          disabled={alternar.isPending}
                          onClick={() => alternar.mutate({ modulo: m.modulo, acao: a.valor, ligar: !ligado })}
                          className={cx(
                            'inline-flex h-7 w-7 items-center justify-center rounded-md border transition',
                            ligado ? 'border-acqua-petroleo bg-acqua-petroleo text-white' : 'border-[#C4D3E8] bg-white hover:bg-acqua-suave',
                          )}
                        >
                          {ligado && <Check className="h-4 w-4" />}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Pagina>
  )
}
