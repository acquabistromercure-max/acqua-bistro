import { useEffect, useState } from 'react'
import logo from '../assets/logo.png'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

type Perfil = { nome: string | null; papel: string }

const NOMES_PAPEL: Record<string, string> = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  financeiro: 'Financeiro',
  rh: 'RH',
  operador: 'Operador',
  consulta: 'Consulta',
}

/** Página provisória depois do login. O painel (dashboard) vem na próxima etapa. */
export default function Inicio() {
  const { sessao } = useAuth()
  const [perfil, setPerfil] = useState<Perfil | null>(null)

  useEffect(() => {
    if (!sessao) return
    supabase
      .from('perfis')
      .select('nome, papel')
      .eq('id', sessao.user.id)
      .maybeSingle()
      .then(({ data }) => setPerfil(data))
  }, [sessao])

  const nome = perfil?.nome || sessao?.user.email

  return (
    <div className="min-h-screen bg-acqua-gelo">
      <header className="flex items-center justify-between border-b border-acqua-suave bg-white px-4 py-3 sm:px-8">
        <img src={logo} alt="Acqua Bistrô" className="h-12" />
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-acqua-titulo hover:bg-acqua-suave"
        >
          Sair
        </button>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-serif text-3xl text-acqua-titulo sm:text-4xl">Olá, {nome}!</h1>
        {perfil && (
          <p className="mt-3 text-sm uppercase tracking-[0.25em] text-acqua-petroleo">
            Perfil: {NOMES_PAPEL[perfil.papel] ?? perfil.papel}
          </p>
        )}
        <p className="mt-8 text-slate-600">
          Você entrou no sistema do Acqua Bistrô. O painel com cafés, caixa, equipe e eventos está em construção.
        </p>
      </main>
    </div>
  )
}
