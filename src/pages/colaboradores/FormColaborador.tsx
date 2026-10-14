import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { lerMoeda } from '../../lib/formatos'
import { cpfValido, formatarCPF, soDigitos } from '../../lib/documentos-br'
import { AreaTexto, Botao, Campo, Cartao, Carregando, Mensagem, Pagina, Selecao, mensagemErro } from '../../components/ui'
import { SITUACOES, TIPOS_REMUNERACAO, VINCULOS, type Colaborador } from './tipos'

type Form = Record<string, string>

const VAZIO: Form = {
  nome: '', apelido: '', cpf: '', rg: '', data_nascimento: '', telefone: '', email: '', endereco: '',
  contato_emergencia_nome: '', contato_emergencia_telefone: '', funcao: '', vinculo: 'clt', situacao: 'ativo',
  data_admissao: '', data_desligamento: '', motivo_desligamento: '', jornada_descricao: '', jornada_semanal_horas: '',
  tipo_remuneracao: 'mensal', remuneracao: '', observacoes: '',
}

function paraForm(c: Colaborador): Form {
  const f: Form = { ...VAZIO }
  for (const k of Object.keys(VAZIO)) {
    const v = (c as unknown as Record<string, unknown>)[k]
    f[k] = v === null || v === undefined ? '' : k === 'remuneracao' ? String(v).replace('.', ',') : String(v)
  }
  f.cpf = formatarCPF(c.cpf)
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
  return erros
}

export default function FormColaborador() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [f, setF] = useState<Form>(VAZIO)
  const [erros, setErros] = useState<Record<string, string>>({})

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
    if (atual.data) setF(paraForm(atual.data))
  }, [atual.data])

  const campo = (k: string) => ({
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value })),
    erro: erros[k],
  })

  const salvar = useMutation({
    mutationFn: async () => {
      const dados: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(f)) dados[k] = v.trim() === '' ? null : v.trim()
      dados.cpf = f.cpf ? soDigitos(f.cpf) : null
      dados.remuneracao = f.remuneracao ? lerMoeda(f.remuneracao) : null
      dados.jornada_semanal_horas = f.jornada_semanal_horas ? Number(f.jornada_semanal_horas.replace(',', '.')) : null
      if (f.situacao !== 'desligado') {
        dados.data_desligamento = null
        dados.motivo_desligamento = null
      }
      const { data, error } = id
        ? await supabase.from('colaboradores').update(dados).eq('id', id).select('id').single()
        : await supabase.from('colaboradores').insert(dados).select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (novoId) => {
      qc.invalidateQueries({ queryKey: ['colaboradores'] })
      qc.invalidateQueries({ queryKey: ['colaborador', novoId] })
      navigate(`/colaboradores/${novoId}`, { replace: true })
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
    <Pagina titulo={id ? 'Editar colaborador' : 'Novo colaborador'}>
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
