// Impressão / PDF: abre uma janela só com o documento (cabeçalho da marca) e chama a impressão do navegador.
// "Salvar como PDF" está na própria janela de impressão.

export const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const ESTILO = `
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Inter, system-ui, sans-serif; color: #102C61; font-size: 12px; line-height: 1.5; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #D9A126; padding-bottom: 8px; margin-bottom: 18px; }
  .marca { font-family: Georgia, serif; font-size: 22px; letter-spacing: 4px; color: #3B5778; }
  .marca small { display: block; font-size: 11px; letter-spacing: 3px; color: #D6992B; font-style: italic; }
  .meta { text-align: right; font-size: 10px; color: #4D5B73; }
  h1 { font-family: Georgia, serif; font-size: 18px; margin: 0 0 12px; text-align: center; }
  h2 { font-size: 13px; margin: 16px 0 6px; }
  p { margin: 0 0 8px; text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #C4D3E8; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #F7FAFB; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .campos { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 12px; }
  .campos div { border-bottom: 1px dotted #C4D3E8; padding: 2px 0; }
  .campos b { color: #4D5B73; font-weight: 600; margin-right: 6px; }
  .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 56px; text-align: center; font-size: 11px; }
  .assinaturas div { border-top: 1px solid #333; padding-top: 4px; }
  .total { font-size: 14px; font-weight: 700; text-align: right; margin-top: 8px; }
  .nota { font-size: 10px; color: #4D5B73; margin-top: 18px; }
  .quebra { page-break-after: always; }
`

/** Abre a impressão de um documento. "corpo" é HTML já escapado (use esc() nos valores). */
export function imprimirDocumento(titulo: string, corpo: string, opcoes: { subtitulo?: string } = {}) {
  const janela = window.open('', '_blank', 'width=900,height=1000')
  if (!janela) {
    alert('O navegador bloqueou a janela de impressão. Permita pop-ups para acquabistro.site.')
    return
  }
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
    <style>${ESTILO}</style></head><body>
    <header><div class="marca">ACQUA<small>Bistrô</small></div>
    <div class="meta">${opcoes.subtitulo ? `${esc(opcoes.subtitulo)}<br>` : ''}Emitido em ${esc(agora)}</div></header>
    ${corpo}
    <script>window.onload = () => { window.focus(); window.print(); }</script>
    </body></html>`)
  janela.document.close()
}

/** Tabela simples para documentos. */
export function tabelaHtml(cabecalho: { titulo: string; num?: boolean }[], linhas: (string | number)[][]): string {
  return `<table><thead><tr>${cabecalho.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.titulo)}</th>`).join('')}</tr></thead>
    <tbody>${linhas
      .map((l) => `<tr>${l.map((v, i) => `<td class="${cabecalho[i]?.num ? 'num' : ''}">${esc(v)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`
}
