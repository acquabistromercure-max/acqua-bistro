import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarTelefone } from '../../lib/documentos-br'
import { AreaTexto, Botao, Campo, Carregando, Janela, Mensagem, Selecao, Selo, Tabela, mensagemErro } from '../../components/ui'
import { BotaoExcluir } from '../../components/registros'
import { FORMAS_CONTA, useCategoriasCompras, useFornecedores, type Fornecedor } from './dados'

export default function Fornecedores() {
  const { pode } = usePermissoes()
  const lista = useFornecedores()
  const [editando, setEditando] = useState<Fornecedor | 'novo' | null>(null)
  return (
    <>
      <div className="mb-4 flex justify-end">
        {(pode('compras', 'criar') || pode('contas', 'criar')) && <Botao icone={<Plus className="h-4 w-4" />} onClick={() => setEditando('novo')}>Fornecedor</Botao>}
      </div>
      {lista.isLoading ? (
        <Carregando />
      ) : (
        <Tabela
          linhas={lista.data ?? []}
          chave={(f) => f.id}
          aoClicar={setEditando}
          vazio="Nenhum fornecedor cadastrado."
          colunas={[
            { titulo: 'Fornecedor', celula: (f) => <b>{f.nome}</b> },
            { titulo: 'Categoria', celula: (f) => f.categoria || '—' },
            { titulo: 'Contato', celula: (f) => [f.contato, formatarTelefone(f.telefone)].filter(Boolean).join(' · ') || '—' },
            { titulo: 'Prazo', celula: (f) => (f.prazo_dias != null ? `${f.prazo_dias} dias` : '—') },
            { titulo: '', celula: (f) => (!f.ativo ? <Selo>Inativo</Selo> : null) },
          ]}
        />
      )}
      {editando && <FormFornecedor fornecedor={editando === 'novo' ? null : editando} aoFechar={() => setEditando(null)} />}
    </>
  )
}

function FormFornecedor({ fornecedor, aoFechar }: { fornecedor: Fornecedor | null; aoFechar: () => void }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const categorias = useCategoriasCompras()
  const [f, setF] = useState({
    nome: fornecedor?.nome ?? '',
    categoria: fornecedor?.categoria ?? '',
    contato: fornecedor?.contato ?? '',
    telefone: fornecedor?.telefone ?? '',
    cnpj: fornecedor?.cnpj ?? '',
    prazo_dias: fornecedor?.prazo_dias != null ? String(fornecedor.prazo_dias) : '',
    forma_pagamento: fornecedor?.forma_pagamento ?? '',
    observacao: fornecedor?.observacao ?? '',
    ativo: fornecedor?.ativo ?? true,
  })
  const podeSalvar = fornecedor ? pode('compras', 'editar') || pode('contas', 'editar') : pode('compras', 'criar') || pode('contas', 'criar')
  const salvar = useMutation({
    mutationFn: async () => {
      const dados = {
        ...f,
        nome: f.nome.trim(),
        categoria: f.categoria || null,
        contato: f.contato.trim() || null,
        telefone: f.telefone.replace(/\D/g, '') || null,
        cnpj: f.cnpj.replace(/\D/g, '') || null,
        prazo_dias: f.prazo_dias ? Number(f.prazo_dias) : null,
        forma_pagamento: f.forma_pagamento || null,
        observacao: f.observacao.trim() || null,
      }
      const { error } = fornecedor ? await supabase.from('fornecedores').update(dados).eq('id', fornecedor.id) : await supabase.from('fornecedores').insert(dados)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] })
      aoFechar()
    },
  })
  const campo = (k: keyof typeof f) => ({ value: String(f[k]), disabled: !podeSalvar, onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={fornecedor ? fornecedor.nome : 'Novo fornecedor'}
      rodape={
        <>
          {fornecedor && <BotaoExcluir modulo="compras" tabela="fornecedores" id={fornecedor.id} descricao={`o fornecedor ${fornecedor.nome}`} aoExcluir={() => { qc.invalidateQueries({ queryKey: ['fornecedores'] }); aoFechar() }} />}
          <Botao variante="secundario" onClick={aoFechar}>Fechar</Botao>
          {podeSalvar && <Botao type="submit" form="form-fornecedor" carregando={salvar.isPending}>Salvar</Botao>}
        </>
      }
    >
      <form id="form-fornecedor" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); salvar.mutate() }}>
        <Campo rotulo="Nome" className="sm:col-span-2" {...campo('nome')} required autoFocus />
        <Selecao rotulo="Categoria" {...campo('categoria')} vazio="—" opcoes={categorias.map((c) => ({ valor: c, rotulo: c }))} />
        <Campo rotulo="CNPJ" {...campo('cnpj')} inputMode="numeric" />
        <Campo rotulo="Contato (nome)" {...campo('contato')} />
        <Campo rotulo="Telefone / WhatsApp" {...campo('telefone')} inputMode="tel" />
        <Campo rotulo="Prazo de pagamento (dias)" type="number" min={0} {...campo('prazo_dias')} ajuda="Usado para sugerir o vencimento do boleto." />
        <Selecao rotulo="Forma de pagamento" {...campo('forma_pagamento')} vazio="—" opcoes={FORMAS_CONTA} />
        {fornecedor && (
          <Selecao rotulo="Situação" value={f.ativo ? 'sim' : 'nao'} disabled={!podeSalvar} onChange={(e) => setF({ ...f, ativo: e.target.value === 'sim' })} opcoes={[{ valor: 'sim', rotulo: 'Ativo' }, { valor: 'nao', rotulo: 'Inativo' }]} />
        )}
        <AreaTexto rotulo="Observação" className="sm:col-span-2" {...campo('observacao')} />
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
