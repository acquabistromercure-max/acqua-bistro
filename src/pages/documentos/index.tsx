import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useConfiguracao } from '../../lib/hooks'
import { TEXTOS_PADRAO, TIPOS_DOCUMENTO } from '../../lib/documentos'
import { Abas, AreaTexto, Botao, Campo, Cartao, Carregando, Mensagem, Pagina, Selecao, cx, mensagemErro } from '../../components/ui'
import { usePessoasEscala } from '../escalas/dados'
import EmitirDocumento from './EmitirDocumento'
import ListaDocumentos from './ListaDocumentos'
import { useDocumentos, useEmpresa, type Empresa } from './dados'
import type { Colaborador } from '../colaboradores/tipos'

type Aba = 'emitidos' | 'modelos'

export default function Documentos() {
  const { pode } = usePermissoes()
  const [params, setParams] = useSearchParams()
  const aba: Aba = params.get('aba') === 'modelos' ? 'modelos' : 'emitidos'
  return (
    <Pagina titulo="Documentos" descricao="Recibos, ocorrências, advertências, termo de domingo, folha-ponto e recibos de diária — para imprimir e assinar.">
      <Abas
        abas={[{ valor: 'emitidos', rotulo: 'Emitidos' }, ...(pode('documentos', 'editar') ? [{ valor: 'modelos' as const, rotulo: 'Modelos e empresa' }] : [])]}
        ativa={aba}
        aoMudar={(v) => setParams(v === 'emitidos' ? {} : { aba: v }, { replace: true })}
      />
      {aba === 'emitidos' ? <Emitidos /> : <Modelos />}
    </Pagina>
  )
}

function Emitidos() {
  const { pode } = usePermissoes()
  const [params, setParams] = useSearchParams()
  const docs = useDocumentos()
  const pessoas = usePessoasEscala()
  const [filtro, setFiltro] = useState<'pendentes' | 'todos' | 'assinados'>('pendentes')
  const [pessoaId, setPessoaId] = useState('')
  const [emitindo, setEmitindo] = useState(false)
  useEffect(() => {
    if (params.get('novo')) setEmitindo(true)
  }, [params])
  const nomeColaborador = (id: string | null) => pessoas.data?.find((p) => p.id === id)?.nome ?? '—'
  const lista = (docs.data ?? []).filter(
    (d) => (filtro === 'todos' ? true : filtro === 'assinados' ? d.situacao === 'assinado' : ['emitido', 'enviado'].includes(d.situacao)) && (!pessoaId || d.colaborador_id === pessoaId),
  )
  const colaborador = pessoas.data?.find((p) => p.id === pessoaId)
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="flex gap-1.5">
          {(['pendentes', 'assinados', 'todos'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={cx('rounded-full border px-3 py-1 text-xs font-semibold', filtro === f ? 'border-acqua-petroleo bg-acqua-titulo text-white' : 'border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave')}
            >
              {f === 'pendentes' ? 'Aguardando assinatura' : f === 'assinados' ? 'Assinados' : 'Todos'}
            </button>
          ))}
        </div>
        <Selecao rotulo="Colaborador" className="w-64" value={pessoaId} onChange={(e) => setPessoaId(e.target.value)} vazio="Todos" opcoes={(pessoas.data ?? []).map((p) => ({ valor: p.id, rotulo: p.nome }))} />
        {pode('documentos', 'criar') && (
          <Botao className="ml-auto" onClick={() => setEmitindo(true)} disabled={!pessoaId} title={!pessoaId ? 'Escolha o colaborador' : undefined}>
            Gerar documento
          </Botao>
        )}
      </div>
      {docs.isLoading ? <Carregando /> : <ListaDocumentos lista={lista} nomeColaborador={nomeColaborador} />}
      {emitindo && colaborador && (
        <EmitirDocumento
          colaborador={{ ...colaborador, cpf: null, data_admissao: null } as unknown as Colaborador}
          aoFechar={() => {
            setEmitindo(false)
            if (params.get('novo')) setParams({}, { replace: true })
          }}
        />
      )}
      {emitindo && !colaborador && <div className="mt-3"><Mensagem tipo="info">Escolha o colaborador acima (ou gere pela ficha dele, com CPF e dados completos).</Mensagem></div>}
    </>
  )
}

