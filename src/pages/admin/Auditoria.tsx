import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { formatarDataHora } from '../../lib/formatos'
import { Botao, Carregando, Janela, Mensagem, Pagina, Selecao, Selo, Tabela, mensagemErro } from '../../components/ui'

type Registro = {
  id: number
  tabela: string
  registro_id: string | null
  acao: 'criou' | 'alterou' | 'apagou'
  dados_antigos: Record<string, unknown> | null
  dados_novos: Record<string, unknown> | null
  usuario_id: string | null
  em: string
}

/** Nomes amigáveis das tabelas (novas tabelas sem nome aqui aparecem com o nome técnico). */
export const NOMES_TABELAS: Record<string, string> = {
  perfis: 'Usuários',
  permissoes: 'Permissões',
  configuracoes: 'Configurações',
  rotina_tarefas: 'Tarefas da rotina',
}

const POR_PAGINA = 50

/** Campos que mudaram entre a versão antiga e a nova. */
export function camposAlterados(antigo: Record<string, unknown> | null, novo: Record<string, unknown> | null): string[] {
  if (!antigo || !novo) return []
  return Object.keys(novo).filter(
    (k) => !['atualizado_em'].includes(k) && JSON.stringify(antigo[k]) !== JSON.stringify(novo[k]),
  )
}

export default function Auditoria() {
  const [tabela, setTabela] = useState('')
  const [pagina, setPagina] = useState(0)
  const [aberto, setAberto] = useState<Registro | null>(null)

  const nomes = useQuery({
    queryKey: ['nomes-usuarios'],
    queryFn: async () => {
      const { data } = await supabase.from('perfis').select('id, nome, email')
      return new Map((data ?? []).map((p) => [p.id, p.nome || p.email]))
    },
  })

  const registros = useQuery({
    queryKey: ['auditoria', tabela, pagina],
    queryFn: async () => {
      let q = supabase.from('auditoria').select('*').order('em', { ascending: false })
      if (tabela) q = q.eq('tabela', tabela)
      const { data, error } = await q.range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1)
      if (error) throw error
      return data as Registro[]
    },
  })

  const quem = (id: string | null) => (id ? nomes.data?.get(id) ?? 'Usuário removido' : 'Sistema')

  return (
    <Pagina titulo="Histórico de alterações" descricao="Tudo o que foi criado, alterado ou apagado nas áreas sensíveis. Ninguém consegue editar este histórico.">
      <div className="mb-4 max-w-xs">
        <Selecao
          rotulo="Área"
          value={tabela}
          onChange={(e) => {
            setTabela(e.target.value)
            setPagina(0)
          }}
          vazio="Todas"
          opcoes={Object.entries(NOMES_TABELAS).map(([valor, rotulo]) => ({ valor, rotulo }))}
        />
      </div>
      {registros.isLoading ? (
        <Carregando />
      ) : registros.error ? (
        <Mensagem tipo="erro">{mensagemErro(registros.error)}</Mensagem>
      ) : (
        <>
          <Tabela
            linhas={registros.data ?? []}
            chave={(r) => r.id}
            aoClicar={setAberto}
            vazio="Nenhuma alteração registrada."
            colunas={[
              { titulo: 'Quando', celula: (r) => formatarDataHora(r.em) },
              { titulo: 'Quem', celula: (r) => quem(r.usuario_id) },
              {
                titulo: 'O quê',
                celula: (r) => (
                  <Selo cor={r.acao === 'criou' ? 'verde' : r.acao === 'apagou' ? 'vermelho' : 'azul'}>{r.acao}</Selo>
                ),
              },
              { titulo: 'Área', celula: (r) => NOMES_TABELAS[r.tabela] ?? r.tabela },
              {
                titulo: 'Detalhe',
                celula: (r) =>
                  r.acao === 'alterou' ? camposAlterados(r.dados_antigos, r.dados_novos).join(', ') || '—' : '—',
              },
            ]}
          />
          <div className="mt-4 flex justify-between">
            <Botao variante="secundario" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Mais recentes</Botao>
            <Botao variante="secundario" disabled={(registros.data?.length ?? 0) < POR_PAGINA} onClick={() => setPagina((p) => p + 1)}>
              Mais antigos
            </Botao>
          </div>
        </>
      )}
      {aberto && (
        <Janela aberta aoFechar={() => setAberto(null)} titulo="Detalhe da alteração" largura="max-w-3xl">
          <p className="mb-3 text-sm text-slate-600">
            {quem(aberto.usuario_id)} {aberto.acao} em {NOMES_TABELAS[aberto.tabela] ?? aberto.tabela} — {formatarDataHora(aberto.em)}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {(['dados_antigos', 'dados_novos'] as const).map((k) => (
              <div key={k}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-acqua-petroleo">
                  {k === 'dados_antigos' ? 'Antes' : 'Depois'}
                </p>
                <pre className="max-h-80 overflow-auto rounded-lg bg-acqua-gelo p-3 text-xs text-acqua-titulo">
                  {aberto[k] ? JSON.stringify(aberto[k], null, 2) : '—'}
                </pre>
              </div>
            ))}
          </div>
        </Janela>
      )}
    </Pagina>
  )
}
