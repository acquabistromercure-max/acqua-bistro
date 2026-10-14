import { useState } from 'react'
import { IconeCadeado, IconeOlho, IconeOlhoFechado } from './Icones'

type Props = {
  id: string
  valor: string
  aoMudar: (v: string) => void
  placeholder?: string
  autoComplete: 'current-password' | 'new-password'
}

export default function CampoSenha({ id, valor, aoMudar, placeholder = 'Digite sua senha', autoComplete }: Props) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div className="campo">
      <IconeCadeado className="h-6 w-6 shrink-0 text-acqua-icone" />
      <input
        id={id}
        type={visivel ? 'text' : 'password'}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        className="shrink-0 rounded p-1 text-acqua-icone hover:text-acqua-petroleo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acqua"
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
      >
        {visivel ? <IconeOlhoFechado className="h-7 w-7" /> : <IconeOlho className="h-7 w-7" />}
      </button>
    </div>
  )
}
