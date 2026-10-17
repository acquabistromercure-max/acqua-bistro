import type { ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { formatarData, formatarMoeda } from '../../lib/formatos'
import { formatarCPF, formatarTelefone } from '../../lib/documentos-br'
import { Abas, Botao, Cartao, Carregando, Mensagem, Pagina, Selo, mensagemErro } from '../../components/ui'
import { SITUACOES, TIPOS_REMUNERACAO, VINCULOS, rotulo, type Colaborador } from './tipos'
import AbaBancarios from './AbaBancarios'
import AbaOcorrencias from './AbaOcorrencias'
import AbaFinanceiro from './AbaFinanceiro'
import AbaDiarias from './AbaDiarias'
import AbaLinhaDoTempo from './AbaLinhaDoTempo'
import { ABAS_EXTRAS } from './abasExtras'
import ExcluirColaborador from './ExcluirColaborador'

function Info({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="text-sm text-acqua-titulo">{children || '—'}</dd>
    </div>
  )
}

export default function Ficha() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pode } = usePermissoes()
  const [params, setParams] = useSearchParams()
  const aba = params.get('aba') ?? 'dados'

  const c = useQuery({
    queryKey: ['colaborador', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('colaboradores').select('*').eq('id', id!).single()
      if (error) throw error
      return data as Colaborador
    },
  })

  if (c.isLoading) return <Carregando />
  if (c.error || !c.data) return <Pagina titulo="Colaborador"><Mensagem tipo="erro">{mensagemErro(c.error)}</Mensagem></Pagina>
  const col = c.data

  const abas = [
    { valor: 'dados', rotulo: 'Dados' },
    ...(pode('dados_bancarios') ? [{ valor: 'bancarios', rotulo: 'Bancários' }] : []),
    ...ABAS_EXTRAS.filter((a) => pode(a.modulo)).map((a) => ({ valor: a.valor, rotulo: a.rotulo })),
    ...(pode('ocorrencias') ? [{ valor: 'ocorrencias', rotulo: 'Ocorrências' }] : []),
    ...(pode('financeiro') ? [{ valor: 'financeiro', rotulo: 'Financeiro' }] : []),
    { valor: 'diarias', rotulo: 'Diárias' },
    { valor: 'linha', rotulo: 'Linha do tempo' },
  ]
  const extra = ABAS_EXTRAS.find((a) => a.valor === aba)

  return (
    <Pagina
      titulo={col.nome}
      descricao={[col.funcao, rotulo(VINCULOS, col.vinculo)].filter(Boolean).join(' · ')}
      acoes={
        <>
          <Botao variante="secundario" icone={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/colaboradores')}>
            Voltar
          </Botao>
          <ExcluirColaborador colaborador={col} />
          {pode('colaboradores', 'editar') && (
            <Botao icone={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/colaboradores/${col.id}/editar`)}>
              Editar
            </Botao>
          )}
        </>
      }
    >
      <div className="mb-4">
        <Selo cor={col.situacao === 'ativo' ? 'verde' : col.situacao === 'afastado' ? 'amarelo' : 'cinza'}>
          {rotulo(SITUACOES, col.situacao)}
        </Selo>
      </div>
      <Abas abas={abas} ativa={aba} aoMudar={(v) => setParams(v === 'dados' ? {} : { aba: v }, { replace: true })} />

      {aba === 'dados' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Cartao titulo="Identificação e contato">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Info rotulo="Nome">{col.nome}</Info>
              <Info rotulo="Apelido">{col.apelido}</Info>
              <Info rotulo="CPF">{formatarCPF(col.cpf)}</Info>
              <Info rotulo="RG">{col.rg}</Info>
              <Info rotulo="Nascimento">{formatarData(col.data_nascimento)}</Info>
              <Info rotulo="Telefone">{formatarTelefone(col.telefone)}</Info>
              <Info rotulo="E-mail">{col.email}</Info>
              <Info rotulo="Endereço">{col.endereco}</Info>
              <Info rotulo="Emergência">
                {[col.contato_emergencia_nome, formatarTelefone(col.contato_emergencia_telefone)].filter(Boolean).join(' · ')}
              </Info>
            </dl>
          </Cartao>
          <Cartao titulo="Contrato e jornada">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Info rotulo="Função">{col.funcao}</Info>
              <Info rotulo="Vínculo">{rotulo(VINCULOS, col.vinculo)}</Info>
              <Info rotulo="Admissão">{formatarData(col.data_admissao)}</Info>
              {col.situacao === 'desligado' && (
                <>
                  <Info rotulo="Desligamento">{formatarData(col.data_desligamento)}</Info>
                  <Info rotulo="Motivo">{col.motivo_desligamento}</Info>
                </>
              )}
              <Info rotulo="Remuneração">
                {col.remuneracao != null && `${formatarMoeda(col.remuneracao)} (${rotulo(TIPOS_REMUNERACAO, col.tipo_remuneracao)})`}
              </Info>
              <Info rotulo="Turno">{col.turno}</Info>
              <Info rotulo="Horário de trabalho">
                {col.horario_entrada &&
                  `${col.horario_entrada.slice(0, 5)}–${col.horario_saida?.slice(0, 5) ?? ''}${col.intervalo_minutos ? ` · intervalo ${col.intervalo_minutos} min` : ''}`}
              </Info>
              <Info rotulo="Folgas">
                {col.regime === '12x36'
                  ? `12x36 (dia sim, dia não)${col.escala_referencia ? ` · trabalha em ${formatarData(col.escala_referencia)}` : ''}`
                  : (col.dias_folga ?? []).map((d) => ['', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'][d]).join(', ')}
              </Info>
              <Info rotulo="Horas por semana">{col.jornada_semanal_horas}</Info>
              <Info rotulo="Jornada">{col.jornada_descricao}</Info>
            </dl>
            {col.observacoes && <p className="mt-4 whitespace-pre-line rounded-lg bg-acqua-gelo p-3 text-sm">{col.observacoes}</p>}
          </Cartao>
        </div>
      )}
      {aba === 'bancarios' && <AbaBancarios colaborador={col} />}
      {aba === 'ocorrencias' && <AbaOcorrencias colaborador={col} />}
      {aba === 'financeiro' && <AbaFinanceiro colaborador={col} />}
      {aba === 'diarias' && <AbaDiarias colaborador={col} />}
      {aba === 'linha' && <AbaLinhaDoTempo colaborador={col} />}
      {extra && <extra.Componente colaborador={col} />}
    </Pagina>
  )
}
