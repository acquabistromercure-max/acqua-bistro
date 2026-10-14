// Modelos de documentos (textos padrão). O administrador pode trocar cada texto na tela Documentos → Modelos.
// Marcadores: {nome} {cpf} {funcao} {valor} {valor_extenso} {data} {data_extenso} {mes} {descricao} {tipo}
// {empresa} {cnpj} {cidade} {lista} {admissao}
import { esc } from './imprimir'

export type TipoDocumento =
  | 'recibo_adiantamento' | 'recibo_vale' | 'registro_ocorrencia' | 'advertencia' | 'termo_domingo' | 'folha_ponto' | 'recibo_diaria'

export const TIPOS_DOCUMENTO: { valor: TipoDocumento; rotulo: string }[] = [
  { valor: 'recibo_adiantamento', rotulo: 'Recibo de adiantamento' },
  { valor: 'recibo_vale', rotulo: 'Recibo de vale' },
  { valor: 'recibo_diaria', rotulo: 'Recibo de diária' },
  { valor: 'registro_ocorrencia', rotulo: 'Registro de ocorrência' },
  { valor: 'advertencia', rotulo: 'Advertência' },
  { valor: 'termo_domingo', rotulo: 'Termo de domingo do mês' },
  { valor: 'folha_ponto', rotulo: 'Folha-ponto' },
]

export const TEXTOS_PADRAO: Record<Exclude<TipoDocumento, 'folha_ponto'>, string> = {
  recibo_adiantamento:
    'Recebi de {empresa}, inscrita no CNPJ {cnpj}, a importância de {valor} ({valor_extenso}), referente a adiantamento salarial, que autorizo ser descontada do meu salário. {descricao}',
  recibo_vale:
    'Recebi de {empresa}, inscrita no CNPJ {cnpj}, a importância de {valor} ({valor_extenso}), a título de vale, que autorizo ser descontada do meu salário. {descricao}',
  recibo_diaria:
    'Recebi de {empresa}, inscrita no CNPJ {cnpj}, a importância de {valor} ({valor_extenso}), referente à diária de trabalho eventual prestado em {data}. {descricao}',
  registro_ocorrencia:
    'Registramos que, em {data}, o(a) colaborador(a) {nome}, função {funcao}, teve a seguinte ocorrência ({tipo}): {descricao}. O(a) colaborador(a) declara estar ciente deste registro.',
  advertencia:
    'Pelo presente, advertimos o(a) colaborador(a) {nome}, função {funcao}, pelo seguinte fato ocorrido em {data}: {descricao}. Esclarecemos que a repetição de faltas desta natureza poderá acarretar as medidas disciplinares previstas em lei. A assinatura abaixo confirma o recebimento desta advertência.',
  termo_domingo:
    'Eu, {nome}, função {funcao}, declaro que trabalhei nos domingos e/ou feriados abaixo relacionados no mês de {mes}, conforme escala, estando ciente da forma de compensação ou pagamento combinada com a empresa.',
}

export type Dados = Record<string, string>

export function preencher(texto: string, dados: Dados): string {
  return texto.replace(/\{(\w+)\}/g, (_, k: string) => (k in dados ? dados[k] : `{${k}}`)).replace(/\s+\.$/, '.').trim()
}

/** HTML (escapado) do corpo de um documento de texto com assinatura. */
export function corpoTexto(titulo: string, texto: string, dados: Dados, extraHtml = '', assinaturas = ['{nome}', '{empresa}']): string {
  const paragrafo = esc(preencher(texto, dados))
  return `<h1>${esc(titulo)}</h1>
    <div class="campos">
      <div><b>Colaborador(a)</b>${esc(dados.nome ?? '')}</div><div><b>CPF</b>${esc(dados.cpf || '—')}</div>
      <div><b>Função</b>${esc(dados.funcao || '—')}</div><div><b>Data</b>${esc(dados.data ?? '')}</div>
    </div>
    <p>${paragrafo}</p>
    ${extraHtml}
    <p style="margin-top:24px">${esc(dados.cidade ?? '')}, ${esc(dados.data_extenso ?? '')}.</p>
    <div class="assinaturas">${assinaturas.map((a) => `<div>${esc(preencher(a, dados))}</div>`).join('')}</div>`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const dataPorExtenso = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]} de ${iso.slice(0, 4)}`
export const mesPorExtenso = (comp: string) => `${MESES[Number(comp.slice(5, 7)) - 1]} de ${comp.slice(0, 4)}`
