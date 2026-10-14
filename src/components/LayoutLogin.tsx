import type { ReactNode } from 'react'
import fotoFundo from '../assets/login-bg.jpg'
import LogoAcqua from './LogoAcqua'
import { IconeCadeado } from './Icones'

/** Moldura comum às telas públicas: foto com a marca à esquerda e cartão de acesso à direita. */
export default function LayoutLogin({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      {/* Foto + marca */}
      <section className="relative h-60 overflow-hidden sm:h-72 lg:h-auto lg:min-h-screen">
        <img src={fotoFundo} alt="" className="absolute inset-0 h-full w-full object-cover object-[60%_45%]" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-acqua-titulo/45 via-transparent to-white/10" />

        <div className="relative flex h-full items-center justify-center p-5 lg:items-end lg:justify-start lg:p-12 xl:p-16">
          <div className="w-full max-w-[300px] rounded-3xl bg-white/80 px-6 py-5 shadow-[0_12px_40px_-12px_rgba(16,44,97,.45)] backdrop-blur-md sm:max-w-[340px] lg:max-w-[440px] lg:px-10 lg:py-9">
            <LogoAcqua className="w-full" />
            <div className="hidden lg:block">
              <div className="mx-auto my-6 h-px w-16 bg-acqua-dourado" />
              <p className="text-center font-serif text-lg font-bold uppercase tracking-[0.18em] text-acqua-titulo xl:text-xl">
                Gastronomia que conecta pessoas
              </p>
              <p className="mt-3 text-center font-serif text-base leading-relaxed text-acqua-titulo/80 xl:text-lg">
                Sabor, experiências e bons momentos em harmonia com o mar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Cartão de acesso */}
      <section className="relative flex flex-col bg-gradient-to-b from-white to-acqua-gelo px-5 py-8 sm:px-10 lg:min-h-screen lg:px-12 lg:py-10">
        <p className="hidden text-right text-[11px] font-semibold uppercase tracking-[0.35em] text-acqua-petroleo lg:block">
          Sistema administrativo
        </p>

        <main className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[440px] rounded-3xl border border-acqua-suave bg-white px-6 py-9 shadow-[0_24px_60px_-28px_rgba(16,44,97,.35)] sm:px-10 sm:py-11">
            {children}
          </div>
        </main>

        <footer className="mt-8 flex flex-col items-center gap-1 text-center text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <IconeCadeado className="h-4 w-4 text-acqua-petroleo" />
            Acesso restrito à equipe autorizada do Acqua Bistrô
          </span>
          <span>© {new Date().getFullYear()} Acqua Bistrô · Fortaleza</span>
        </footer>
      </section>
    </div>
  )
}

export function TituloCartao({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <header className="mb-8 text-center">
      <h1 className="font-serif text-[1.7rem] leading-tight text-acqua-titulo sm:text-[2rem]">{titulo}</h1>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-acqua-petroleo sm:text-xs">{subtitulo}</p>
      <span className="mx-auto mt-5 block h-px w-12 bg-acqua-dourado" />
    </header>
  )
}

export function Aviso({ tipo, children }: { tipo: 'erro' | 'sucesso' | 'info'; children: ReactNode }) {
  const cores = {
    erro: 'border-red-200 bg-red-50 text-red-800',
    sucesso: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-slate-200 bg-slate-50 text-acqua-titulo',
  }[tipo]
  return (
    <div role={tipo === 'erro' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${cores}`}>
      {children}
    </div>
  )
}
