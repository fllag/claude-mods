// /semana abre um painel com os compromissos (Google Agenda) e as tarefas
// (Basecamp) da semana, de domingo a sábado: a de hoje, ou outra com
// `/semana proxima`, `anterior`, `+2` ou `-3`. No app desktop o painel é um SVG
// na identidade da Hospedin; no terminal, que não desenha SVG, vira texto.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Conclusoes, Semana } from '../types'
import {
  caminhoSalvo,
  comoConclusoes,
  comoCriadores,
  comoDonos,
  contaDoBasecamp,
  conversasDaSemana,
  dataLocal,
  DIAS_NA_JANELA,
  domingoDa,
  escoposDoBasecamp,
  EVENTOS_NA_PRIMEIRA_LEITURA,
  EVENTOS_POR_LEITURA,
  FILTRO_DA_LINHA_DO_TEMPO,
  FILTRO_DO_CRIADOR,
  FILTRO_DO_DONO,
  juntarGuardados,
  lerConclusoes,
  lerCriador,
  lerDeslocamento,
  lerDono,
  montarSemana,
  normalizarEventos,
  normalizarTarefas,
  normalizarUpNext,
  pessoaDoBasecamp,
  precisaDoHistorico,
  primeiroNome,
  SEMANAS_DO_RITMO,
  SEMANAS_PARA_FRENTE,
  semanaDeColaboracao,
  servidoresDaAgenda,
  somarDias,
  tarefasDoTotal,
  textoDoResultado,
} from './dados'
import {
  colaboracaoEmLinhas,
  desenharSemana,
  diasEmLinhas,
  hojeEmLinhas,
  origensEmLinhas,
  periodoDaSemana,
  resumoEmTexto,
  tituloDaSemana,
} from './painel'

const PAINEL = 'semana'
const QUINZE_MINUTOS = 15 * 60_000
// Avanço de uma célula da fonte de código do app: converte colunas em pixels.
const PIXELS_POR_COLUNA = 7.8

const semana = atom({ plugin: 'semana', key: 'semana' } as const, null)
const carregando = atom({ plugin: 'semana', key: 'carregando' } as const, false)
const deslocamento = atom({ plugin: 'semana', key: 'deslocamento' } as const, 0)

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

/** Os eventos dos 7 dias a partir de `domingo`. */
async function buscarAgenda($: EngineInterface, domingo: string, hoje: string): Promise<unknown> {
  const ferramentas = await $.tool.list().catch(() => [])
  const salvo = await $.store.get('servidorAgenda')

  const candidatos = servidoresDaAgenda(ferramentas.map(t => t.name), salvo)
  const falhas: string[] = []

  const dias = Array.from({ length: DIAS_NA_JANELA }, (_, i) => somarDias(domingo, i))
  // Hoje, ou o domingo de outra semana, primeiro e sozinho: se o Claude Code
  // pedir permissão, pede uma vez só.
  const inicial = dias.includes(hoje) ? hoje : domingo

  for (const servidor of candidatos) {
    const primeiro = await eventosDoDia($, servidor, inicial).catch((erro: unknown) => {
      falhas.push(`${servidor}: ${erro instanceof Error ? erro.message : String(erro)}`)
      return null
    })
    if (primeiro === null) continue
    if (servidor !== salvo) await $.store.set('servidorAgenda', servidor)

    const outros = dias.filter(dia => dia !== inicial)
    const resto = await Promise.all(outros.map(dia => eventosDoDia($, servidor, dia)))
    return { events: [...primeiro, ...resto.flat()] }
  }
  // O motivo de cada tentativa vai para o aviso: é o que permite consertar.
  throw new Error(falhas.join(' | ') || 'nenhum conector de agenda encontrado')
}

/** Os eventos da linha do tempo, ou por que não vieram. */
type LinhaDoTempo = { eventos: unknown[] } | { motivo: string }

/** Quanto esperar antes de cada nova tentativa de ler a linha do tempo. */
const ESPERAS_DA_LINHA_DO_TEMPO = [2_000, 5_000]

/**
 * Uma leitura da linha do tempo. Com --agent a CLI escreve o erro na saída
 * normal, às vezes saindo com 0: só vale uma lista.
 */
