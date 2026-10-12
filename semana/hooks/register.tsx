// /semana abre um painel com os compromissos (Google Agenda) e as tarefas
// (Basecamp) da semana, de domingo a sábado. No app desktop o painel é um SVG na
// identidade da Hospedin; no terminal, que não desenha SVG, vira texto.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Conclusoes, Semana } from '../types'
import {
  caminhoSalvo,
  comoConclusoes,
  contaDoBasecamp,
  dataLocal,
  DIAS_NA_JANELA,
  domingoDa,
  ESCOPOS_BASECAMP,
  EVENTOS_NA_PRIMEIRA_LEITURA,
  EVENTOS_POR_LEITURA,
  lerConclusoes,
  montarSemana,
  normalizarEventos,
  normalizarTarefas,
  normalizarUpNext,
  precisaDoHistorico,
  servidoresDaAgenda,
  somarDias,
  textoDoResultado,
} from './dados'
import { desenharSemana, hojeEmLinhas, periodo, resumoEmTexto } from './painel'

const PAINEL = 'semana'
const TITULO = 'Sua semana'
const QUINZE_MINUTOS = 15 * 60_000
// Avanço de uma célula da fonte de código do app: converte colunas em pixels.
const PIXELS_POR_COLUNA = 7.8

const semana = atom({ plugin: 'semana', key: 'semana' } as const, null)
const carregando = atom({ plugin: 'semana', key: 'carregando' } as const, false)

type PaginaDaAgenda = { events?: unknown[]; nextPageToken?: string }

/**
 * Os eventos de um dia, em páginas pequenas: o Claude Code troca uma resposta
 * grande demais por um aviso com o arquivo onde a guardou, e aí lemos o arquivo.
 */
async function eventosDoDia($: EngineInterface, servidor: string, dia: string): Promise<unknown[]> {
  const eventos: unknown[] = []
  let pageToken: string | undefined
  for (let pagina = 0; pagina < 10; pagina++) {
    const resultado = await $.mcp.call(servidor, 'list_events', {
      startTime: `${dia}T00:00:00`,
      endTime: `${somarDias(dia, 1)}T00:00:00`,
      orderBy: 'startTime',
      pageSize: 15,
      ...(pageToken === undefined ? {} : { pageToken }),
    })
    if (resultado.isError) throw new Error(textoDoResultado(resultado).slice(0, 200) || 'list_events falhou')
    const texto = textoDoResultado(resultado)
    const arquivo = caminhoSalvo(texto)
    const dados = JSON.parse(arquivo === null ? texto : await $.fs.read(arquivo)) as PaginaDaAgenda
    eventos.push(...(dados.events ?? []))
    pageToken = dados.nextPageToken
    if (pageToken === undefined) break
  }
  return eventos
}

async function buscarAgenda($: EngineInterface, hoje: string): Promise<unknown> {
  const ferramentas = await $.tool.list().catch(() => [])
  const salvo = await $.store.get('servidorAgenda')

  const candidatos = servidoresDaAgenda(ferramentas.map(t => t.name), salvo)
  const falhas: string[] = []

  for (const servidor of candidatos) {
    // Hoje primeiro, sozinho: se o Claude Code pedir permissão, pede uma vez só.
    const primeiro = await eventosDoDia($, servidor, hoje).catch((erro: unknown) => {
      falhas.push(`${servidor}: ${erro instanceof Error ? erro.message : String(erro)}`)
      return null
    })
    if (primeiro === null) continue
    if (servidor !== salvo) await $.store.set('servidorAgenda', servidor)

    const domingo = domingoDa(hoje)
    const outros = Array.from({ length: DIAS_NA_JANELA }, (_, i) => somarDias(domingo, i)).filter(dia => dia !== hoje)
    const resto = await Promise.all(outros.map(dia => eventosDoDia($, servidor, dia)))
    return { events: [...primeiro, ...resto.flat()] }
  }
  // O motivo de cada tentativa vai para o aviso: é o que permite consertar.
  throw new Error(falhas.join(' | ') || 'nenhum conector de agenda encontrado')
}

