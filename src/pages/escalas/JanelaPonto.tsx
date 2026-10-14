import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { usePermissoes } from '../../lib/permissoes'
import { useNomesUsuarios } from '../../lib/hooks'
import { formatarData, formatarDataHora, formatarMinutos } from '../../lib/formatos'
import { horaCurta, minutosTrabalhados, resumoEscala } from '../../lib/ponto'
import { AreaTexto, Botao, Campo, Janela, Mensagem, mensagemErro } from '../../components/ui'
import { JanelaCancelar, SeloSituacao } from '../../components/registros'
import { nomeCurto, type Escala, type Pessoa, type RegistroPonto } from './dados'

/** Lançar ou ajustar a marcação de ponto de um dia; aprovar ou cancelar. */
export default function JanelaPonto({
  pessoa,
  data,
  registro,
  escala,
  aoFechar,
}: {
  pessoa: Pessoa
  data: string
  registro: RegistroPonto | null
  escala: Escala | null
  aoFechar: () => void
}) {
  const qc = useQueryClient()
  const { pode } = usePermissoes()
  const nome = useNomesUsuarios()
  const [entrada, setEntrada] = useState(horaCurta(registro?.entrada))
  const [saidaIntervalo, setSaidaIntervalo] = useState(horaCurta(registro?.saida_intervalo))
  const [voltaIntervalo, setVoltaIntervalo] = useState(horaCurta(registro?.volta_intervalo))
  const [saida, setSaida] = useState(horaCurta(registro?.saida))
  const [justificativa, setJustificativa] = useState(registro?.justificativa ?? '')
  const [cancelando, setCancelando] = useState(false)

  const podeSalvar = registro ? pode('ponto', 'editar') : pode('ponto', 'criar')
  const previa = entrada ? minutosTrabalhados({ entrada, saida_intervalo: saidaIntervalo || null, volta_intervalo: voltaIntervalo || null, saida: saida || null }) : null
  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['ponto'] })
    qc.invalidateQueries({ queryKey: ['fechamentos-ponto'] })
  }

  const preencherComEscala = () => {
    if (!escala?.hora_inicio || !escala.hora_fim) return
    setEntrada(horaCurta(escala.hora_inicio))
    setSaida(horaCurta(escala.hora_fim))
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!entrada) throw new Error('Informe o horário de entrada.')
      if (!!saidaIntervalo !== !!voltaIntervalo) throw new Error('Preencha a saída e a volta do intervalo (ou deixe as duas vazias).')
      const dados = {
        entrada,
        saida_intervalo: saidaIntervalo || null,
        volta_intervalo: voltaIntervalo || null,
        saida: saida || null,
        justificativa: justificativa.trim() || null,
      }
      const { error } = registro
        ? await supabase.from('registros_ponto').update(dados).eq('id', registro.id)
        : await supabase.from('registros_ponto').insert({ ...dados, colaborador_id: pessoa.id, data })
      if (error) throw error
    },
    onSuccess: () => {
      atualizar()
      aoFechar()
    },
  })

  const mudar = useMutation({
    mutationFn: async (dados: Partial<RegistroPonto>) => {
      const { error } = await supabase.from('registros_ponto').update(dados).eq('id', registro!.id)
      if (error) throw error
    },
    onSuccess: () => {
      atualizar()
      setCancelando(false)
      aoFechar()
    },
  })

  const aprovavel = registro?.situacao === 'registrada' && !!registro.saida && pode('ponto', 'aprovar')

  return (
    <>
      <Janela
        aberta={!cancelando}
        aoFechar={aoFechar}
        titulo={`Ponto · ${nomeCurto(pessoa)} · ${formatarData(data)}`}
        rodape={
          <>
            {registro && pode('ponto', 'cancelar') && (
              <Botao variante="perigo" className="mr-auto" onClick={() => setCancelando(true)}>Cancelar marcação</Botao>
            )}
            <Botao variante="secundario" onClick={aoFechar}>Fechar</Botao>
            {aprovavel && (
              <Botao variante="secundario" carregando={mudar.isPending} onClick={() => mudar.mutate({ situacao: 'aprovada' })}>
                Aprovar
              </Botao>
            )}
            {podeSalvar && <Botao type="submit" form="form-ponto" carregando={salvar.isPending}>Salvar</Botao>}
          </>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-600">Escala: <b className="text-acqua-titulo">{escala ? [escala.turno, resumoEscala(escala)].filter(Boolean).join(' · ') : 'sem escala'}</b></span>
          {escala?.tipo === 'turno' && podeSalvar && (
            <button type="button" className="link text-xs" onClick={preencherComEscala}>Preencher com a escala</button>
          )}
        </div>
        <form
          id="form-ponto"
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            salvar.mutate()
          }}
        >
          <Campo rotulo="Entrada" type="time" value={entrada} disabled={!podeSalvar} onChange={(e) => setEntrada(e.target.value)} required />
          <Campo rotulo="Saída" type="time" value={saida} disabled={!podeSalvar} onChange={(e) => setSaida(e.target.value)} ajuda="Vazio se ainda está trabalhando." />
          <Campo rotulo="Saída p/ intervalo" type="time" value={saidaIntervalo} disabled={!podeSalvar} onChange={(e) => setSaidaIntervalo(e.target.value)} />
          <Campo rotulo="Volta do intervalo" type="time" value={voltaIntervalo} disabled={!podeSalvar} onChange={(e) => setVoltaIntervalo(e.target.value)} />
          <AreaTexto
            rotulo="Justificativa / observação"
            className="col-span-2"
            value={justificativa}
            disabled={!podeSalvar}
            onChange={(e) => setJustificativa(e.target.value)}
            ajuda="Ex.: esqueceu de marcar, ajuste combinado, saída antecipada autorizada."
          />
        </form>
        <div className="mt-3 space-y-1 text-sm">
          {previa !== null && <p>Trabalhado: <b>{formatarMinutos(previa)}</b></p>}
          {registro && (
            <>
              <p>Situação: <SeloSituacao situacao={registro.situacao} /></p>
              <p className="text-xs text-slate-500">Lançado por {nome(registro.criado_por)}</p>
              {registro.aprovado_por && (
                <p className="text-xs text-slate-500">Aprovado por {nome(registro.aprovado_por)} em {formatarDataHora(registro.aprovado_em)}</p>
              )}
              {registro.situacao === 'aprovada' && podeSalvar && (
                <p className="text-xs text-amber-800">Se mudar os horários, a marcação volta para aprovação.</p>
              )}
            </>
          )}
          {!!(salvar.error || mudar.error) && <Mensagem tipo="erro">{mensagemErro(salvar.error || mudar.error)}</Mensagem>}
        </div>
      </Janela>
      <JanelaCancelar
        aberta={cancelando}
        titulo="Cancelar marcação de ponto"
        carregando={mudar.isPending}
        erro={mudar.error}
        aoFechar={() => setCancelando(false)}
        aoConfirmar={(motivo) => mudar.mutate({ situacao: 'cancelada', motivo_cancelamento: motivo })}
      />
    </>
  )
}
