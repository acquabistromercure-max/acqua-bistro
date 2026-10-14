// Peças comuns para registros com situação (registrado → aprovado → pago / cancelado).
import { useState } from 'react'
import { AreaTexto, Botao, Janela, Mensagem, Selo, mensagemErro } from './ui'

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
