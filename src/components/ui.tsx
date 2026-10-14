// Componentes visuais comuns do sistema (identidade do mockup: azul profundo, acqua e dourado).
import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

// ---------------------------------------------------------------- Botões

type Variante = 'primario' | 'secundario' | 'perigo' | 'fantasma'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-gradient-to-r from-[#539EB1] to-[#126E89] text-white shadow-sm hover:brightness-110',
  secundario: 'border border-[#C4D3E8] bg-white text-acqua-titulo hover:bg-acqua-suave',
  perigo: 'bg-red-600 text-white hover:bg-red-700',
  fantasma: 'text-acqua-titulo hover:bg-acqua-suave',
}

export function Botao({
  variante = 'primario',
  carregando,
  icone,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean; icone?: ReactNode }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || carregando}
      className={cx(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acqua focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTES[variante],
        className,
      )}
    >
      {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : icone}
      {children}
    </button>
  )
}

// ---------------------------------------------------------------- Campos de formulário

type BaseCampo = { rotulo: string; erro?: string; ajuda?: string; className?: string }

function Rotulo({ id, rotulo, obrigatorio }: { id: string; rotulo: string; obrigatorio?: boolean }) {
  return (
    <label htmlFor={id} className="mb-1 block text-sm font-semibold text-acqua-titulo">
      {rotulo}
      {obrigatorio && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}
    </label>
  )
}

function Rodape({ id, erro, ajuda }: { id: string; erro?: string; ajuda?: string }) {
  if (erro) return <p id={`${id}-msg`} className="mt-1 text-xs text-red-700">{erro}</p>
  if (ajuda) return <p id={`${id}-msg`} className="mt-1 text-xs text-slate-500">{ajuda}</p>
  return null
}

const estiloEntrada =
  'w-full rounded-lg border border-[#C4D3E8] bg-white px-3 py-2 text-sm text-acqua-titulo placeholder:text-[#8090B3] ' +
  'focus:border-acqua-petroleo focus:outline-none focus:ring-2 focus:ring-acqua/40 disabled:bg-slate-50 disabled:text-slate-500'

export function Campo({ rotulo, erro, ajuda, className, ...props }: BaseCampo & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className={className}>
      <Rotulo id={id} rotulo={rotulo} obrigatorio={props.required} />
      <input
        id={id}
        aria-invalid={!!erro}
        aria-describedby={erro || ajuda ? `${id}-msg` : undefined}
        {...props}
        className={cx(estiloEntrada, 'min-h-10', erro && 'border-red-400')}
      />
      <Rodape id={id} erro={erro} ajuda={ajuda} />
    </div>
  )
}

export function AreaTexto({ rotulo, erro, ajuda, className, ...props }: BaseCampo & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <div className={className}>
      <Rotulo id={id} rotulo={rotulo} obrigatorio={props.required} />
      <textarea id={id} rows={3} {...props} className={cx(estiloEntrada, erro && 'border-red-400')} />
      <Rodape id={id} erro={erro} ajuda={ajuda} />
    </div>
  )
}

export function Selecao({
  rotulo,
  erro,
  ajuda,
  className,
  opcoes,
  vazio,
  ...props
}: BaseCampo & SelectHTMLAttributes<HTMLSelectElement> & { opcoes: { valor: string; rotulo: string }[]; vazio?: string }) {
  const id = useId()
  return (
    <div className={className}>
      <Rotulo id={id} rotulo={rotulo} obrigatorio={props.required} />
      <select id={id} {...props} className={cx(estiloEntrada, 'min-h-10', erro && 'border-red-400')}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <Rodape id={id} erro={erro} ajuda={ajuda} />
    </div>
  )
}

