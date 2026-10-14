// Peças comuns para registros com situação (registrado → aprovado → pago / cancelado) e exclusão.
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePermissoes } from '../lib/permissoes'
import { AreaTexto, Botao, Confirmar, Janela, Mensagem, Selo, mensagemErro } from './ui'

/**
 * Botão "Excluir" para registros criados por engano. Só aparece para quem tem a permissão "excluir" do módulo
 * (o Administrador sempre tem). Pede confirmação; a cópia do que foi apagado fica no Histórico.
 */
export function BotaoExcluir({
  modulo,
  tabela,
  id,
  coluna = 'id',
  descricao,
  aoExcluir,
  className = 'mr-auto',
}: {
  modulo: string
  tabela: string
  id: string
  coluna?: string
  descricao: string
  aoExcluir: () => void
  className?: string
}) {
  const { pode } = usePermissoes()
  const [confirmando, setConfirmando] = useState(false)
  const excluir = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from(tabela).delete().eq(coluna, id).select(coluna)
      if (error) throw error
      if (!data?.length) throw new Error('Não foi possível excluir: sem permissão ou o registro já não existe.')
    },
    onSuccess: () => {
      setConfirmando(false)
      aoExcluir()
    },
  })
  if (!pode(modulo, 'excluir')) return null
  return (
    <>
      <Botao variante="fantasma" className={className} icone={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmando(true)}>
        Excluir
      </Botao>
      <Confirmar
        aberta={confirmando}
        titulo="Excluir registro"
        perigo
        textoConfirmar="Excluir"
        carregando={excluir.isPending}
        aoFechar={() => setConfirmando(false)}
        aoConfirmar={() => excluir.mutate()}
        mensagem={
          <div className="space-y-2">
            <p>
              Excluir <b>{descricao}</b>? Use para registros criados por engano. Ele sai das telas e dos totais; uma cópia fica
              guardada no Histórico.
            </p>
            {excluir.error && <Mensagem tipo="erro">{mensagemErro(excluir.error)}</Mensagem>}
          </div>
        }
      />
    </>
  )
}

const CORES: Record<string, 'cinza' | 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'dourado'> = {
  registrada: 'azul',
  pendente: 'amarelo',
  convocada: 'azul',
  solicitado: 'amarelo',
  orcamento: 'amarelo',
  aberto: 'azul',
  trabalhada: 'azul',
  em_andamento: 'azul',
  aprovada: 'verde',
  aprovado: 'verde',
  confirmado: 'verde',
  comprado: 'azul',
  faturado: 'dourado',
  faturamento: 'dourado',
  recebido: 'verde',
  pago: 'verde',
  paga: 'verde',
  concluido: 'verde',
  fechado: 'cinza',
  encerrado: 'cinza',
  emitido: 'azul',
  enviado: 'amarelo',
  assinado: 'verde',
  cancelada: 'vermelho',
  cancelado: 'vermelho',
}

const ROTULOS: Record<string, string> = {
  em_andamento: 'Em andamento',
  orcamento: 'Orçamento',
  encerrado: 'Encerrado',
  faturamento: 'Faturamento',
}

export function rotuloSituacao(s: string) {
  return ROTULOS[s] ?? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

export function SeloSituacao({ situacao }: { situacao: string }) {
  return <Selo cor={CORES[situacao] ?? 'cinza'}>{rotuloSituacao(situacao)}</Selo>
}

/** Janela que pede o motivo antes de cancelar (o banco exige motivo). */
export function JanelaCancelar({
  aberta,
  titulo = 'Cancelar registro',
  aviso,
  aoConfirmar,
  aoFechar,
  carregando,
  erro,
}: {
  aberta: boolean
  titulo?: string
  aviso?: string
  aoConfirmar: (motivo: string) => void
  aoFechar: () => void
  carregando?: boolean
  erro?: unknown
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <Janela
      aberta={aberta}
      aoFechar={aoFechar}
      titulo={titulo}
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Voltar</Botao>
          <Botao variante="perigo" carregando={carregando} disabled={!motivo.trim()} onClick={() => aoConfirmar(motivo.trim())}>
            Cancelar registro
          </Botao>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-700">
          {aviso ?? 'O registro continua no histórico, marcado como cancelado. Essa ação não pode ser desfeita.'}
        </p>
        <AreaTexto rotulo="Motivo do cancelamento" value={motivo} onChange={(e) => setMotivo(e.target.value)} required autoFocus />
        {!!erro && <Mensagem tipo="erro">{mensagemErro(erro)}</Mensagem>}
      </div>
    </Janela>
  )
}
