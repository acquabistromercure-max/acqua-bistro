import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { lerMoeda } from '../../lib/formatos'
import { cpfValido, formatarCPF, soDigitos } from '../../lib/documentos-br'
import { AreaTexto, Botao, Campo, Cartao, Carregando, Mensagem, Pagina, Selecao, mensagemErro } from '../../components/ui'
import { SITUACOES, TIPOS_REMUNERACAO, VINCULOS, type Colaborador } from './tipos'
import { useTurnos } from '../../lib/hooks'
import { turnoPelaEntrada, useHorariosTurnos } from '../escalas/dados'
import { usePermissoes } from '../../lib/permissoes'
import { Lock } from 'lucide-react'
import { BANCARIOS_VAZIO, CamposBancarios, linhaBancaria, paraBancarios, temDadosBancarios, useDadosBancarios, type DadosBancarios } from './AbaBancarios'

type Form = Record<string, string>

const VAZIO: Form = {
  nome: '', apelido: '', cpf: '', rg: '', data_nascimento: '', telefone: '', email: '', endereco: '',
  contato_emergencia_nome: '', contato_emergencia_telefone: '', funcao: '', vinculo: 'clt', situacao: 'ativo',
  data_admissao: '', data_desligamento: '', motivo_desligamento: '', jornada_descricao: '', jornada_semanal_horas: '',
  tipo_remuneracao: 'mensal', remuneracao: '', observacoes: '',
  horario_entrada: '', horario_saida: '', intervalo_minutos: '60', turno: '', regime: 'semanal', escala_referencia: '',
}

const DIAS = [
  { n: 1, rotulo: 'Seg' }, { n: 2, rotulo: 'Ter' }, { n: 3, rotulo: 'Qua' }, { n: 4, rotulo: 'Qui' },
  { n: 5, rotulo: 'Sex' }, { n: 6, rotulo: 'Sáb' }, { n: 7, rotulo: 'Dom' },
]

function paraForm(c: Colaborador): Form {
  const f: Form = { ...VAZIO }
  for (const k of Object.keys(VAZIO)) {
    const v = (c as unknown as Record<string, unknown>)[k]
    f[k] = v === null || v === undefined ? '' : k === 'remuneracao' ? String(v).replace('.', ',') : String(v)
  }
  f.cpf = formatarCPF(c.cpf)
  f.horario_entrada = f.horario_entrada.slice(0, 5)
  f.horario_saida = f.horario_saida.slice(0, 5)
  return f
}

/** Validação antes de enviar. Retorna erros por campo. */
export function validarColaborador(f: Form): Record<string, string> {
  const erros: Record<string, string> = {}
  if (f.nome.trim().length < 2) erros.nome = 'Informe o nome completo.'
  if (f.cpf && !cpfValido(f.cpf)) erros.cpf = 'CPF inválido.'
  if (f.remuneracao && lerMoeda(f.remuneracao) === null) erros.remuneracao = 'Valor inválido.'
  if (f.situacao === 'desligado' && !f.data_desligamento) erros.data_desligamento = 'Informe a data do desligamento.'
  if (f.data_desligamento && f.data_admissao && f.data_desligamento < f.data_admissao)
    erros.data_desligamento = 'Desligamento antes da admissão.'
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) erros.email = 'E-mail inválido.'
  if (f.regime === '12x36' && !f.escala_referencia) erros.escala_referencia = 'Informe um dia em que a pessoa trabalha.'
  return erros
}