function lerLinhaDoTempo($: EngineInterface, bin: string, limite: number): Promise<LinhaDoTempo> {
  const argv = [bin, 'timeline', 'me', '--limit', String(limite), '--agent', '--jq', FILTRO_DA_LINHA_DO_TEMPO]
  const resumo = (texto: string) => texto.trim().split('\n')[0]?.slice(0, 120) ?? ''
  return $.process.run(argv, { timeoutMs: 60_000 }).then(
    (r): LinhaDoTempo => {
      let dados: unknown = null
      try {
        dados = JSON.parse(r.stdout)
      } catch {}
      if (r.exitCode === 0 && Array.isArray(dados)) return { eventos: dados }
      const erro = (dados as { error?: unknown } | null)?.error
      return { motivo: (typeof erro === 'string' ? resumo(erro) : '') || resumo(r.stderr) || resumo(r.stdout) || `saiu com código ${r.exitCode}` }
    },
    (erro: unknown) => ({ motivo: resumo(erro instanceof Error ? erro.message : String(erro)) }),
  )
}

type RespostasDoBasecamp = {
  pendentes: unknown[]
  concluidas: unknown
  upNext: unknown
  linhaDoTempo: LinhaDoTempo
  eu: unknown
  /** Eu como pessoa da conta, que é quem aparece como criador. */
  pessoa: unknown
  /** O caminho da CLI que respondeu, para as leituras seguintes; null se nenhuma. */
  bin: string | null
}

// Os avisos dizem o que fazer: quem instala o mod pode não ter nada configurado.
const AVISO_BASECAMP_AUSENTE =
  'Não achei a CLI do Basecamp. Instale o plugin basecamp@37signals e rode basecamp auth login.'
const AVISO_BASECAMP_SEM_LOGIN = 'Não consegui ler o Basecamp. Rode basecamp auth login e tente de novo.'

/**
 * Pendentes dos `escopos`, concluídas, o Up next, a linha do tempo (de onde
 * sai a data em que cada tarefa foi concluída) e quem está logado, tudo de uma
 * vez. A linha do tempo é lenta: `limite` diz quantos eventos pedir.
 */
async function buscarTarefas($: EngineInterface, limite: number, escopos: readonly string[]): Promise<RespostasDoBasecamp> {
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
    const [eu, pessoa, concluidas, upNext, linhaDoTempo, ...pendentes] = await Promise.all([
      rodar([bin, 'me', '--json']),
      rodar([bin, 'people', 'show', 'me', '--json']),
      rodar([bin, 'assignments', 'completed', '--json']),
      rodar([bin, 'assignments', 'list', '--json']),
      lerLinhaDoTempo($, bin, limite),
      ...escopos.map(escopo => rodar([bin, 'assignments', 'due', escopo, '--json'])),
    ])
    if (!pendentes.some(r => r !== null)) continue
    // A linha do tempo é a leitura mais longa e a que mais falha de passagem
    // (rede, API do Basecamp): com a CLI respondendo, vale tentar de novo.
    let linha = linhaDoTempo
    for (const espera of ESPERAS_DA_LINHA_DO_TEMPO) {
      if ('eventos' in linha) break
      await $.clock.sleep(espera)
      linha = await lerLinhaDoTempo($, bin, limite)
    }
    return { pendentes, concluidas, upNext, linhaDoTempo: linha, eu, pessoa, bin }
  }
  throw new Error(achouCli ? AVISO_BASECAMP_SEM_LOGIN : AVISO_BASECAMP_AUSENTE)
}

/** Quantos `basecamp show` rodam ao mesmo tempo. */
const LEITURAS_SIMULTANEAS = 8

/** O que abrir item a item e onde guardar o que se leu. */
type Abertura<T> = {
  /** A chave no armazenamento. */
  chave: string
  filtro: string
  ler: (resposta: unknown) => T | null
  como: (valor: unknown) => Record<string, T>
}

/** Quem criou cada tarefa: as listas do Basecamp não trazem o criador. */
const CRIADORES = { chave: 'criadores', filtro: FILTRO_DO_CRIADOR, ler: lerCriador, como: comoCriadores }

/** De quem é cada conversa comentada: a linha do tempo só diz o id. */
const DONOS = { chave: 'donos', filtro: FILTRO_DO_DONO, ler: lerDono, como: comoDonos }

