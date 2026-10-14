import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, FileCheck2, Paperclip, Printer, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarDataHora } from '../../lib/formatos'
import { imprimirDocumento } from '../../lib/imprimir'
import { Botao, Janela, Mensagem, Selo, Tabela, mensagemErro } from '../../components/ui'
import { BotaoExcluir, JanelaCancelar } from '../../components/registros'
import type { Documento } from './dados'

const COR = { emitido: 'azul', enviado: 'amarelo', assinado: 'verde', cancelado: 'vermelho' } as const
const ROTULO = { emitido: 'Emitido', enviado: 'Enviado p/ assinatura', assinado: 'Assinado', cancelado: 'Cancelado' } as const

/** Histórico de documentos: reimprimir a mesma versão, anexar a cópia assinada e acompanhar a assinatura. */
export default function ListaDocumentos({ lista, nomeColaborador }: { lista: Documento[]; nomeColaborador?: (id: string | null) => string }) {
  const [aberto, setAberto] = useState<Documento | null>(null)
  return (
    <>
      <Tabela
        linhas={lista}
        chave={(d) => d.id}
        aoClicar={setAberto}
        vazio="Nenhum documento emitido."
        colunas={[
          { titulo: 'Emitido em', celula: (d) => formatarDataHora(d.criado_em) },
          ...(nomeColaborador ? [{ titulo: 'Colaborador', celula: (d: Documento) => nomeColaborador(d.colaborador_id) }] : []),
          { titulo: 'Documento', celula: (d) => <b>{d.titulo}</b> },
          { titulo: 'Situação', celula: (d) => <Selo cor={COR[d.situacao]}>{ROTULO[d.situacao]}</Selo> },
          { titulo: 'Cópia assinada', celula: (d) => (d.arquivo ? <Paperclip className="h-4 w-4 text-emerald-600" /> : '—') },
        ]}
      />
      {aberto && <JanelaDocumento documento={aberto} aoFechar={() => setAberto(null)} />}
    </>
  )
}

function JanelaDocumento({ documento: d, aoFechar }: { documento: Documento; aoFechar: () => void }) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const arquivo = useRef<HTMLInputElement>(null)
  const [cancelando, setCancelando] = useState(false)
  const atualizar = () => qc.invalidateQueries({ queryKey: ['documentos'] })

  const mudar = useMutation({
    mutationFn: async (dados: Partial<Documento>) => {
      const { error } = await supabase.from('documentos').update(dados).eq('id', d.id)
      if (error) throw error
    },
    onSuccess: () => {
      atualizar()
      setCancelando(false)
      aoFechar()
    },
  })

  const anexar = useMutation({
    mutationFn: async (f: File) => {
      if (f.size > 10 * 1024 * 1024) throw new Error('Arquivo maior que 10 MB.')
      const ext = (f.name.split('.').pop() || 'pdf').toLowerCase()
      const caminho = `${d.colaborador_id ?? 'geral'}/${d.id}.${ext}`
      const { error } = await supabase.storage.from('documentos').upload(caminho, f, { upsert: true, contentType: f.type })
      if (error) throw error
      const { error: e2 } = await supabase.from('documentos').update({ arquivo: caminho, situacao: 'assinado' }).eq('id', d.id)
      if (e2) throw e2
    },
    onSuccess: () => {
      atualizar()
      aoFechar()
    },
  })

  const baixar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.storage.from('documentos').createSignedUrl(d.arquivo!, 120)
      if (error) throw error
      window.open(data.signedUrl, '_blank')
    },
  })

  const editavel = d.situacao !== 'cancelado' && pode('documentos', 'editar')
  return (
    <>
      <Janela
        aberta={!cancelando}
        aoFechar={aoFechar}
        titulo={d.titulo}
        largura="max-w-xl"
        rodape={
          <>
            <BotaoExcluir modulo="documentos" tabela="documentos" id={d.id} descricao={`o documento “${d.titulo}”`} aoExcluir={() => { atualizar(); aoFechar() }} />
            {d.situacao !== 'cancelado' && pode('documentos', 'cancelar') && <Botao variante="perigo" onClick={() => setCancelando(true)}>Cancelar</Botao>}
            <Botao variante="secundario" icone={<Printer className="h-4 w-4" />} onClick={() => imprimirDocumento(d.titulo, d.html)}>Reimprimir</Botao>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            <Selo cor={COR[d.situacao]}>{ROTULO[d.situacao]}</Selo> · emitido por {nome(d.criado_por)} em {formatarDataHora(d.criado_em)}
            {d.assinado_em && ` · assinado em ${formatarData(d.assinado_em)}`}
          </p>
          {d.motivo_cancelamento && <p className="text-slate-500">Cancelado: {d.motivo_cancelamento}</p>}
          {editavel && (
            <div className="flex flex-wrap gap-2">
              {d.situacao === 'emitido' && (
                <Botao variante="secundario" icone={<Send className="h-4 w-4" />} carregando={mudar.isPending} onClick={() => mudar.mutate({ situacao: 'enviado' })}>
                  Enviado para assinatura
                </Botao>
              )}
              {d.situacao !== 'assinado' && (
                <Botao variante="secundario" icone={<FileCheck2 className="h-4 w-4" />} carregando={mudar.isPending} onClick={() => mudar.mutate({ situacao: 'assinado' })}>
                  Marcar como assinado
                </Botao>
              )}
              <Botao icone={<Paperclip className="h-4 w-4" />} carregando={anexar.isPending} onClick={() => arquivo.current?.click()}>
                {d.arquivo ? 'Trocar cópia assinada' : 'Anexar cópia assinada'}
              </Botao>
              <input
                ref={arquivo}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) anexar.mutate(f)
                  e.target.value = ''
                }}
              />
            </div>
          )}
          {d.arquivo && (
            <Botao variante="fantasma" icone={<Download className="h-4 w-4" />} carregando={baixar.isPending} onClick={() => baixar.mutate()}>
              Ver cópia assinada
            </Botao>
          )}
          <p className="text-xs text-slate-500">Dica: tire uma foto ou escaneie o papel assinado e anexe aqui. O arquivo fica guardado de forma privada.</p>
          {(mudar.error || anexar.error || baixar.error) && <Mensagem tipo="erro">{mensagemErro(mudar.error || anexar.error || baixar.error)}</Mensagem>}
        </div>
      </Janela>
      <JanelaCancelar aberta={cancelando} titulo="Cancelar documento" carregando={mudar.isPending} erro={mudar.error} aoFechar={() => setCancelando(false)} aoConfirmar={(m) => mudar.mutate({ situacao: 'cancelado', motivo_cancelamento: m })} />
    </>
  )
}