type RespostasDoBasecamp = { pendentes: unknown[]; concluidas: unknown; upNext: unknown; linhaDoTempo: unknown }

// Os avisos dizem o que fazer: quem instala o mod pode não ter nada configurado.
const AVISO_BASECAMP_AUSENTE =
  'Não achei a CLI do Basecamp. Instale o plugin basecamp@37signals e rode basecamp auth login.'
const AVISO_BASECAMP_SEM_LOGIN = 'Não consegui ler o Basecamp. Rode basecamp auth login e tente de novo.'

/**
 * Pendentes, concluídas, o Up next e a linha do tempo (de onde sai a data em
 * que cada tarefa foi concluída), tudo de uma vez. A linha do tempo é lenta:
 * `limite` diz quantos eventos pedir.
 */
async function buscarTarefas($: EngineInterface, limite: number): Promise<RespostasDoBasecamp> {
  const home = await $.env.get('HOME')
  const caminhos = [
    'basecamp',
    ...(home === undefined ? [] : [`${home}/.local/bin/basecamp`]),
    '/opt/homebrew/bin/basecamp',
  ]

  // O run rejeita quando o comando nem inicia: separa "não instalada" de "sem login".
  let achouCli = false
  const rodar = (argv: string[]) =>
    $.process
      .run(argv, { timeoutMs: 60_000 })
      .then(r => {
        achouCli = true
        return r.exitCode === 0 ? (JSON.parse(r.stdout) as unknown) : null
      })
      .catch(() => null)

  for (const bin of caminhos) {
    const [concluidas, upNext, linhaDoTempo, ...pendentes] = await Promise.all([
      rodar([bin, 'assignments', 'completed', '--json']),
      rodar([bin, 'assignments', 'list', '--json']),
      rodar([bin, 'timeline', 'me', '--limit', String(limite), '--agent', '--jq', '[.[] | {kind, created_at, url}]']),
      ...ESCOPOS_BASECAMP.map(escopo => rodar([bin, 'assignments', 'due', escopo, '--json'])),
    ])
    if (pendentes.some(r => r !== null)) return { pendentes, concluidas, upNext, linhaDoTempo }
  }
  throw new Error(achouCli ? AVISO_BASECAMP_SEM_LOGIN : AVISO_BASECAMP_AUSENTE)
}

async function carregarSemana($: EngineInterface): Promise<Semana> {
  const agoraMs = await $.clock.now()
  const hoje = dataLocal(agoraMs)
  const avisos: string[] = []
  // As conclusões já lidas ficam guardadas: depois da primeira leitura, basta
  // pedir à linha do tempo os eventos mais recentes.
  const salvas = comoConclusoes(await $.store.get('conclusoes'))
  const limite = precisaDoHistorico(salvas, hoje) ? EVENTOS_NA_PRIMEIRA_LEITURA : EVENTOS_POR_LEITURA

  const [agenda, tarefas] = await Promise.all([
    buscarAgenda($, hoje).catch((erro: unknown) => {
      const motivo = (erro instanceof Error ? erro.message : String(erro)).slice(0, 200)
      avisos.push(`Não consegui ler a agenda. Confira se o Google Calendar está conectado no claude.ai (${motivo}).`)
      return null
    }),
    buscarTarefas($, limite).catch((erro: unknown): RespostasDoBasecamp => {
      avisos.push(erro instanceof Error ? erro.message : AVISO_BASECAMP_SEM_LOGIN)
      return { pendentes: [], concluidas: null, upNext: null, linhaDoTempo: null }
    }),
  ])

  let conclusoes: Conclusoes | undefined
  if (Array.isArray(tarefas.linhaDoTempo)) {
    conclusoes = lerConclusoes(salvas, tarefas.linhaDoTempo, limite, hoje)
    await $.store.set('conclusoes', conclusoes)
  } else if (tarefas.pendentes.length > 0) {
    avisos.push('Não consegui ler a linha do tempo do Basecamp; as concluídas contam pela data de vencimento.')
  }

  return montarSemana({
    agoraMs,
    eventos: normalizarEventos(agenda),
    tarefas: normalizarTarefas(tarefas.pendentes),
    concluidas: normalizarTarefas([tarefas.concluidas]),
    conclusoes,
    upNext: normalizarUpNext(tarefas.upNext),
    avisos,
    contaBasecamp: contaDoBasecamp(tarefas.pendentes),
  })
}

