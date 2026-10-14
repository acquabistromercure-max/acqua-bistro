import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Download, Plus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarData, formatarMoeda, normalizar } from '../../lib/formatos'
import { formatarTelefone } from '../../lib/documentos-br'
import { baixarCSV } from '../../lib/exportar'
import { Abas, Botao, Campo, Carregando, Mensagem, Pagina, Selecao, Selo, Tabela, mensagemErro } from '../../components/ui'
import { SITUACOES, VINCULOS, rotulo, type Colaborador } from './tipos'
import Diarias from './Diarias'

export default function Lista() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const aba = params.get('aba') === 'diarias' ? 'diarias' : 'equipe'
  const { pode } = usePermissoes()
  const [busca, setBusca] = useState('')
  const [vinculo, setVinculo] = useState('')
  const [situacao, setSituacao] = useState('ativos')

  const lista = useQuery({
    queryKey: ['colaboradores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('colaboradores').select('*').order('nome')
      if (error) throw error
      return data as Colaborador[]
    },
  })

  const filtrados = useMemo(() => {
    const termo = normalizar(busca)
    return (lista.data ?? []).filter(
      (c) =>
        (!termo || normalizar(`${c.nome} ${c.apelido ?? ''} ${c.funcao ?? ''}`).includes(termo)) &&
        (!vinculo || c.vinculo === vinculo) &&
        (situacao === 'todos' || (situacao === 'ativos' ? c.situacao !== 'desligado' : c.situacao === situacao)),
    )
  }, [lista.data, busca, vinculo, situacao])

  const exportar = () =>
    baixarCSV('colaboradores', filtrados, [
      { titulo: 'Nome', valor: (c) => c.nome },
      { titulo: 'Função', valor: (c) => c.funcao },
      { titulo: 'Vínculo', valor: (c) => rotulo(VINCULOS, c.vinculo) },
      { titulo: 'Situação', valor: (c) => rotulo(SITUACOES, c.situacao) },
      { titulo: 'Admissão', valor: (c) => formatarData(c.data_admissao) },
      { titulo: 'Telefone', valor: (c) => formatarTelefone(c.telefone) },
      { titulo: 'E-mail', valor: (c) => c.email },
    ])

  return (
    <Pagina
      titulo="Colaboradores e diaristas"
      descricao="Fichas da equipe, ocorrências, financeiro e diárias."
      acoes={
        aba === 'equipe' && (
          <>
            {pode('colaboradores', 'exportar') && (
              <Botao variante="secundario" icone={<Download className="h-4 w-4" />} onClick={exportar} disabled={!filtrados.length}>
                Exportar
              </Botao>
            )}
            {pode('colaboradores', 'criar') && (
              <Botao icone={<Plus className="h-4 w-4" />} onClick={() => navigate('/colaboradores/novo')}>
                Novo colaborador
              </Botao>
            )}
          </>
        )
      }
    >
      <Abas
        abas={[
          { valor: 'equipe', rotulo: 'Equipe' },
          { valor: 'diarias', rotulo: 'Diárias' },
        ]}
        ativa={aba}
        aoMudar={(v) => setParams(v === 'equipe' ? {} : { aba: v })}
      />
      {aba === 'diarias' ? (
        <Diarias />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr,200px,180px]">
            <div className="relative">
              <Campo rotulo="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, apelido ou função" />
              <Search className="pointer-events-none absolute right-3 top-[34px] h-4 w-4 text-slate-400" />
            </div>
            <Selecao rotulo="Vínculo" value={vinculo} onChange={(e) => setVinculo(e.target.value)} vazio="Todos" opcoes={VINCULOS} />
            <Selecao
              rotulo="Situação"
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              opcoes={[{ valor: 'ativos', rotulo: 'Ativos e afastados' }, ...SITUACOES, { valor: 'todos', rotulo: 'Todos' }]}
            />
          </div>
          {lista.isLoading ? (
            <Carregando />
          ) : lista.error ? (
            <Mensagem tipo="erro">{mensagemErro(lista.error)}</Mensagem>
          ) : (
            <Tabela
              linhas={filtrados}
              chave={(c) => c.id}
              aoClicar={(c) => navigate(`/colaboradores/${c.id}`)}
              vazio={lista.data?.length ? 'Ninguém encontrado com esses filtros.' : 'Nenhum colaborador cadastrado ainda.'}
              colunas={[
                {
                  titulo: 'Nome',
                  celula: (c) => (
                    <span>
                      <span className="font-semibold">{c.nome}</span>
                      {c.apelido && <span className="text-slate-500"> ({c.apelido})</span>}
                    </span>
                  ),
                },
                { titulo: 'Função', celula: (c) => c.funcao || '—' },
                { titulo: 'Vínculo', celula: (c) => rotulo(VINCULOS, c.vinculo) },
                {
                  titulo: 'Remuneração',
                  celula: (c) => (c.remuneracao == null ? '—' : `${formatarMoeda(c.remuneracao)}${c.tipo_remuneracao === 'mensal' ? '' : ` /${c.tipo_remuneracao}`}`),
                },
                {
                  titulo: 'Situação',
                  celula: (c) => (
                    <Selo cor={c.situacao === 'ativo' ? 'verde' : c.situacao === 'afastado' ? 'amarelo' : 'cinza'}>
                      {rotulo(SITUACOES, c.situacao)}
                    </Selo>
                  ),
                },
              ]}
            />
          )}
        </>
      )}
    </Pagina>
  )
}