/** Liga/desliga com texto (ex.: "Faturar para empresa"). */
export function Alternador({
  rotulo,
  ligado,
  aoMudar,
  descricao,
  disabled,
}: {
  rotulo: string
  ligado: boolean
  aoMudar: (v: boolean) => void
  descricao?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      disabled={disabled}
      onClick={() => aoMudar(!ligado)}
      className="flex w-full items-start gap-3 rounded-lg border border-[#C4D3E8] bg-white p-3 text-left hover:bg-acqua-gelo disabled:opacity-60"
    >
      <span className={cx('mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition', ligado ? 'bg-acqua-petroleo' : 'bg-slate-300')}>
        <span className={cx('h-4 w-4 rounded-full bg-white shadow transition', ligado && 'translate-x-4')} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-acqua-titulo">{rotulo}</span>
        {descricao && <span className="block text-xs text-slate-500">{descricao}</span>}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------- Estrutura de página

export function Pagina({ titulo, descricao, acoes, children }: { titulo: string; descricao?: string; acoes?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl text-acqua-titulo sm:text-3xl">{titulo}</h1>
          {descricao && <p className="mt-1 text-sm text-slate-600">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
      </div>
      {children}
    </div>
  )
}

export function Cartao({ titulo, acoes, children, className }: { titulo?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('min-w-0 rounded-2xl border border-acqua-suave bg-white p-4 shadow-sm sm:p-5', className)}>
      {(titulo || acoes) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {titulo && <h2 className="font-semibold text-acqua-titulo">{titulo}</h2>}
          {acoes}
        </header>
      )}
      {children}
    </section>
  )
}

export function Selo({ cor = 'cinza', children }: { cor?: 'cinza' | 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'dourado'; children: ReactNode }) {
  const cores = {
    cinza: 'bg-slate-100 text-slate-700',
    verde: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    amarelo: 'bg-amber-50 text-amber-800 ring-amber-200',
    vermelho: 'bg-red-50 text-red-800 ring-red-200',
    azul: 'bg-acqua-suave text-acqua-titulo ring-acqua/40',
    dourado: 'bg-[#FBF3DF] text-[#7A5A0E] ring-acqua-dourado/40',
  }[cor]
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ring-transparent', cores)}>{children}</span>
}

export function Mensagem({ tipo, children }: { tipo: 'erro' | 'sucesso' | 'info' | 'alerta'; children: ReactNode }) {
  const cores = {
    erro: 'border-red-200 bg-red-50 text-red-800',
    sucesso: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-acqua-suave bg-acqua-gelo text-acqua-titulo',
    alerta: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tipo]
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={cx('rounded-lg border px-4 py-3 text-sm', cores)}>
      {children}
    </div>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin" /> {texto}
    </div>
  )
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-[#C4D3E8] px-4 py-10 text-center text-sm text-slate-500">{children}</div>
}

// ---------------------------------------------------------------- Tabela (vira cartões no celular)

export type Coluna<T> = {
  titulo: string
  celula: (linha: T) => ReactNode
  className?: string
}

export function Tabela<T>({
  linhas,
  colunas,
  chave,
  aoClicar,
  vazio = 'Nada por aqui ainda.',
}: {
  linhas: T[]
  colunas: Coluna<T>[]
  chave: (linha: T) => string | number
  aoClicar?: (linha: T) => void
  vazio?: string
}) {
  if (linhas.length === 0) return <Vazio>{vazio}</Vazio>
  return (
    <>
      {/* Computador */}
      <div className="hidden overflow-x-auto rounded-xl border border-acqua-suave bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-acqua-gelo text-xs uppercase tracking-wider text-acqua-petroleo">
            <tr>
              {colunas.map((c) => (
                <th key={c.titulo} scope="col" className={cx('px-4 py-3 font-semibold', c.className)}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-acqua-suave">
            {linhas.map((l) => (
              <tr
                key={chave(l)}
                onClick={aoClicar ? () => aoClicar(l) : undefined}
                className={cx(aoClicar && 'cursor-pointer hover:bg-acqua-gelo')}
              >
                {colunas.map((c) => (
                  <td key={c.titulo} className={cx('px-4 py-3 align-top text-acqua-titulo', c.className)}>
                    {c.celula(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Celular */}
      <ul className="space-y-2 md:hidden">
        {linhas.map((l) => (
          <li key={chave(l)}>
            <div
              role={aoClicar ? 'button' : undefined}
              tabIndex={aoClicar ? 0 : undefined}
              onClick={aoClicar ? () => aoClicar(l) : undefined}
              onKeyDown={aoClicar ? (e) => e.key === 'Enter' && aoClicar(l) : undefined}
              className="rounded-xl border border-acqua-suave bg-white p-3 text-sm shadow-sm"
            >
              <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
                {colunas.map((c) => (
                  <div key={c.titulo} className="contents">
                    <dt className="text-xs text-slate-500">{c.titulo}</dt>
                    <dd className="text-acqua-titulo">{c.celula(l)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

// ---------------------------------------------------------------- Janela (modal)

export function Janela({
  aberta,
  aoFechar,
  titulo,
  children,
  rodape,
  largura = 'max-w-lg',
}: {
  aberta: boolean
  aoFechar: () => void
  titulo: string
  children: ReactNode
  rodape?: ReactNode
  largura?: string
}) {
  useEffect(() => {
    if (!aberta) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    document.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
    }
  }, [aberta, aoFechar])

  if (!aberta) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-acqua-titulo/40 p-0 sm:items-center sm:p-4" onMouseDown={aoFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', largura)}
      >
        <header className="flex items-center justify-between border-b border-acqua-suave px-5 py-4">
          <h2 className="font-serif text-xl text-acqua-titulo">{titulo}</h2>
          <button onClick={aoFechar} className="rounded p-1 text-slate-500 hover:bg-acqua-suave" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <footer className="flex flex-wrap justify-end gap-2 border-t border-acqua-suave px-5 py-3">{rodape}</footer>}
      </div>
    </div>
  )
}

/** Pede confirmação antes de uma ação importante. */
export function Confirmar({
  aberta,
  titulo,
  mensagem,
  textoConfirmar = 'Confirmar',
  perigo,
  carregando,
  aoConfirmar,
  aoFechar,
}: {
  aberta: boolean
  titulo: string
  mensagem: ReactNode
  textoConfirmar?: string
  perigo?: boolean
  carregando?: boolean
  aoConfirmar: () => void
  aoFechar: () => void
}) {
  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      titulo={titulo}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Voltar</Botao>
          <Botao variante={perigo ? 'perigo' : 'primario'} carregando={carregando} onClick={aoConfirmar}>
            {textoConfirmar}
          </Botao>
        </>
      }
    >
      <div className="text-sm text-slate-700">{mensagem}</div>
    </Janela>
  )
}

// ---------------------------------------------------------------- Abas

export function Abas<T extends string>({ abas, ativa, aoMudar }: { abas: { valor: T; rotulo: string }[]; ativa: T; aoMudar: (v: T) => void }) {
  return (
    <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="tablist" className="flex min-w-max gap-1 border-b border-acqua-suave">
        {abas.map((a) => (
          <button
            key={a.valor}
            role="tab"
            aria-selected={a.valor === ativa}
            onClick={() => aoMudar(a.valor)}
            className={cx(
              '-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition',
              a.valor === ativa ? 'border-acqua-dourado text-acqua-titulo' : 'border-transparent text-slate-500 hover:text-acqua-titulo',
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Texto amigável a partir de um erro do Supabase. */
export function mensagemErro(erro: unknown): string {
  const e = erro as { message?: string; code?: string } | null
  if (!e) return 'Algo deu errado. Tente novamente.'
  if (e.code === '42501' || /row-level security|permission denied/i.test(e.message ?? '')) {
    return 'Você não tem permissão para fazer isso.'
  }
  if (e.code === '23505') return 'Já existe um registro com esses dados.'
  if (e.code === '23514') return 'Algum valor está fora do permitido. Confira os campos.'
  return e.message ?? 'Algo deu errado. Tente novamente.'
}