export default function FormColaborador() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const ehDiarista = !id && params.get('vinculo') === 'diarista'
  const [f, setF] = useState<Form>(ehDiarista ? { ...VAZIO, vinculo: 'diarista', tipo_remuneracao: 'diaria' } : VAZIO)
  const [folgas, setFolgas] = useState<number[]>([])
  const [erros, setErros] = useState<Record<string, string>>({})
  const turnos = useTurnos()
  const horarios = useHorariosTurnos()
  // Escolher o turno já sugere o horário dele (configurado em Escalas), que pode ser ajustado.
  const escolherTurno = (t: string) => {
    const h = horarios[t]
    setF((x) => ({
      ...x,
      turno: t,
      ...(h ? { horario_entrada: h.inicio, horario_saida: h.fim, intervalo_minutos: String(h.intervalo) } : {}),
    }))
  }
  const proximosPlantoes = (() => {
    if (f.regime !== '12x36' || !f.escala_referencia) return ''
    const base = new Date(`${f.escala_referencia}T12:00:00Z`)
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(base)
      d.setUTCDate(d.getUTCDate() + i * 2)
      return d.toISOString().slice(8, 10) + '/' + d.toISOString().slice(5, 7)
    }).join(', ')
  })()

  const atual = useQuery({
    queryKey: ['colaborador', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('colaboradores').select('*').eq('id', id!).single()
      if (error) throw error
      return data as Colaborador
    },
  })

  useEffect(() => {
    if (atual.data) {
      setF(paraForm(atual.data))
      setFolgas(atual.data.dias_folga ?? [])
    }
  }, [atual.data])

  const campo = (k: string) => ({
    value: f[k],
    onChange: (e: { target: { value: string } }) =>
      setF((x) => {
        const novo = { ...x, [k]: e.target.value }
        // A hora de entrada define o turno: antes das 12h manhã, a partir das 12h tarde, a partir das 20h noite.
        if (k === 'horario_entrada' && e.target.value) {
          const t = turnoPelaEntrada(e.target.value)
          if (turnos.includes(t)) novo.turno = t
        }
        return novo
      }),
    erro: erros[k],
  })

  const { pode } = usePermissoes()
  const podeBanco = pode('dados_bancarios', 'editar')
  const [banco, setBanco] = useState<DadosBancarios>(BANCARIOS_VAZIO)
  const bancarios = useDadosBancarios(id, pode('dados_bancarios'))
  useEffect(() => {
    if (bancarios.data) setBanco(paraBancarios(bancarios.data))
  }, [bancarios.data])

  const salvar = useMutation({
    mutationFn: async () => {
      const dados: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(f)) dados[k] = v.trim() === '' ? null : v.trim()
      dados.cpf = f.cpf ? soDigitos(f.cpf) : null
      dados.remuneracao = f.remuneracao ? lerMoeda(f.remuneracao) : null
      dados.jornada_semanal_horas = f.jornada_semanal_horas ? Number(f.jornada_semanal_horas.replace(',', '.')) : null
      dados.intervalo_minutos = Number(f.intervalo_minutos) || 0
      dados.dias_folga = f.regime === '12x36' ? [] : folgas
      dados.regime = f.regime || 'semanal'
      if (f.regime !== '12x36') dados.escala_referencia = null
      if (f.situacao !== 'desligado') {
        dados.data_desligamento = null
        dados.motivo_desligamento = null
      }
      const { data, error } = id
        ? await supabase.from('colaboradores').update(dados).eq('id', id).select('id').single()
        : await supabase.from('colaboradores').insert(dados).select('id').single()
      if (error) throw error
      const novoId = data.id as string
      // Dados bancários vão junto (tabela protegida, só para quem tem a permissão).
      let bancoFalhou = false
      if (podeBanco && (temDadosBancarios(banco) || bancarios.data)) {
        const { error: e2 } = await supabase.from('colaboradores_bancarios').upsert(linhaBancaria(novoId, banco))
        bancoFalhou = !!e2
      }
      return { novoId, bancoFalhou }
    },
    onSuccess: ({ novoId, bancoFalhou }) => {
      qc.invalidateQueries({ queryKey: ['colaboradores'] })
      qc.invalidateQueries({ queryKey: ['colaborador', novoId] })
      qc.invalidateQueries({ queryKey: ['bancarios', novoId] })
      // Se o banco não salvou, abre a aba de dados bancários para tentar de novo (o cadastro já está salvo).
      navigate(bancoFalhou ? `/colaboradores/${novoId}?aba=bancarios` : `/colaboradores/${novoId}`, { replace: true })
    },
  })

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const v = validarColaborador(f)
    setErros(v)
    if (Object.keys(v).length === 0) salvar.mutate()
  }

  if (id && atual.isLoading) return <Carregando />

  return (
    <Pagina
      titulo={id ? 'Editar colaborador' : ehDiarista ? 'Novo diarista' : 'Novo colaborador'}
      descricao={ehDiarista ? 'Cadastro completo, sem contrato fixo: o pagamento é por diária convocada.' : undefined}
    >
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Cartao titulo="Identificação">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Campo rotulo="Nome completo" required {...campo('nome')} className="sm:col-span-2" />
            <Campo rotulo="Apelido" {...campo('apelido')} />
            <Campo rotulo="CPF" inputMode="numeric" placeholder="000.000.000-00" {...campo('cpf')} />
            <Campo rotulo="RG" {...campo('rg')} />
            <Campo rotulo="Data de nascimento" type="date" {...campo('data_nascimento')} />
          </div>
        </Cartao>
        <Cartao titulo="Contato">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Campo rotulo="Telefone" type="tel" inputMode="tel" {...campo('telefone')} />
            <Campo rotulo="E-mail" type="email" {...campo('email')} />
            <Campo rotulo="Endereço" {...campo('endereco')} className="sm:col-span-2 lg:col-span-1" />
            <Campo rotulo="Contato de emergência (nome)" {...campo('contato_emergencia_nome')} />
            <Campo rotulo="Contato de emergência (telefone)" type="tel" {...campo('contato_emergencia_telefone')} />
          </div>
        </Cartao>
        <Cartao titulo="Contrato e jornada">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Campo rotulo="Função" {...campo('funcao')} placeholder="Ex.: Garçom, Cozinheira" />
            <Selecao rotulo="Vínculo" opcoes={VINCULOS} {...campo('vinculo')} />
            <Selecao rotulo="Situação" opcoes={SITUACOES} {...campo('situacao')} />
            <Campo rotulo="Data de admissão" type="date" {...campo('data_admissao')} />
            {f.situacao === 'desligado' && (
              <>
                <Campo rotulo="Data de desligamento" type="date" required {...campo('data_desligamento')} />
                <Campo rotulo="Motivo do desligamento" {...campo('motivo_desligamento')} />
              </>
            )}
            <Selecao rotulo="Tipo de remuneração" opcoes={TIPOS_REMUNERACAO} {...campo('tipo_remuneracao')} />
            <Campo rotulo="Valor (R$)" inputMode="decimal" placeholder="0,00" {...campo('remuneracao')} />
            <Campo rotulo="Horas por semana" inputMode="decimal" {...campo('jornada_semanal_horas')} />
            <Campo rotulo="Jornada (descrição)" placeholder="Ex.: 6x1, 8h às 16h" {...campo('jornada_descricao')} className="sm:col-span-2 lg:col-span-3" />
          </div>
          {f.situacao === 'desligado' && (
            <p className="mt-3 text-xs text-slate-500">
              Desligados continuam no sistema como inativos, para preservar o histórico.
            </p>
          )}
        </Cartao>
        <Cartao titulo="Horário de trabalho">
          <p className="mb-3 text-xs text-slate-500">
            Usado para sugerir a escala (botão “Preencher pelo horário fixo”) e como jornada prevista na folha-ponto quando o dia não tem escala.
          </p>
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <Selecao
              rotulo="Turno"
              value={f.turno}
              onChange={(e) => escolherTurno(e.target.value)}
              vazio="—"
              opcoes={turnos.map((t) => ({ valor: t, rotulo: t }))}
              ajuda="Preenche o horário sugerido do turno."
            />
            <Selecao
              rotulo="Regime de folgas"
              {...campo('regime')}
              opcoes={[
                { valor: 'semanal', rotulo: 'Folgas fixas na semana (6x1, 5x2...)' },
                { valor: '12x36', rotulo: '12x36 — dia sim, dia não' },
              ]}
            />
            {f.regime === '12x36' && (
              <Campo
                rotulo="Um dia em que trabalha"
                type="date"
                required
                {...campo('escala_referencia')}
                ajuda={proximosPlantoes ? `Plantões: ${proximosPlantoes}...` : 'A partir dele, alterna trabalho e folga.'}
              />
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Entrada" type="time" {...campo('horario_entrada')} />
            <Campo rotulo="Saída" type="time" {...campo('horario_saida')} ajuda="Pode passar da meia-noite." />
            <Campo rotulo="Intervalo (minutos)" type="number" min={0} max={600} {...campo('intervalo_minutos')} />
          </div>
          {f.regime !== '12x36' && <div className="mt-3">
            <p className="mb-1 text-sm font-semibold text-acqua-titulo">Folgas fixas</p>
            <div className="flex flex-wrap gap-1.5">
              {DIAS.map((d) => {
                const marcado = folgas.includes(d.n)
                return (
                  <button
                    key={d.n}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() => setFolgas(marcado ? folgas.filter((x) => x !== d.n) : [...folgas, d.n].sort())}
                    className={
                      marcado
                        ? 'rounded-lg border border-acqua-petroleo bg-acqua-titulo px-3 py-1.5 text-sm font-semibold text-white'
                        : 'rounded-lg border border-[#C4D3E8] bg-white px-3 py-1.5 text-sm font-semibold text-acqua-titulo hover:bg-acqua-suave'
                    }
                  >
                    {d.rotulo}
                  </button>
                )
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">Para escalas que mudam toda semana, deixe sem folga fixa e monte na tela de Escalas.</p>
          </div>}
        </Cartao>
        {pode('dados_bancarios') && (
          <Cartao titulo={<span className="flex items-center gap-2"><Lock className="h-4 w-4 text-acqua-dourado" /> Dados bancários</span>}>
            <p className="mb-3 text-xs text-slate-500">Para pagar salário, vales e diárias. Visíveis só para quem tem a permissão “Dados bancários”.</p>
            <CamposBancarios valores={banco} desabilitado={!podeBanco} aoMudar={(k, v) => setBanco((x) => ({ ...x, [k]: v }))} />
          </Cartao>
        )}
        <Cartao titulo="Observações">
          <AreaTexto rotulo="Observações" {...campo('observacoes')} />
        </Cartao>
        {Object.keys(erros).length > 0 && <Mensagem tipo="erro">Confira os campos destacados.</Mensagem>}
        {salvar.error && <Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem>}
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => navigate(-1)}>Cancelar</Botao>
          <Botao type="submit" carregando={salvar.isPending}>Salvar</Botao>
        </div>
      </form>
    </Pagina>
  )
}
