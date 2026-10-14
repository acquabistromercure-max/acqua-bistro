import { useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import { usePermissoes } from '../../lib/permissoes'
import { TIPOS_DOCUMENTO, type TipoDocumento } from '../../lib/documentos'
import { Botao, Carregando } from '../../components/ui'
import type { Colaborador } from '../colaboradores/tipos'
import EmitirDocumento from './EmitirDocumento'
import ListaDocumentos from './ListaDocumentos'
import { useDocumentos } from './dados'

/** Aba "Documentos" da ficha: gerar (recibo, ocorrência, advertência, termo de domingo, folha-ponto, diária) e histórico. */
export default function AbaDocumentos({ colaborador }: { colaborador: Colaborador }) {
  const { pode } = usePermissoes()
  const docs = useDocumentos(colaborador.id)
  const [emitindo, setEmitindo] = useState<TipoDocumento | null>(null)
  return (
    <>
      {pode('documentos', 'criar') && (
        <div className="mb-4 flex flex-wrap gap-2">
          {TIPOS_DOCUMENTO.map((t) => (
            <Botao key={t.valor} variante="secundario" icone={<FilePlus2 className="h-4 w-4" />} onClick={() => setEmitindo(t.valor)}>
              {t.rotulo}
            </Botao>
          ))}
        </div>
      )}
      {docs.isLoading ? <Carregando /> : <ListaDocumentos lista={docs.data ?? []} />}
      {emitindo && <EmitirDocumento colaborador={colaborador} tipoInicial={emitindo} aoFechar={() => setEmitindo(null)} />}
    </>
  )
}
