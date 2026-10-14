import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ListPlus, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarMoeda } from '../../lib/formatos'
import { MOTIVOS_AJUSTE } from '../../lib/cafe'
import { AreaTexto, Botao, Campo, Cartao, Janela, Mensagem, Selecao, Tabela, Vazio, cx, mensagemErro } from '../../components/ui'
import { JanelaCancelar, SeloSituacao } from '../../components/registros'
import type { Ajuste } from './dados'

const rotuloMotivo = (m: string) => MOTIVOS_AJUSTE.find((x) => x.valor === m)?.rotulo ?? m

/** "Por fora da lista": apartamentos a mais ou a menos em relação à lista do hotel. */
export default function Ajustes({
  data,
  lista,
  valorCafe,
  autorizadores,
  travado,
}: {
  data: string
  lista: Ajuste[]
  valorCafe: number
  autorizadores: string[]
  travado: boolean
}) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const [novo, setNovo] = useState(false)
  const [aberto, setAberto] = useState<Ajuste | null>(null)

  const cancelar = useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase.from('cafe_ajustes').update({ situacao: 'cancelado', motivo_cancelamento: motivo }).eq('id', aberto!.id)
      if (error) throw error
    },
    onSuccess: () => {
      setAberto(null)
      qc.invalidateQueries({ queryKey: ['cafe_ajustes'] })
    },
  })

  const validos = lista.filter((a) => a.situacao !== 'cancelado')
  const total = validos.reduce((s, a) => s + Number(a.total), 0)

  return (
    <Cartao
      titulo={<span className="flex items-center gap-2"><ListPlus className="h-5 w-5 text-acqua-dourado" /> Por fora da lista</span>}
      acoes={
        !travado && pode('cafes', 'criar') && (
          <Botao variante="secundario" icone={<Plus className="h-4 w-4" />} onClick={() => setNovo(true)} disabled={!valorCafe}>
            Ajuste
          </Botao>
        )
      }
    >
      {lista.length === 0 ? (
        <Vazio>Nenhum apartamento fora da lista neste dia.</Vazio>
      ) : (
        <>
          <Tabela
            linhas={lista}
            chave={(a) => a.id}
            aoClicar={setAberto}
            colunas={[
              { titulo: 'Apto', celula: (a) => <b>{a.apartamento}</b> },
              { titulo: 'Motivo', celula: (a) => rotuloMotivo(a.motivo) + (a.autorizado_por ? ` · ${a.autorizado_por}` : '') },
              { titulo: 'Pessoas', celula: (a) => a.quantidade },
              {
                titulo: 'Valor',
                celula: (a) =>
                  a.situacao === 'cancelado' ? (
                    <SeloSituacao situacao="cancelado" />
                  ) : (
                    <span className={cx('font-semibold tabular-nums', a.total < 0 && 'text-red-700')}>{formatarMoeda(a.total)}</span>
                  ),
              },
            ]}
          />
          <p className="mt-2 text-right text-sm text-slate-600">
            Saldo do dia: <b className={cx(total < 0 && 'text-red-700')}>{formatarMoeda(total)}</b>
          </p>
        </>
      )}

      {novo && (
        <NovoAjuste
          data={data}
          valorCafe={valorCafe}
          autorizadores={autorizadores}
          aoFechar={() => setNovo(false)}
          aoSalvar={() => {
            setNovo(false)
            qc.invalidateQueries({ queryKey: ['cafe_ajustes'] })
          }}
        />
      )}
      {aberto && (
        <JanelaCancelar
          aberta={pode('cafes', 'cancelar') && !travado && aberto.situacao !== 'cancelado'}
          titulo={`Cancelar ajuste do apto ${aberto.apartamento}`}
          aviso={`${rotuloMotivo(aberto.motivo)} — ${formatarMoeda(aberto.total)}. Lançado por ${nome(aberto.criado_por)}. ${aberto.descricao ?? ''}`}
          carregando={cancelar.isPending}
          erro={cancelar.error}
          aoFechar={() => setAberto(null)}
          aoConfirmar={(m) => cancelar.mutate(m)}
        />
      )}
    </Cartao>
  )
}

function NovoAjuste({
  data,
  valorCafe,
  autorizadores,
  aoFechar,
  aoSalvar,
}: {
  data: string
  valorCafe: number
  autorizadores: string[]
  aoFechar: () => void
  aoSalvar: () => void
}) {
  const [apartamento, setApartamento] = useState('')
  const [hospede, setHospede] = useState('')
  const [motivo, setMotivo] = useState('fora_da_ventilacao')
  const [pessoas, setPessoas] = useState('1')
  const [autorizado, setAutorizado] = useState('')
  const [descricao, setDescricao] = useState('')
  const sinal = MOTIVOS_AJUSTE.find((m) => m.valor === motivo)?.sinal ?? 1
  const qtd = Math.max(1, Number(pessoas) || 1) * sinal

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('cafe_ajustes').insert({
        data,
        apartamento: apartamento.trim(),
        hospede: hospede.trim() || null,
        quantidade: qtd,
        valor_unitario: valorCafe,
        motivo,
        autorizado_por: autorizado.trim() || null,
        descricao: descricao.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: aoSalvar,
  })

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo="Ajuste por fora da lista"
      rodape={
        <>
          <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-ajuste" carregando={salvar.isPending}>Salvar</Botao>
        </>
      }
    >
      <form
        id="form-ajuste"
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          salvar.mutate()
        }}
      >
        <Campo rotulo="Apartamento" value={apartamento} onChange={(e) => setApartamento(e.target.value)} required autoFocus />
        <Campo rotulo="Pessoas" type="number" min={1} value={pessoas} onChange={(e) => setPessoas(e.target.value)} required />
        <Selecao rotulo="Motivo" className="sm:col-span-2" value={motivo} onChange={(e) => setMotivo(e.target.value)} opcoes={MOTIVOS_AJUSTE} />
        <Campo rotulo="Hóspede(s)" value={hospede} onChange={(e) => setHospede(e.target.value)} placeholder="Opcional" />
        <div>
          <Campo
            rotulo="Liberado por"
            value={autorizado}
            onChange={(e) => setAutorizado(e.target.value)}
            list="autorizadores-cafe"
            required={motivo === 'liberado_gestor'}
            placeholder={motivo === 'liberado_gestor' ? 'Obrigatório' : 'Opcional'}
          />
          <datalist id="autorizadores-cafe">
            {autorizadores.map((a) => <option key={a} value={a} />)}
          </datalist>
        </div>
        <AreaTexto
          rotulo="Descrição"
          className="sm:col-span-2"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          required={motivo === 'outro'}
          placeholder="Ex.: 2 na lista e 1 na ventilação; recepção confirmou"
        />
        <p className={cx('text-sm sm:col-span-2', sinal < 0 ? 'text-red-700' : 'text-acqua-titulo')}>
          {sinal < 0 ? 'Desconta' : 'Cobra do hotel'}: <b>{formatarMoeda(qtd * valorCafe)}</b> ({Math.abs(qtd)} × {formatarMoeda(valorCafe)})
        </p>
        {salvar.error && <div className="sm:col-span-2"><Mensagem tipo="erro">{mensagemErro(salvar.error)}</Mensagem></div>}
      </form>
    </Janela>
  )
}
