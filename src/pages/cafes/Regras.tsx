import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarMoeda, lerMoeda } from '../../lib/formatos'
import { Botao, Campo, Cartao, Mensagem, mensagemErro } from '../../components/ui'
import { useRegrasCafe } from './dados'

const moeda = (n: number) => (n ? String(n).replace('.', ',') : '')

/** Regras do contrato e atalhos de preço. Ficam no banco (não no código público) e só o administrador altera. */
export default function Regras() {
  const qc = useQueryClient()
  const { perfil } = usePermissoes()
  const ehAdmin = perfil?.papel === 'administrador'
  const atual = useRegrasCafe()
  const [valorCafe, setValorCafe] = useState('')
  const [percentual, setPercentual] = useState('')
  const [itens, setItens] = useState<{ nome: string; valor: string }[]>([])
  const [precos, setPrecos] = useState('')
  const [autorizadores, setAutorizadores] = useState('')

  // Preenche o formulário quando as regras chegam do banco (ou mudam lá), sem atrapalhar a digitação.
  const assinatura = JSON.stringify([atual.regras, atual.itens, atual.precos, atual.autorizadores])
  useEffect(() => {
    setValorCafe(moeda(atual.regras.valor_cafe))
    setPercentual(atual.regras.percentual_garantido ? String(atual.regras.percentual_garantido).replace('.', ',') : '')
    setItens(atual.itens.map((i) => ({ nome: i.nome, valor: moeda(i.valor) })))
    setPrecos(atual.precos.map(moeda).join('; '))
    setAutorizadores(atual.autorizadores.join('; '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura])

  const salvar = useMutation({
    mutationFn: async () => {
      const v = lerMoeda(valorCafe)
      const p = lerMoeda(percentual)
      if (v === null || v <= 0) throw new Error('Informe o valor por café.')
      if (p === null || p < 0 || p > 100) throw new Error('O percentual garantido precisa ficar entre 0 e 100.')
      const linhas = [
        { chave: 'cafe_regras', valor: { valor_cafe: v, percentual_garantido: p } },
        {
          chave: 'cafe_itens_bordero',
          valor: itens.filter((i) => i.nome.trim()).map((i) => ({ nome: i.nome.trim(), valor: lerMoeda(i.valor) ?? 0 })),
        },
        {
          chave: 'cafe_precos_venda',
          valor: precos.split(/[;\n]/).map((x) => lerMoeda(x)).filter((x): x is number => x !== null && x > 0),
        },
        { chave: 'cafe_autorizadores', valor: autorizadores.split(/[;\n,]/).map((x) => x.trim()).filter(Boolean) },
      ]
      for (const l of linhas) {
        const { error } = await supabase.from('configuracoes').update({ valor: l.valor }).eq('chave', l.chave)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config'] }),
  })

  return (
    <div className="grid max-w-3xl gap-4">
      {!ehAdmin && <Mensagem tipo="info">Só o administrador altera as regras. Aqui você pode consultar o que está valendo.</Mensagem>}
      <Cartao titulo="Contrato do café com o hotel">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Valor por café (R$)" inputMode="decimal" value={valorCafe} disabled={!ehAdmin} onChange={(e) => setValorCafe(e.target.value)} />
          <Campo
            rotulo="Café garantido (% dos hóspedes)"
            inputMode="decimal"
            value={percentual}
            disabled={!ehAdmin}
            onChange={(e) => setPercentual(e.target.value)}
            ajuda="Se servir menos que isso, o hotel paga a diferença em tickets."
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">Mudar aqui vale para os próximos lançamentos; dias já lançados guardam a regra da época.</p>
      </Cartao>

      <Cartao
        titulo="Itens do borderô (conta do quarto)"
        acoes={ehAdmin && <Botao variante="secundario" icone={<Plus className="h-4 w-4" />} onClick={() => setItens([...itens, { nome: '', valor: '' }])}>Item</Botao>}
      >
        {itens.length === 0 && <p className="text-sm text-slate-500">Nenhum item. Ex.: Café, Almoço, Jantar, Café espresso.</p>}
        <div className="space-y-2">
          {itens.map((i, n) => (
            <div key={n} className="grid grid-cols-[1fr,120px,auto] items-end gap-2">
              <Campo rotulo={n === 0 ? 'Item' : ' '} value={i.nome} disabled={!ehAdmin} onChange={(e) => setItens(itens.map((x, k) => (k === n ? { ...x, nome: e.target.value } : x)))} />
              <Campo rotulo={n === 0 ? 'Valor (R$)' : ' '} inputMode="decimal" value={i.valor} disabled={!ehAdmin} onChange={(e) => setItens(itens.map((x, k) => (k === n ? { ...x, valor: e.target.value } : x)))} />
              {ehAdmin && (
                <Botao variante="fantasma" aria-label="Remover item" onClick={() => setItens(itens.filter((_, k) => k !== n))}>
                  <Trash2 className="h-4 w-4" />
                </Botao>
              )}
            </div>
          ))}
        </div>
      </Cartao>

      <Cartao titulo="Atalhos">
        <div className="grid gap-3">
          <Campo
            rotulo="Preços sugeridos para cafés pagos na hora"
            value={precos}
            disabled={!ehAdmin}
            onChange={(e) => setPrecos(e.target.value)}
            ajuda={`Separe por ponto e vírgula. Ex.: 45; 54; 60${atual.precos.length ? ` — hoje: ${atual.precos.map(formatarMoeda).join(', ')}` : ''}`}
          />
          <Campo
            rotulo="Quem pode liberar café (sugestões)"
            value={autorizadores}
            disabled={!ehAdmin}
            onChange={(e) => setAutorizadores(e.target.value)}
            ajuda="Nomes separados por ponto e vírgula. Aparecem em “Liberado por” nos ajustes."
          />
        </div>
      </Cartao>

      {ehAdmin && (
        <div className="flex flex-wrap items-center gap-3">
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>Salvar regras</Botao>
          {salvar.isSuccess && <span className="text-sm text-emerald-700">Regras salvas.</span>}
        </div>
      )}
      {salvar.error && <Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem>}
    </div>
  )
}
