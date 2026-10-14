import type { ReactNode } from 'react'
import fotoFundo from '../assets/login-bg.jpg'
import logo from '../assets/logo.png'

/** Moldura comum às telas públicas: foto com a marca à esquerda e cartão à direita (mockup aprovado). */
export default function LayoutLogin({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#F4FAFC] via-[#E3F2F7] to-[#BFE2EC] lg:flex">
      {/* Reflexos de água no lado direito */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 40% 30% at 95% 20%, rgba(131,199,216,.55), transparent 70%),' +
            'radial-gradient(ellipse 35% 35% at 100% 85%, rgba(131,199,216,.6), transparent 70%)',
        }}
      />

      {/* Lado esquerdo: foto + logo + slogan */}
      <section className="relative h-[340px] w-full shrink-0 sm:h-[420px] lg:h-auto lg:min-h-screen lg:w-[53%]">
        <img src={fotoFundo} alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_30%] lg:object-left" />
        <div aria-hidden="true" className="absolute inset-0 bg-white/45 lg:hidden" />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 hidden w-24 bg-gradient-to-r from-transparent to-[#EEF7FA] lg:block"
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[#F1F8FA] lg:hidden" />

        <div className="relative flex h-full flex-col items-center justify-center px-6 lg:block lg:pl-[42%] lg:pr-[6%] lg:pt-[11vh]">
          <img
            src={logo}
            alt="Acqua Bistrô"
            className="w-[min(70vw,300px)] drop-shadow-[0_1px_8px_rgba(255,255,255,.6)] lg:w-full lg:max-w-[420px]"
          />
          <div className="relative -mt-[17%] hidden lg:block">
            <p className="font-serif text-[clamp(1rem,1.5vw,1.6rem)] font-bold uppercase leading-[1.45] tracking-[0.16em] text-acqua-titulo">
              Gastronomia
              <br />
              que conecta
              <br />
              pessoas
            </p>
            <div className="my-5 h-[2px] w-12 bg-acqua-dourado" />
            <p className="max-w-[17ch] font-serif text-[clamp(1.05rem,1.55vw,1.6rem)] leading-snug text-acqua-titulo">
              Sabor, experiências e bons momentos em harmonia com o mar.
            </p>
          </div>
          <p className="mt-3 text-center font-serif text-[13px] font-bold uppercase tracking-[0.14em] text-acqua-titulo lg:hidden">
            Gastronomia que conecta pessoas
          </p>
        </div>
      </section>

      {/* Lado direito: assinatura + cartão */}
      <section className="relative flex flex-1 flex-col px-4 pb-8 lg:min-h-screen lg:pl-0 lg:pr-[4.2%] lg:pb-[3vh] lg:pt-[2vh]">
        <div className="mb-4 hidden items-center justify-end gap-6 lg:-mr-[3%] lg:flex">
          <p className="text-[11px] font-medium uppercase leading-relaxed tracking-[0.35em] text-acqua-titulo">
            Acqua Bistrô
            <br />
            Sistema administrativo
          </p>
          <span className="h-px w-20 bg-acqua-dourado" />
        </div>

        <main className="relative -mt-10 flex flex-1 items-center justify-center rounded-3xl bg-white/95 px-6 py-10 shadow-[0_20px_60px_-20px_rgba(31,47,92,.35)] backdrop-blur sm:px-12 lg:mt-0 lg:px-[9%]">
          <div className="w-full max-w-[570px]">{children}</div>
        </main>
      </section>
    </div>
  )
}

export function TituloCartao({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  return (
    <header className="mb-10 text-center lg:mb-12 alto:mb-20">
      <h1 className="font-serif text-[clamp(1.75rem,2.3vw,2.5rem)] leading-tight text-acqua-titulo xl:whitespace-nowrap">{titulo}</h1>
      <p className="mt-3 text-[12px] font-medium uppercase tracking-[0.35em] text-acqua-petroleo sm:text-[13px]">
        {subtitulo}
      </p>
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