function Modelos() {
  const qc = useQueryClient()
  const { perfil } = usePermissoes()
  const ehAdmin = perfil?.papel === 'administrador'
  const empresaAtual = useEmpresa()
  const personalizados = useConfiguracao<Record<string, string>>('documentos_modelos', {})
  const [empresa, setEmpresa] = useState<Empresa>(empresaAtual)
  const [textos, setTextos] = useState<Record<string, string>>({})
  const assinatura = JSON.stringify([empresaAtual, personalizados])
  useEffect(() => {
    setEmpresa(empresaAtual)
    setTextos(Object.fromEntries(Object.entries(TEXTOS_PADRAO).map(([k, v]) => [k, personalizados[k] || v])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura])

  const salvar = useMutation({
    mutationFn: async () => {
      const mudados = Object.fromEntries(Object.entries(textos).filter(([k, v]) => v.trim() && v.trim() !== TEXTOS_PADRAO[k as keyof typeof TEXTOS_PADRAO]))
      for (const [chave, valor] of [['empresa_dados', empresa], ['documentos_modelos', mudados]] as const) {
        const { error } = await supabase.from('configuracoes').update({ valor }).eq('chave', chave)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config'] }),
  })

  return (
    <div className="grid max-w-4xl gap-4">
      {!ehAdmin && <Mensagem tipo="info">Só o administrador altera os modelos e os dados da empresa.</Mensagem>}
      <Cartao titulo="Dados da empresa (aparecem nos documentos)">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Razão social" value={empresa.razao_social} disabled={!ehAdmin} onChange={(e) => setEmpresa({ ...empresa, razao_social: e.target.value })} />
          <Campo rotulo="Nome fantasia" value={empresa.nome_fantasia} disabled={!ehAdmin} onChange={(e) => setEmpresa({ ...empresa, nome_fantasia: e.target.value })} />
          <Campo rotulo="CNPJ" value={empresa.cnpj} disabled={!ehAdmin} onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })} />
          <Campo rotulo="Cidade/UF" value={empresa.cidade} disabled={!ehAdmin} onChange={(e) => setEmpresa({ ...empresa, cidade: e.target.value })} />
          <Campo rotulo="Endereço" className="sm:col-span-2" value={empresa.endereco} disabled={!ehAdmin} onChange={(e) => setEmpresa({ ...empresa, endereco: e.target.value })} />
        </div>
      </Cartao>
      <Cartao titulo="Textos dos modelos">
        <p className="mb-3 text-xs text-slate-500">
          Marcadores: {'{nome} {cpf} {funcao} {valor} {valor_extenso} {data} {mes} {descricao} {tipo} {empresa} {cnpj} {cidade}'}. Os textos trabalhistas devem
          ser conferidos pelo RH/contabilidade/jurídico antes do uso oficial.
        </p>
        <div className="space-y-3">
          {TIPOS_DOCUMENTO.filter((t) => t.valor !== 'folha_ponto').map((t) => (
            <AreaTexto key={t.valor} rotulo={t.rotulo} rows={4} value={textos[t.valor] ?? ''} disabled={!ehAdmin} onChange={(e) => setTextos({ ...textos, [t.valor]: e.target.value })} />
          ))}
        </div>
      </Cartao>
      {ehAdmin && (
        <div className="flex items-center gap-3">
          <Botao carregando={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Botao>
          {salvar.isSuccess && <span className="text-sm text-emerald-700">Salvo.</span>}
        </div>
      )}
      {salvar.error && <Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem>}
    </div>
  )
}
