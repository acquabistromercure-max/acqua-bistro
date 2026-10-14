import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { lerMoeda } from '../../lib/formatos'
import { FORMAS_CAIXA, type ChaveVenda } from '../../lib/caixa'
import { Botao, Campo, Cartao, Mensagem, mensagemErro } from '../../components/ui'
import { useRegrasCaixa } from './dados'

const txt = (n: number | undefined | null) => (n ? String(n).replace('.', ',') : '')

/** Taxas por bandeira, prazos de recebimento e saldo inicial. Ficam no banco; só o administrador altera. */
export default function RegrasCaixa() {
  const qc = useQueryClient()
  const { perfil } = usePermissoes()
  const ehAdmin = perfil?.papel === 'administrador'
  const atual = useRegrasCaixa()
  const [taxas, setTaxas] = useState<Partial<Record<ChaveVenda, string>>>({})
  const [credito, setCredito] = useState('30')
  const [debito, setDebito] = useState('1')
  const [dataSaldo, setDataSaldo] = useState('')
  const [saldoCaixa, setSaldoCaixa] = useState('')
  const [saldoFundo, setSaldoFundo] = useState('')

  const assinatura = JSON.stringify(atual)
  useEffect(() => {
    setTaxas(Object.fromEntries(FORMAS_CAIXA.map((f) => [f.chave, txt(atual.taxas[f.chave])])))
    setCredito(String(atual.prazos.credito))
    setDebito(String(atual.prazos.debito))
    setDataSaldo(atual.saldo.data ?? '')
    setSaldoCaixa(txt(atual.saldo.caixa))
    setSaldoFundo(txt(atual.saldo.fundo))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura])

  const salvar = useMutation({
    mutationFn: async () => {
      const linhas = [
        {
          chave: 'caixa_taxas',
          valor: Object.fromEntries(FORMAS_CAIXA.map((f) => [f.chave, lerMoeda(taxas[f.chave] ?? '') ?? 0]).filter(([, v]) => Number(v) > 0)),
        },
        { chave: 'caixa_prazos', valor: { credito: Number(credito) || 0, debito: Number(debito) || 0 } },
        { chave: 'caixa_saldo_inicial', valor: { data: dataSaldo || null, caixa: lerMoeda(saldoCaixa) ?? 0, fundo: lerMoeda(saldoFundo) ?? 0 } },
      ]
      for (const l of linhas) {
        const { error } = await supabase.from('configuracoes').update({ valor: l.valor }).eq('chave', l.chave)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config'] }),
  })

  const cartoes = FORMAS_CAIXA.filter((f) => f.grupo !== 'Outros' || f.chave === 'pix')

  return (
    <div className="grid max-w-3xl gap-4">
      {!ehAdmin && <Mensagem tipo="info">Só o administrador altera as regras do caixa.</Mensagem>}
      <Cartao titulo="Taxas das maquininhas (%)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cartoes.map((f) => (
            <Campo
              key={f.chave}
              rotulo={f.rotulo}
              inputMode="decimal"
              value={taxas[f.chave] ?? ''}
              disabled={!ehAdmin}
              onChange={(e) => setTaxas({ ...taxas, [f.chave]: e.target.value })}
              placeholder="0"
            />
          ))}
        </div>
      </Cartao>
      <Cartao titulo="Prazos de recebimento (dias)">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Crédito" type="number" min={0} value={credito} disabled={!ehAdmin} onChange={(e) => setCredito(e.target.value)} />
          <Campo rotulo="Débito" type="number" min={0} value={debito} disabled={!ehAdmin} onChange={(e) => setDebito(e.target.value)} />
        </div>
      </Cartao>
      <Cartao titulo="Saldo inicial em dinheiro">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="A partir de" type="date" value={dataSaldo} disabled={!ehAdmin} onChange={(e) => setDataSaldo(e.target.value)} ajuda="Dia em que o controle começou." />
          <Campo rotulo="Caixa (R$)" inputMode="decimal" value={saldoCaixa} disabled={!ehAdmin} onChange={(e) => setSaldoCaixa(e.target.value)} />
          <Campo rotulo="Fundo de despesas (R$)" inputMode="decimal" value={saldoFundo} disabled={!ehAdmin} onChange={(e) => setSaldoFundo(e.target.value)} />
        </div>
      </Cartao>
      {ehAdmin && (
        <div className="flex items-center gap-3">
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>Salvar regras</Botao>
          {salvar.isSuccess && <span className="text-sm text-emerald-700">Regras salvas.</span>}
        </div>
      )}
      {salvar.error && <Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem>}
    </div>
  )
}
