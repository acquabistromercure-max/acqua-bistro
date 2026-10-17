export type Colaborador = {
  id: string
  nome: string
  apelido: string | null
  cpf: string | null
  rg: string | null
  data_nascimento: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  contato_emergencia_nome: string | null
  contato_emergencia_telefone: string | null
  funcao: string | null
  vinculo: Vinculo
  situacao: 'ativo' | 'afastado' | 'desligado'
  data_admissao: string | null
  data_desligamento: string | null
  motivo_desligamento: string | null
  jornada_descricao: string | null
  jornada_semanal_horas: number | null
  tipo_remuneracao: 'mensal' | 'diaria' | 'turno' | 'hora'
  remuneracao: number | null
  observacoes: string | null
  horario_entrada: string | null
  horario_saida: string | null
  intervalo_minutos: number
  dias_folga: number[]
  criado_em: string
}

export type Vinculo = 'clt' | 'diarista' | 'temporario' | 'estagiario' | 'pj' | 'outro'

export const VINCULOS: { valor: Vinculo; rotulo: string }[] = [
  { valor: 'clt', rotulo: 'CLT' },
  { valor: 'diarista', rotulo: 'Diarista / eventual' },
  { valor: 'temporario', rotulo: 'Temporário' },
  { valor: 'estagiario', rotulo: 'Estagiário' },
  { valor: 'pj', rotulo: 'PJ / prestador' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const SITUACOES = [
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'afastado', rotulo: 'Afastado' },
  { valor: 'desligado', rotulo: 'Desligado' },
]

export const TIPOS_REMUNERACAO = [
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'diaria', rotulo: 'Por diária' },
  { valor: 'turno', rotulo: 'Por turno' },
  { valor: 'hora', rotulo: 'Por hora' },
]

export const TIPOS_OCORRENCIA = [
  { valor: 'falta', rotulo: 'Falta' },
  { valor: 'atraso', rotulo: 'Atraso' },
  { valor: 'atestado', rotulo: 'Atestado' },
  { valor: 'justificativa', rotulo: 'Justificativa' },
  { valor: 'advertencia', rotulo: 'Advertência' },
  { valor: 'ocorrencia', rotulo: 'Ocorrência' },
  { valor: 'elogio', rotulo: 'Elogio' },
  { valor: 'quebra', rotulo: 'Quebra / perda (inventário)' },
]

export const TIPOS_LANCAMENTO = [
  { valor: 'vale', rotulo: 'Vale' },
  { valor: 'adiantamento', rotulo: 'Adiantamento' },
  { valor: 'pagamento', rotulo: 'Pagamento' },
  { valor: 'diaria', rotulo: 'Diária' },
  { valor: 'passagem', rotulo: 'Passagem' },
  { valor: 'comissao', rotulo: 'Comissão' },
  { valor: 'desconto', rotulo: 'Desconto' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const rotulo = (lista: { valor: string; rotulo: string }[], valor: string | null | undefined) =>
  lista.find((i) => i.valor === valor)?.rotulo ?? valor ?? ''