async function atualizar($: EngineInterface): Promise<Semana | null> {
  if (await read($, carregando)) return read($, semana)
  await update($, carregando, () => true)
  try {
    const nova = await carregarSemana($)
    await update($, semana, () => nova)
    await $.store.set('ultimaSemana', nova)
    return nova
  } finally {
    await update($, carregando, () => false)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'semana',
      description: 'Abre o painel com seus compromissos e tarefas da semana',
    })
    // A última leitura aparece na hora; a nova chega quando o painel abre.
    const salva = await $.store.get('ultimaSemana')
    if (salva !== undefined && salva !== null) await update($, semana, () => salva as Semana)

    $.clock.every(QUINZE_MINUTOS, async () => {
      const aberto = (await $.ui.panes()).some(p => p.id === PAINEL)
      if (aberto) await atualizar($)
    })

    return next(e)
  })

  on('command.run', { command: 'semana' }, async $ => {
    const aberto = await $.ui.open({ id: PAINEL, title: 'Semana' })
    const lida = await atualizar($)
    const painel = aberto.isPlaced ? [] : [`O painel não abriu: ${aberto.reason}`]

    return {
      text: [lida === null ? 'Painel da semana aberto.' : resumoEmTexto(lida), ...(lida?.avisos ?? []), ...painel].join(' '),
    }
  })

  on('ui.render', { component: 'Pane', requestId: PAINEL }, async ($, e) => {
    const atual = await read($, semana)
    const ocupado = await read($, carregando)
    const { Box, Text, Button, Link } = $.ui.resolve(e)

    // O app desktop não repassa o clique de um botão de mod (ui_press), então o
    // Atualizar só aparece no terminal; no app, /semana de novo atualiza.
    const acoes = (
      <Box flexDirection="row" gap={2} marginTop={1}>
        {e.surface === 'terminal' ? (
          <Button
            key="atualizar"
            label={ocupado ? 'Atualizando…' : 'Atualizar'}
            onPress={() => void atualizar($)}
          />
        ) : null}
        {atual?.contaBasecamp ? (
          <Link href={`https://app.basecamp.com/${atual.contaBasecamp}/my/assignments`} label="Basecamp" />
        ) : null}
        <Link href="https://calendar.google.com/calendar/r/week" label="Agenda" />
      </Box>
    )

    if (atual === null) {
      return (
        <Box flexDirection="column">
          <Text dimColor>{ocupado ? 'Lendo sua agenda e o Basecamp…' : 'Nada lido ainda.'}</Text>
          {acoes}
        </Box>
      )
    }

    if (e.surface === 'terminal') {
      const inicio = atual.dias[0]?.data ?? atual.hoje
      const fim = atual.dias.at(-1)?.data ?? atual.hoje
      return (
        <Box flexDirection="column">
          <Text bold color="#765AA6">
            {TITULO} · {periodo(inicio, fim)}
          </Text>
          <Text dimColor>{resumoEmTexto(atual)}</Text>
          {hojeEmLinhas(atual).map(linha => (
            <Text wrap="truncate-end">{linha}</Text>
          ))}
          {atual.avisos.map(aviso => (
            <Text color="#F06672">{aviso}</Text>
          ))}
          {acoes}
        </Box>
      )
    }

    const { Svg } = $.ui.resolve(e)
    const { svg } = desenharSemana(atual, { largura: e.props.bodyColumns * PIXELS_POR_COLUNA, titulo: TITULO })
    return (
      <Box flexDirection="column">
        {/* Como imagem: no quadro interativo o app usa um tamanho padrão pequeno e encolhe o desenho. */}
        <Svg source={svg} alt={resumoEmTexto(atual)} />
        {acoes}
      </Box>
    )
  })
}