/**
 * Abre cada item com `basecamp show` uma vez e guarda o que leu, por id: quem
 * criou não muda, e o responsável raramente. O que falhar fica de fora e é
 * tentado de novo na próxima leitura.
 */
async function abrirCadaUm<T>($: EngineInterface, bin: string, ids: number[], a: Abertura<T>): Promise<Record<string, T>> {
  const salvos = a.como(await $.store.get(a.chave))
  const faltam = [...new Set(ids)].filter(id => salvos[String(id)] === undefined)
  if (faltam.length === 0) return salvos

  const novos: Record<string, T> = {}
  let proximo = 0
  const ler = async () => {
    while (proximo < faltam.length) {
      const id = faltam[proximo++] as number
      const lido = await $.process
        .run([bin, 'show', String(id), '--jq', a.filtro], { timeoutMs: 20_000 })
        .then(r => (r.exitCode === 0 ? a.ler(JSON.parse(r.stdout)) : null))
        .catch(() => null)
      if (lido !== null) novos[String(id)] = lido
    }
  }
  await Promise.all(Array.from({ length: Math.min(LEITURAS_SIMULTANEAS, faltam.length) }, ler))

  const todos = juntarGuardados(salvos, novos)
  if (Object.keys(novos).length > 0) await $.store.set(a.chave, todos)
  return todos
}

/** A semana `semanas` semanas depois da de hoje: 0 é a de hoje. */
async function carregarSemana($: EngineInterface, semanas: number): Promise<Semana> {
  const agoraMs = await $.clock.now()
  const hoje = dataLocal(agoraMs)
  const domingo = somarDias(domingoDa(hoje), 7 * semanas)
  const avisos: string[] = []
  // As conclusões já lidas ficam guardadas: depois da primeira leitura, basta
  // pedir à linha do tempo os eventos mais recentes.
  const salvas = comoConclusoes(await $.store.get('conclusoes'))
  const limite = precisaDoHistorico(salvas, hoje) ? EVENTOS_NA_PRIMEIRA_LEITURA : EVENTOS_POR_LEITURA

  const [agenda, tarefas] = await Promise.all([
    buscarAgenda($, domingo, hoje).catch((erro: unknown) => {
      const motivo = (erro instanceof Error ? erro.message : String(erro)).slice(0, 200)
      avisos.push(`Não consegui ler a agenda. Confira se o Google Calendar está conectado no claude.ai (${motivo}).`)
      return null
    }),
    buscarTarefas($, limite, escoposDoBasecamp(semanas)).catch((erro: unknown): RespostasDoBasecamp => {
      avisos.push(erro instanceof Error ? erro.message : AVISO_BASECAMP_SEM_LOGIN)
      return { pendentes: [], concluidas: null, upNext: null, linhaDoTempo: { motivo: '' }, eu: null, pessoa: null, bin: null }
    }),
  ])

  let conclusoes: Conclusoes | undefined
  const linha = tarefas.linhaDoTempo
  if ('eventos' in linha) {
    conclusoes = lerConclusoes(salvas, linha.eventos, limite, hoje)
    await $.store.set('conclusoes', conclusoes)
  } else if (tarefas.bin !== null) {
    // Sem a linha do tempo de agora, valem as conclusões da última leitura:
    // só as mais recentes ficam para a próxima.
    conclusoes = salvas
    avisos.push(
      salvas === undefined
        ? `Não consegui ler a linha do tempo do Basecamp (${linha.motivo}); as concluídas contam pela data de vencimento.`
        : `Não consegui atualizar a linha do tempo do Basecamp (${linha.motivo}); as concluídas mais recentes entram na próxima atualização.`,
    )
  }

  const entrada = {
    agoraMs,
    deslocamento: semanas,
    eventos: normalizarEventos(agenda),
    tarefas: normalizarTarefas(tarefas.pendentes),
    concluidas: normalizarTarefas([tarefas.concluidas]),
    conclusoes,
    upNext: normalizarUpNext(tarefas.upNext),
    avisos,
    contaBasecamp: contaDoBasecamp(tarefas.pendentes),
    nome: primeiroNome(tarefas.eu),
    eu: pessoaDoBasecamp(tarefas.pessoa),
  }
  // Primeiro a semana sem criadores, para saber quais tarefas formam o total;
  // depois, com quem criou cada uma e de quem é cada conversa comentada. Uma
  // abertura depois da outra, para não abrir itens demais de uma vez.
  if (tarefas.bin === null) return montarSemana(entrada)
  const ids = tarefasDoTotal(montarSemana(entrada)).map(t => t.tarefa.id)
  const criadores = await abrirCadaUm($, tarefas.bin, ids, CRIADORES)
  const domingoDaColaboracao = conclusoes === undefined ? null : semanaDeColaboracao(hoje, semanas, conclusoes.cobertura)
  const conversas = domingoDaColaboracao === null ? [] : conversasDaSemana(conclusoes?.comentarios ?? {}, domingoDaColaboracao)
  const donos = await abrirCadaUm($, tarefas.bin, conversas, DONOS)
  return montarSemana({ ...entrada, criadores, donos })
}

