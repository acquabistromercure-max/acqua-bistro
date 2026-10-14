// Gestão de usuários pelo administrador (convidar, desativar, reativar).
// Roda no servidor do Supabase: só aqui existe a chave secreta (service_role), que nunca vai para o site.
import { createClient } from 'npm:@supabase/supabase-js@2'

const PAPEIS = ['administrador', 'gerente', 'financeiro', 'rh', 'operador', 'consulta']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return resposta({ erro: 'Método não permitido.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Quem está chamando precisa ser administrador ativo.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: quem } = await admin.auth.getUser(token)
  if (!quem?.user) return resposta({ erro: 'Sessão inválida. Entre de novo.' }, 401)
  const { data: perfil } = await admin.from('perfis').select('papel, ativo').eq('id', quem.user.id).maybeSingle()
  if (!perfil || perfil.papel !== 'administrador' || !perfil.ativo) {
    return resposta({ erro: 'Apenas administradores podem gerenciar usuários.' }, 403)
  }
  // Alterações de perfil são feitas "como" o administrador, para o histórico registrar quem foi.
  const comoAdmin = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  let corpo: { acao?: string; email?: string; nome?: string; papel?: string; id?: string; redirectTo?: string }
  try {
    corpo = await req.json()
  } catch {
    return resposta({ erro: 'Pedido inválido.' }, 400)
  }

  if (corpo.acao === 'convidar') {
    const email = (corpo.email ?? '').trim().toLowerCase()
    const nome = (corpo.nome ?? '').trim()
    const papel = corpo.papel ?? 'consulta'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resposta({ erro: 'E-mail inválido.' }, 400)
    if (!nome) return resposta({ erro: 'Informe o nome.' }, 400)
    if (!PAPEIS.includes(papel)) return resposta({ erro: 'Papel inválido.' }, 400)

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome },
      redirectTo: corpo.redirectTo,
    })
    if (error) {
      const jaExiste = /already|registered|exists/i.test(error.message)
      return resposta({ erro: jaExiste ? 'Já existe um usuário com esse e-mail.' : `Não foi possível convidar: ${error.message}` }, 400)
    }
    // O perfil nasce pelo gatilho do banco; aqui só ajustamos nome e papel escolhidos.
    const { error: erroPerfil } = await comoAdmin.from('perfis').update({ nome, papel }).eq('id', data.user.id)
    if (erroPerfil) return resposta({ erro: `Convite enviado, mas o papel não foi salvo: ${erroPerfil.message}` }, 500)
    return resposta({ ok: true, id: data.user.id })
  }

  if (corpo.acao === 'desativar' || corpo.acao === 'reativar') {
    const id = corpo.id ?? ''
    if (!id) return resposta({ erro: 'Usuário não informado.' }, 400)
    if (id === quem.user.id) return resposta({ erro: 'Você não pode desativar a si mesmo.' }, 400)
    const ativo = corpo.acao === 'reativar'
    // Primeiro o perfil (o banco impede ficar sem administrador ativo).
    const { error: erroPerfil } = await comoAdmin.from('perfis').update({ ativo }).eq('id', id)
    if (erroPerfil) return resposta({ erro: erroPerfil.message }, 400)
    // Depois bloqueia (ou libera) o login e encerra as sessões abertas.
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: ativo ? 'none' : '876000h' })
    if (error) return resposta({ erro: `Perfil atualizado, mas o login não foi ${ativo ? 'liberado' : 'bloqueado'}: ${error.message}` }, 500)
    return resposta({ ok: true })
  }

  return resposta({ erro: 'Ação desconhecida.' }, 400)
})
