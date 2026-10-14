import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarMoeda, lerMoeda } from '../../lib/formatos'
import { Botao, Campo, Carregando, Janela, Mensagem, Selecao, Selo, Vazio, mensagemErro } from '../../components/ui'
import { BotaoExcluir } from '../../components/registros'
import { useCartoes, type Cartao } from './dados'

/** Cadastro de cartões: só banco, apelido e os 4 últimos dígitos (nunca o número completo ou CVV). */
export default function Cartoes() {
  const { pode } = usePermissoes()
  const cartoes = useCartoes()
  const [editando, setEditando] = useState<Cartao | 'novo' | null>(null)
  return (
    <>
      <div className="mb-4 flex justify-end">
        {pode('cartoes', 'criar') && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setEditando('novo')}>Cartão</Botao>}
      </div>
      {cartoes.isLoading ? (
        <Carregando />
      ) : !cartoes.data?.length ? (
        <Vazio>Nenhum cartão cadastrado.</Vazio>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cartoes.data.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setEditando(c)}
              className="rounded-2xl bg-gradient-to-br from-acqua-titulo to-[#126E89] p-4 text-left text-white shadow-md transition hover:brightness-110"
            >
              <div className="flex items-center justify-between">
                <CreditCard className="h-6 w-6 text-acqua-dourado" />
                {!c.ativo && <Selo>Inativo</Selo>}
                {c.tipo === 'pessoal' && <Selo cor="dourado">Pessoal · reembolso</Selo>}
              </div>
              <p className="mt-6 font-mono text-lg tracking-widest">•••• •••• •••• {c.final}</p>
              <p className="mt-2 font-semibold">{c.apelido}</p>
              <p className="text-xs text-white/70">{c.banco}{c.titular ? ` · ${c.titular}` : ''} · fecha dia {c.fechamento_dia} · vence dia {c.vencimento_dia}</p>
              {c.limite ? <p className="text-xs text-white/70">Limite {formatarMoeda(c.limite)}</p> : null}
            </button>
          ))}
        </div>
      )}
      {editando && <FormCartao cartao={editando === 'novo' ? null : editando} aoFechar={() => setEditando(null)} />}
    </>
  )
}

function FormCartao({ cartao, aoFechar }: { cartao: Cartao | null; aoFechar: () => void }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const [f, setF] = useState({
    apelido: cartao?.apelido ?? '',
    banco: cartao?.banco ?? '',
    final: cartao?.final ?? '',
    titular: cartao?.titular ?? '',
    tipo: cartao?.tipo ?? 'empresa',
    fechamento_dia: String(cartao?.fechamento_dia ?? ''),
    vencimento_dia: String(cartao?.vencimento_dia ?? ''),
    limite: cartao?.limite != null ? String(cartao.limite).replace('.', ',') : '',
    ativo: cartao?.ativo ?? true,
  })
  const podeSalvar = cartao ? pode('cartoes', 'editar') : pode('cartoes', 'criar')
  const salvar = useMutation({
    mutationFn: async () => {
      if (!/^\d{4}$/.test(f.final)) throw new Error('Informe só os 4 últimos dígitos.')
      const dados = {
        apelido: f.apelido.trim(),
        banco: f.banco.trim(),
        final: f.final,
        titular: f.titular.trim() || null,
        tipo: f.tipo,
        fechamento_dia: Number(f.fechamento_dia),
        vencimento_dia: Number(f.vencimento_dia),
        limite: lerMoeda(f.limite),
        ativo: f.ativo,
      }
      const { error } = cartao ? await supabase.from('cartoes').update(dados).eq('id', cartao.id) : await supabase.from('cartoes').insert(dados)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartoes'] })
      aoFechar()
    },
  })
  const campo = (k: keyof typeof f) => ({ value: String(f[k]), disabled: !podeSalvar, onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value } as typeof f) })
  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={cartao ? cartao.apelido : 'Novo cartão'}
      rodape={
        <>
          {cartao && <BotaoExcluir modulo="cartoes" tabela="cartoes" id={cartao.id} descricao={`o cartão ${cartao.apelido}`} aoExcluir={() => { qc.invalidateQueries({ queryKey: ['cartoes'] }); aoFechar() }} />}
          <Botao variante="secundario" onClick={aoFechar}>Fechar</Botao>
          {podeSalvar && <Botao type="submit" form="form-cartao" carregando={salvar.isPending}>Salvar</Botao>}
        </>
      }
    >
      <form id="form-cartao" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
        <Campo rotulo="Apelido" {...campo('apelido')} required autoFocus placeholder="Ex.: Master empresa" />
        <Campo rotulo="Banco" {...campo('banco')} required />
        <Campo rotulo="4 últimos dígitos" {...campo('final')} inputMode="numeric" maxLength={4} required ajuda="Nunca digite o número completo nem o CVV." />
        <Campo rotulo="Titular" {...campo('titular')} />
        <Campo rotulo="Dia do fechamento" type="number" min={1} max={31} {...campo('fechamento_dia')} required />
        <Campo rotulo="Dia do vencimento" type="number" min={1} max={31} {...campo('vencimento_dia')} required />
        <Campo rotulo="Limite (R$)" inputMode="decimal" {...campo('limite')} />
        <Selecao rotulo="Tipo" {...campo('tipo')} opcoes={[{ valor: 'empresa', rotulo: 'Cartão da empresa' }, { valor: 'pessoal', rotulo: 'Cartão pessoal (reembolsar)' }]} />
        {cartao && (
          <Selecao rotulo="Situação" value={f.ativo ? 'sim' : 'nao'} disabled={!podeSalvar} onChange={(e) => setF({ ...f, ativo: e.target.value === 'sim' })} opcoes={[{ valor: 'sim', rotulo: 'Ativo' }, { valor: 'nao', rotulo: 'Inativo' }]} />
        )}
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
