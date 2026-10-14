import { ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Botao, Pagina, Vazio } from '../components/ui'

/** Mostrada quando o usuário não tem permissão para a área, ou quando a conta foi desativada. */
export default function SemAcesso({ desativado }: { desativado?: boolean }) {
  const conteudo = (
    <Vazio>
      <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-acqua-dourado" />
      {desativado
        ? 'Seu acesso está desativado. Fale com o administrador do sistema.'
        : 'Você não tem permissão para ver esta área. Se precisar, peça ao administrador.'}
      {desativado && (
        <div className="mt-4">
          <Botao variante="secundario" onClick={() => supabase.auth.signOut()}>Sair</Botao>
        </div>
      )}
    </Vazio>
  )
  return desativado ? <div className="mx-auto max-w-lg px-4 py-20">{conteudo}</div> : <Pagina titulo="Sem acesso">{conteudo}</Pagina>
}