// As leituras em curso, por semana: quem pede a mesma semana espera a mesma
// leitura, e quem pede outra não fica com a resposta da anterior.
const leituras = new Map<number, Promise<Semana>>()

/** Relê a semana que o painel mostra e a põe no painel. */
async function atualizar($: EngineInterface): Promise<Semana> {
  const semanas = await read($, deslocamento)
  const emCurso = leituras.get(semanas)
  if (emCurso !== undefined) return emCurso

  const leitura = carregarSemana($, semanas)
  leituras.set(semanas, leitura)
  try {
    await update($, carregando, () => true)
    const nova = await leitura
    // Enquanto lia, um /semana pode ter pedido outra semana: essa fica de fora do painel.
    if ((await read($, deslocamento)) === semanas) await update($, semana, () => nova)
    // Ao abrir, a sessão mostra a última leitura da semana de hoje, que é a do /semana.
    if (semanas === 0) await $.store.set('ultimaSemana', nova)
    return nova
  } finally {
    leituras.delete(semanas)
    await update($, carregando, () => leituras.size > 0)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'semana',
      description: 'Abre o painel com seus compromissos e tarefas da semana',
      argumentHint: '[proxima | anterior | +N | -N]',
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

  on('command.run', { command: 'semana' }, async ($, e) => {
    const semanas = lerDeslocamento(e.args)
    if (semanas === null) {
      return { text: `Não entendi "${e.args.trim()}". Use /semana, /semana proxima, /semana anterior ou /semana +2.` }
    }
    if (semanas < -SEMANAS_DO_RITMO || semanas > SEMANAS_PARA_FRENTE) {
      return {
        text: `Dá para ver até ${SEMANAS_DO_RITMO} semanas para trás e ${SEMANAS_PARA_FRENTE} para frente.`,
      }
    }

    await update($, deslocamento, () => semanas)
    const aberto = await $.ui.open({ id: PAINEL, title: 'Semana' })
    const lida = await atualizar($)
    const painel = aberto.isPlaced ? [] : [`O painel não abriu: ${aberto.reason}`]

    return {
      text: [resumoEmTexto(lida), ...lida.avisos, ...painel].join(' '),
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
      // Na semana de hoje, o que fazer hoje; em outra, um resumo de cada dia.
      const linhas = atual.deslocamento ? diasEmLinhas(atual) : hojeEmLinhas(atual)
      return (
        <Box flexDirection="column">
          <Text bold color="#765AA6">
            {tituloDaSemana(atual.nome)} · {periodoDaSemana(atual)}
          </Text>
          <Text dimColor>{resumoEmTexto(atual)}</Text>
          {[...linhas, ...origensEmLinhas(atual), ...colaboracaoEmLinhas(atual)].map(linha => (
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
    const { svg } = desenharSemana(atual, {
      largura: e.props.bodyColumns * PIXELS_POR_COLUNA,
      titulo: tituloDaSemana(atual.nome),
    })
    return (
      <Box flexDirection="column">
        {/* Como imagem: no quadro interativo o app usa um tamanho padrão pequeno e encolhe o desenho. */}
        <Svg source={svg} alt={resumoEmTexto(atual)} />
        {acoes}
      </Box>
    )
  })
}
