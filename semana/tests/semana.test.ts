import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import {
  comentariosPorConversa,
  deQuem,
  filtroDaConversa,
  importancia,
  juntarCriadores,
  lerChamados,
  lerConclusoes,
  lerConversa,
  lerDeslocamento,
  montarSemana,
  precisaAbrir,
  precisaDoHistorico,
  primeiroNome,
  semanaDeColaboracao,
  semMarcaDePrioridade,
} from '../hooks/dados'
import {
  alemDoRitmo,
  cargaDaSemana,
  desenharSemana,
  duracao,
  hojeEmLinhas,
  origensDaSemana,
  origensEmLinhas,
  tituloDaSemana,
} from '../hooks/painel'

// Terça, 13 de outubro de 2026, 10:15 no horário local.
const AGORA = new Date(2026, 9, 13, 10, 15).getTime()

const AGENDA = {
  events: [
    {
      summary: 'Planejamento',
      start: { dateTime: '2026-10-13T08:30:00-03:00' },
      end: { dateTime: '2026-10-13T10:00:00-03:00' },
    },
    {
      summary: '1:1 - Ana',
      start: { dateTime: '2026-10-13T14:00:00-03:00' },
      end: { dateTime: '2026-10-13T14:45:00-03:00' },
      attendees: [{ self: true, responseStatus: 'accepted' }, { email: 'ana@exemplo.com' }],
    },
    {
      summary: 'Recusada',
      start: { dateTime: '2026-10-14T09:00:00-03:00' },
      end: { dateTime: '2026-10-14T10:00:00-03:00' },
      attendees: [{ self: true, responseStatus: 'declined' }, { email: 'bia@exemplo.com' }],
    },
    {
      summary: 'Reunião com a diretoria',
      start: { dateTime: '2026-10-20T10:00:00-03:00' },
      end: { dateTime: '2026-10-20T11:00:00-03:00' },
      attendees: [{ self: true, responseStatus: 'accepted' }, { email: 'cris@exemplo.com' }],
    },
  ],
}

const URL_TAREFA = 'https://app.basecamp.com/123/buckets/1/todos/1'
const TAREFAS: Record<string, unknown[]> = {
  overdue: [{ id: 1, content: 'Revisão semanal', due_on: '2026-10-09', bucket: { name: 'Pessoal' }, app_url: URL_TAREFA }],
  due_today: [{ id: 2, content: 'Fechar proposta', due_on: '2026-10-13', bucket: { name: 'Comercial' }, app_url: URL_TAREFA }],
  due_tomorrow: [{ id: 3, content: 'Revisar contrato', due_on: '2026-10-14', bucket: { name: 'Jurídico' }, app_url: URL_TAREFA }],
  due_next_week: [
    { id: 4, content: 'Apresentar resultados', due_on: '2026-10-20', bucket: { name: 'Pessoal' }, app_url: URL_TAREFA },
    { id: 5, content: 'Renovar contrato', due_on: '2026-10-22', bucket: { name: 'Jurídico' }, app_url: URL_TAREFA },
  ],
  due_later: [{ id: 6, content: 'Planejar dezembro', due_on: '2026-11-03', bucket: { name: 'Pessoal' }, app_url: URL_TAREFA }],
}

// Feitas: duas desta semana e oito da semana passada (segunda a sexta).
const CONCLUIDAS = [
  { id: 10, content: 'Enviar relatório', due_on: '2026-10-13' },
  { id: 11, content: 'Pagar fornecedor', due_on: '2026-10-12' },
  ...['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-09', '2026-10-09', '2026-10-09'].map(
    (due_on, i) => ({ id: 20 + i, content: `Antiga ${i}`, due_on }),
  ),
]

// A linha do tempo diz quando cada uma foi concluída: aqui, no dia em que vencia.
const LINHA_DO_TEMPO = CONCLUIDAS.map(t => ({
  kind: 'todo_completed',
  created_at: `${t.due_on}T12:00:00`,
  url: `https://3.basecampapi.com/123/buckets/1/todos/${t.id}.json`,
}))

// Comentários meus na linha do tempo: cinco conversas nesta semana e duas na passada.
const comentario = (id: number, conversa: number, espaco: string, quando: string) => ({
  kind: 'comment_created',
  created_at: quando,
  url: `https://3.basecampapi.com/123/buckets/1/comments/${id}.json`,
  conversa,
  espaco,
})
const COMENTARIOS = [
  comentario(900, 100, 'Pessoal', '2026-10-12T10:00:00'),
  comentario(901, 100, 'Pessoal', '2026-10-13T09:00:00'),
  comentario(902, 101, 'Comercial', '2026-10-12T11:00:00'),
  comentario(903, 102, 'Financeiro', '2026-10-12T12:00:00'),
  comentario(904, 103, 'Comercial', '2026-10-13T08:00:00'),
  comentario(905, 104, 'Jurídico', '2026-10-11T15:00:00'),
  comentario(906, 102, 'Financeiro', '2026-10-07T10:00:00'),
  comentario(907, 105, 'Pessoal', '2026-10-06T10:00:00'),
]

// Conversas no chat dos projetos e o que publiquei, também da linha do tempo.
const API = 'https://3.basecampapi.com/123/buckets/2'
const chat = (id: number, chatId: number, espaco: string, quando: string) => ({
  kind: 'chat_transcript_rollup',
  created_at: quando,
  url: `${API}/chats/${chatId}.json`,
  id,
  espaco,
})
const publicou = (kind: string, caminho: string, quando: string) => ({ kind, created_at: quando, url: `${API}/${caminho}.json` })
const ATIVIDADES = [
  chat(7001, 50, 'Produto', '2026-10-12T15:00:00'),
  chat(7002, 50, 'Produto', '2026-10-13T09:30:00'),
  chat(7003, 60, 'Liderança', '2026-10-12T18:00:00'),
  chat(7004, 50, 'Produto', '2026-10-06T10:00:00'), // semana passada
  publicou('message_active', 'messages/800', '2026-10-12T09:00:00'),
  publicou('message_created', 'messages/801', '2026-10-13T08:00:00'),
  publicou('document_created', 'documents/810', '2026-10-11T20:00:00'),
  publicou('document_active', 'documents/810', '2026-10-12T20:00:00'), // o mesmo, publicado depois do rascunho
  publicou('google_document_created', 'google_documents/811', '2026-10-13T07:00:00'),
  publicou('upload_active', 'uploads/820', '2026-10-12T07:00:00'),
  publicou('message_inserted', 'messages/830', '2026-10-12T07:30:00'), // repostar não conta
  publicou('document_created', 'documents/840', '2026-10-05T10:00:00'), // semana passada
]

// Como o Basecamp marca cada pessoa numa menção com @.
const SGID_DA_ANA = 'sgid-da-ana'
const SGID_DO_BRUNO = 'sgid-do-bruno'
const marca = (sgid: string) => `<bc-attachment sgid="${sgid}" content-type="application/vnd.basecamp.mention"></bc-attachment>`
const fala = (id: number, quem: number, em: string, texto = 'Combinado.') => ({ id, em, quem, texto })

// Cada conversa: de quem é e os comentários, os meus (os da linha do tempo) e
// os dos outros, com ou sem menção. A 104 não abre.
const CONVERSAS: Record<string, { criador: number; responsaveis: number[]; comentarios: ReturnType<typeof fala>[] }> = {
  // Tarefa minha. O Bruno me chamou antes do 900; o 901 veio sem menção nova.
  100: {
    criador: 8,
    responsaveis: [7],
    comentarios: [
      fala(800, 8, '2026-10-12T09:00:00', `${marca(SGID_DA_ANA)} pode olhar?`),
      fala(900, 7, '2026-10-12T10:00:00'),
      fala(901, 7, '2026-10-13T09:00:00'),
    ],
  },
  // Eu pedi ao Bruno. A Carla marcou o Bruno, não eu.
  101: {
    criador: 7,
    responsaveis: [8],
    comentarios: [fala(801, 9, '2026-10-12T10:30:00', `${marca(SGID_DO_BRUNO)} e aí?`), fala(902, 7, '2026-10-12T11:00:00')],
  },
  // Do Bruno para a Carla. A menção chamou o 906, na semana passada; o 903 veio sem nova.
  102: {
    criador: 8,
    responsaveis: [9],
    comentarios: [
      fala(802, 8, '2026-10-06T09:00:00', `${marca(SGID_DA_ANA)} tem um minuto?`),
      fala(906, 7, '2026-10-07T10:00:00'),
      fala(903, 7, '2026-10-12T12:00:00'),
    ],
  },
  // Mensagem da Carla. Ela me marcou depois do meu comentário: ainda não respondi.
  103: {
    criador: 9,
    responsaveis: [],
    comentarios: [fala(904, 7, '2026-10-13T08:00:00'), fala(803, 9, '2026-10-13T09:30:00', `${marca(SGID_DA_ANA)} viu?`)],
  },
  // Documento meu.
  105: { criador: 7, responsaveis: [], comentarios: [fala(907, 7, '2026-10-06T10:00:00')] },
}

/**
 * O que o `basecamp show <id> --comments --jq filtroDaConversa(sgid)` responde:
 * o filtro diz qual sgid procurar, e cada comentário volta sem o texto.
 */
function conversaFiltrada(id: string, filtro: string) {
  const conversa = CONVERSAS[id]
  const sgid = JSON.parse(filtro.match(/contains\(("[^"]*")\)/)?.[1] ?? '""') as string
  if (conversa === undefined || sgid === '') return undefined
  const { comentarios, ...dono } = conversa
  return { ...dono, comentarios: comentarios.map(({ texto, ...c }) => ({ ...c, chama: texto.includes(sgid) })) }
}

// No Up next, uma tarefa que venceu na segunda passada.
const UP_NEXT = [{ id: 50, content: 'Revisar metas do trimestre', due_on: '2026-10-05', bucket: { name: 'Pessoal' } }]

// Quem criou cada tarefa. Ana (pessoa 7) é quem está logada; a 11 não abre.
const EU = { id: 7, name: 'Ana Teste', attachable_sgid: SGID_DA_ANA }
const CRIADORES: Record<string, { id: number; nome: string }> = {
  1: { id: 7, nome: 'Ana Teste' },
  2: { id: 7, nome: 'Ana Teste' },
  3: { id: 8, nome: 'Bruno' },
  50: { id: 8, nome: 'Bruno' },
  10: { id: 9, nome: 'Carla' },
}

const RESUMO =
  // Hoje conta tudo o que vence no dia: 1 a fazer e 1 concluída. As atrasadas
  // são a da semana passada e a do Up next. A semana soma 2 concluídas, 2
  // atrasadas e 2 a fazer; nada passa do ritmo, então o texto não fala dele.
  'Hoje: 2 tarefas (1 concluída), 2 atrasadas e 1 reunião. Semana de 11 a 17 de outubro: 6 tarefas e 2 concluídas.'

type Mundo = {
  agenda?: boolean
  /** `ausente`: a CLI não está instalada; `sem-login`: roda, mas responde com erro. */
  basecamp?: 'ok' | 'ausente' | 'sem-login'
  /** Quantas leituras da linha do tempo falham antes de uma dar certo. */
  falhasDaLinhaDoTempo?: number
  /** O que o mod já tinha guardado. */
  guardado?: Record<string, unknown>
  /** A linha do tempo traz também os COMENTARIOS. */
  comentarios?: boolean
  /** A linha do tempo traz também as ATIVIDADES: chat dos projetos e o que publiquei. */
  atividades?: boolean
}

/**
 * Agenda, Basecamp e o resto do Claude Code respondendo de memória. Devolve o
 * que foi pedido: os dias lidos da agenda e os escopos do Basecamp.
 */
function mundo(on: On, { agenda: agendaFunciona = true, basecamp = 'ok', falhasDaLinhaDoTempo = 0, guardado, comentarios = false, atividades = false }: Mundo = {}) {
  const relogio = mock.clock(on, { now: AGORA })
  const pedidos = { dias: [] as string[], escopos: [] as string[], criadores: [] as string[], conversas: [] as string[], linhasDoTempo: 0, relogio }
  mock.store(on, guardado)
  mock.env(on, { HOME: '/Users/teste' })
  on('tool.list', () => ({
    value: [
      { name: 'mcp__agenda__list_events', description: 'Lista eventos', mcp: true },
      { name: 'mcp__agenda__list_calendars', description: 'Lista agendas', mcp: true },
    ],
  }))
  on('mcp.call', ($, e) => {
    if (e.tool === 'list_events') pedidos.dias.push(String(e.args.startTime).slice(0, 10))
    return { value:
      agendaFunciona && e.server === 'agenda' && e.tool === 'list_events'
        ? { content: [{ type: 'text', text: JSON.stringify(AGENDA) }], isError: false }
        : { content: [{ type: 'text', text: 'indisponível' }], isError: true } }
  })
  on('process.run', ($, e) => {
    if (basecamp === 'ausente') throw new Error(`spawn ${e.argv[0]} ENOENT`)
    if (basecamp === 'sem-login') return { value: { exitCode: 1, stdout: '', stderr: 'not authenticated' } }
    const [, grupo, sub, escopo] = e.argv
    if (grupo === 'assignments' && sub === 'due') pedidos.escopos.push(escopo ?? '')
    // O show vem com --jq, sem o envelope: a conversa com os comentários, ou só quem criou.
    if (grupo === 'show' && e.argv[3] === '--comments' && e.argv[4] === '--jq') {
      pedidos.conversas.push(sub ?? '')
      const conversa = conversaFiltrada(sub ?? '', e.argv[5] ?? '')
      return { value: { exitCode: conversa === undefined ? 1 : 0, stdout: JSON.stringify(conversa ?? null), stderr: '' } }
    }
    if (grupo === 'show') {
      pedidos.criadores.push(sub ?? '')
      const criador = CRIADORES[sub ?? '']
      return { value: { exitCode: criador === undefined ? 1 : 0, stdout: JSON.stringify(criador ?? null), stderr: '' } }
    }
    // Com --agent, o erro vem na saída normal.
    if (grupo === 'timeline' && ++pedidos.linhasDoTempo <= falhasDaLinhaDoTempo)
      return { value: { exitCode: 1, stdout: '{"code":"unavailable","error":"Service Unavailable"}', stderr: '' } }
    // A linha do tempo vem com --agent: só os dados, sem o envelope.
    const stdout =
      grupo === 'timeline'
        ? JSON.stringify([...LINHA_DO_TEMPO, ...(comentarios ? COMENTARIOS : []), ...(atividades ? ATIVIDADES : [])])
        : JSON.stringify({
            ok: true,
            data:
              grupo === 'me'
                ? { identity: { first_name: 'Ana', last_name: 'Teste' }, accounts: [] }
                : grupo === 'people'
                  ? EU
                : sub === 'completed'
                  ? CONCLUIDAS
                  : sub === 'list'
                    ? { priorities: UP_NEXT, non_priorities: [] }
                    : (TAREFAS[escopo ?? ''] ?? []),
          })
    return { value: { exitCode: 0, stdout, stderr: '' } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  return pedidos
}

const PAINEL = {
  plugin: 'semana',
  component: 'Pane',
  requestId: 'semana',
  props: {
    title: 'Semana',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('/semana lê a agenda e o Basecamp e resume a semana', async ($, on) => {
  mundo(on)
  const { text } = await $.command.run({ command: 'semana', args: '' })

  // A reunião recusada fica de fora; o bloco sem convidados não conta como reunião.
  expect(text).toBe(RESUMO)
})

test('o painel é um SVG no desktop', async ($, on) => {
  mundo(on)
  await $.command.run({ command: 'semana', args: '' })
  const ui = await $.ui.mount({ ...PAINEL, surface: 'desktop' })

  const svg = await ui.find({ type: 'Svg' })
  expect(svg?.props.alt).toBe(RESUMO)
  // 8 feitas, todas na semana passada; as outras 3 semanas, vazias, ficam de
  // fora da média: ritmo de 1,6, arredondado.
  expect(String(svg?.props.source)).toContain('seu ritmo: 2 por dia útil')
  expect(String(svg?.props.source)).toContain('6 tarefas: 2 concluídas, 2 atrasadas e 2 a fazer até sábado')
  // O Up next abre a lista de hoje, com o dia em que venceu.
  expect(String(svg?.props.source)).toContain('>Up next</text>')
  expect(String(svg?.props.source)).toContain('>Revisar metas do trimestre</text>')
  expect(String(svg?.props.source)).toContain('>venceu 5 out</text>')
  // Só o 1:1 tem outra pessoa: 45 minutos em reunião.
  expect(String(svg?.props.source)).toContain('>45min</text>')
  // 3 a fazer (2 da semana + 1 atrasada) para ~6 que cabem em 4 dias úteis:
  // nada além do ritmo, e o topo não precisa dizer que cabe.
  expect(String(svg?.props.source)).not.toContain('além do ritmo')
  expect(String(svg?.props.source)).not.toMatch(/>[^<]*cabe no seu ritmo<\/text>/)
  // Hoje não lista as tarefas, nem as do dia nem as atrasadas: só conta, no
  // título. Sem espaço, sai a concluída, não as atrasadas.
  expect(String(svg?.props.source)).not.toContain('Fechar proposta')
  expect(String(svg?.props.source)).not.toContain('Revisão semanal')
  expect(String(svg?.props.source)).toContain('>1 reunião · 2 tarefas · 2 atrasadas</text>')
  expect(String(svg?.props.source)).toContain('>Ana</text>')
  expect(String(svg?.props.source)).toContain('1:1 - Ana')
  expect(String(svg?.props.source)).not.toContain('Recusada')
  // Imagem, não quadro interativo: no app o quadro tem tamanho padrão e encolhe o desenho.
  expect(svg?.props.isInteractive).toBeUndefined()
  // O app não repassa cliques de mod: sem botão no desktop.
  expect(await ui.find({ key: 'atualizar' })).toBeUndefined()
  await ui.unmount()
})

test('no terminal o painel vira texto', async ($, on) => {
  mundo(on)
  await $.command.run({ command: 'semana', args: '' })
  const ui = await $.ui.mount({ ...PAINEL, surface: 'terminal' })

  // Só o primeiro nome do Basecamp, com o período ao lado.
  expect(await ui.find({ type: 'Text', text: /^Ana · 11 a 17 de outubro/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /14:00 {2}1:1 - Ana/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Fechar proposta/ })).toBeUndefined()
  expect(await ui.find({ key: 'atualizar' })).toBeDefined()
  await ui.unmount()
})

test('sem agenda, o painel avisa e mostra as tarefas', async ($, on) => {
  mundo(on, { agenda: false })
  const { text } = await $.command.run({ command: 'semana', args: '' })
  expect(text).toContain('Hoje: 2 tarefas (1 concluída), 2 atrasadas e nenhuma reunião.')
  expect(text).toContain('Confira se o Google Calendar está conectado no claude.ai')

  const ui = await $.ui.mount({ ...PAINEL, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Não consegui ler a agenda/ })).toBeDefined()
  await ui.unmount()
})

test('sem a CLI do Basecamp, o aviso diz como instalar', async ($, on) => {
  mundo(on, { basecamp: 'ausente' })
  const { text } = await $.command.run({ command: 'semana', args: '' })
  expect(text).toContain('Não achei a CLI do Basecamp. Instale o plugin basecamp@37signals e rode basecamp auth login.')
  // A agenda continua: a reunião de hoje aparece.
  expect(text).toContain('1 reunião')

  // No desktop o aviso vem inteiro, quebrado em linhas, e não cortado.
  const ui = await $.ui.mount({ ...PAINEL, surface: 'desktop' })
  const svg = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(svg).toContain('>Não achei a CLI do Basecamp. Instale o plugin')
  expect(svg).toContain('basecamp auth login.</text>')
  expect(svg).not.toContain('…</text>')
  // Sem o Basecamp não há nome: o título fica genérico.
  expect(svg).toContain('>Minha semana</text>')
  await ui.unmount()
})

test('com a CLI do Basecamp sem login, o aviso pede o login', async ($, on) => {
  mundo(on, { basecamp: 'sem-login' })
  const { text } = await $.command.run({ command: 'semana', args: '' })
  expect(text).toContain('Não consegui ler o Basecamp. Rode basecamp auth login e tente de novo.')
})

test('a linha do tempo que falha de passagem é lida de novo, sem aviso', async ($, on) => {
  const pedidos = mundo(on, { falhasDaLinhaDoTempo: 2 })
  const resposta = $.command.run({ command: 'semana', args: '' })
  await pedidos.relogio.advance(2_000)
  await pedidos.relogio.advance(5_000)

  expect((await resposta).text).toBe(RESUMO)
  expect(pedidos.linhasDoTempo).toBe(3)
})

test('sem a linha do tempo de agora, valem as conclusões guardadas', async ($, on) => {
  // As mesmas conclusões da linha do tempo, guardadas por uma leitura anterior.
  const dias = Object.fromEntries(CONCLUIDAS.map(t => [String(t.id), t.due_on]))
  const guardado = { conclusoes: { dias, cobertura: '0000-01-01', lidoAte: '2026-10-13T12:00:00' } }
  const pedidos = mundo(on, { falhasDaLinhaDoTempo: 99, guardado })
  const resposta = $.command.run({ command: 'semana', args: '' })
  await pedidos.relogio.advance(2_000)
  await pedidos.relogio.advance(5_000)

  const { text } = await resposta
  expect(text).toContain(RESUMO)
  expect(text).toContain(
    'Não consegui atualizar a linha do tempo do Basecamp (Service Unavailable); as concluídas mais recentes entram na próxima atualização.',
  )
  expect(pedidos.linhasDoTempo).toBe(3)
})

test('sem linha do tempo nem nada guardado, o aviso diz o motivo', async ($, on) => {
  const pedidos = mundo(on, { falhasDaLinhaDoTempo: 99 })
  const resposta = $.command.run({ command: 'semana', args: '' })
  await pedidos.relogio.advance(2_000)
  await pedidos.relogio.advance(5_000)

  expect((await resposta).text).toContain(
    'Não consegui ler a linha do tempo do Basecamp (Service Unavailable); as concluídas contam pela data de vencimento.',
  )
})

test('a semana vai de domingo a sábado, qualquer que seja o dia', () => {
  const tarefa = (id: number, vence: string) => ({ id, titulo: `t${id}`, projeto: '', vence })
  const tarefas = [tarefa(1, '2026-10-10'), tarefa(2, '2026-10-11'), tarefa(3, '2026-10-17'), tarefa(4, '2026-10-18')]

  for (const dia of [11, 13, 17]) {
    const semana = montarSemana({
      agoraMs: new Date(2026, 9, dia, 9, 0).getTime(),
      eventos: new Map(),
      tarefas,
      avisos: [],
      contaBasecamp: null,
    })
    expect(semana.dias.map(d => d.data)).toEqual([
      '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17',
    ])
    // O sábado anterior nunca entra nos dias; o domingo seguinte também não.
    expect(semana.dias.flatMap(d => d.tarefas).map(t => t.id)).toEqual([2, 3])
  }
})

test('sem a linha do tempo, as concluídas contam no dia em que venciam', () => {
  const tarefa = (id: number, vence: string) => ({ id, titulo: `t${id}`, projeto: '', vence })
  const base = { agoraMs: new Date(2026, 9, 13, 9, 0).getTime(), eventos: new Map(), avisos: [], contaBasecamp: null }

  const comHistorico = montarSemana({
    ...base,
    tarefas: [tarefa(1, '2026-10-14')],
    // A 1 aparece também nas feitas (concluída entre as duas leituras): conta como pendente.
    concluidas: [tarefa(1, '2026-10-14'), tarefa(2, '2026-10-12'), tarefa(3, '2026-10-06'), tarefa(4, '2026-10-04')],
  })
  expect(comHistorico.dias.map(d => d.concluidas)).toEqual([0, 1, 0, 0, 0, 0, 0])
  // Só a de terça passada é de dia útil; a de domingo passado não entra.
  expect(comHistorico.ritmo).toBe(1 / 5)

  expect(montarSemana({ ...base, tarefas: [] }).ritmo).toBeNull()
})

test('o ritmo é a média das últimas 4 semanas, sem as semanas vazias', () => {
  let id = 0
  const feitas = (n: number, vence: string) =>
    Array.from({ length: n }, () => ({ id: ++id, titulo: `t${id}`, projeto: '', vence }))
  const semana = montarSemana({
    agoraMs: new Date(2026, 9, 13, 9, 0).getTime(), // terça, 13 de outubro
    eventos: new Map(),
    tarefas: [],
    concluidas: [
      ...feitas(10, '2026-10-07'), // semana passada
      ...feitas(20, '2026-09-29'), // duas semanas atrás
      // três semanas atrás, nada concluído (férias): fica de fora
      ...feitas(5, '2026-09-18'), // quatro semanas atrás, sexta
      ...feitas(3, '2026-09-19'), // sábado: não é dia útil
      ...feitas(50, '2026-09-08'), // cinco semanas atrás: fora da janela
    ],
    avisos: [],
    contaBasecamp: null,
  })
  // 10 + 20 + 5 em 3 semanas de 5 dias úteis.
  expect(semana.ritmo).toBe(35 / 15)
})

test('o que passa do ritmo conta o resto da semana e as atrasadas', () => {
  const tarefa = (id: number, vence: string) => ({ id, titulo: `t${id}`, projeto: '', vence })
  const semana = montarSemana({
    agoraMs: new Date(2026, 9, 15, 9, 0).getTime(), // quinta
    eventos: new Map(),
    tarefas: [
      tarefa(1, '2026-10-12'), // atrasada desta semana
      tarefa(2, '2026-10-08'), // atrasada da semana passada
      ...Array.from({ length: 10 }, (_, i) => tarefa(10 + i, '2026-10-15')),
      tarefa(30, '2026-10-17'), // sábado também conta como a fazer
    ],
    // Ritmo de 2 por dia útil.
    concluidas: Array.from({ length: 10 }, (_, i) => tarefa(100 + i, `2026-10-0${5 + (i % 5)}`)),
    avisos: [],
    contaBasecamp: null,
  })
  // 11 da semana + 2 atrasadas = 13; quinta e sexta, 2 por dia: cabem 4.
  expect(alemDoRitmo(semana)).toEqual({ aFazer: 13, cabem: 4, excesso: 9, diasUteis: 2 })
  expect(alemDoRitmo({ ...semana, ritmo: null })).toBeNull()

  expect(duracao(45)).toBe('45min')
  expect(duracao(120)).toBe('2h')
  expect(duracao(510)).toBe('8,5h')
})

test('as tarefas vêm por importância: 🔴, depois 🟢, depois outros ícones, depois sem ícone', () => {
  const tarefa = (id: number, titulo: string, vence = '2026-10-13') => ({ id, titulo, projeto: '', vence })
  const semana = montarSemana({
    agoraMs: new Date(2026, 9, 13, 9, 0).getTime(),
    eventos: new Map(),
    tarefas: [
      tarefa(1, 'Sem ícone'),
      tarefa(2, '⭐️ Reflexão diária'),
      tarefa(3, '🟢 Definir foco da semana'),
      tarefa(4, '🔴 Rodar script de cobrança'),
      tarefa(5, '🟢 Despesa: Luz'),
      tarefa(6, '🔴 Atrasada urgente', '2026-10-10'),
      tarefa(7, 'Atrasada comum', '2026-10-09'),
    ],
    avisos: [],
    contaBasecamp: null,
  })
  const hoje = semana.dias.find(d => d.data === '2026-10-13')
  // Dentro do mesmo ícone, fica a ordem que veio.
  expect(hoje?.tarefas.map(t => t.id)).toEqual([4, 3, 5, 2, 1])
  expect(semana.atrasadas.map(t => t.id)).toEqual([6, 7])

  expect(importancia('  🔴 com espaço antes')).toBe(0)
  expect(importancia('⭐️🔴 urgente depois de outro ícone')).toBe(0)
  expect(importancia('💎 Despesa')).toBe(2)
  expect(importancia('Título com 🔴 no meio')).toBe(3)

  expect(semMarcaDePrioridade('🔴 Rodar script de cobrança')).toBe('Rodar script de cobrança')
  expect(semMarcaDePrioridade('  🟢 Despesa: Luz')).toBe('Despesa: Luz')
  // Os outros ícones ficam; o que está no meio do título também.
  expect(semMarcaDePrioridade('⭐️🔴 urgente depois de outro ícone')).toBe('⭐️ urgente depois de outro ícone')
  expect(semMarcaDePrioridade('Título com 🔴 no meio')).toBe('Título com 🔴 no meio')
  expect(semMarcaDePrioridade('🔴')).toBe('🔴')
})

test('a barra do topo soma a semana e conta as prioritárias', () => {
  const tarefa = (id: number, vence: string, titulo = `t${id}`) => ({ id, titulo, projeto: '', vence })
  const semana = montarSemana({
    agoraMs: new Date(2026, 9, 15, 9, 0).getTime(), // quinta
    eventos: new Map(),
    tarefas: [
      tarefa(1, '2026-10-12', '🔴 atrasada desta semana'),
      tarefa(2, '2026-10-08'), // atrasada da semana passada: entra na conta da semana
      ...Array.from({ length: 10 }, (_, i) => tarefa(10 + i, '2026-10-15', i < 3 ? `🟢 t${i}` : `t${i}`)),
      tarefa(30, '2026-10-17', '⭐️ outro ícone não é prioridade'),
    ],
    // Ritmo de 2 por dia útil; uma feita nesta semana.
    concluidas: [...Array.from({ length: 10 }, (_, i) => tarefa(100 + i, `2026-10-0${5 + (i % 5)}`)), tarefa(200, '2026-10-13')],
    avisos: [],
    contaBasecamp: null,
  })

  // 1 feita + 2 atrasadas + 11 de quinta a sábado; cabem 4 em 2 dias úteis.
  const carga = cargaDaSemana(semana)
  expect(carga).toEqual({
    total: 14, feitas: 1, atrasadas: 2, aFazer: 11, alem: 9, cabem: 4, diasUteis: 2, urgentes: 1, importantes: 3,
  })
  // Os trechos da barra somam o total: 1 + 2 + (11 - 9) + 9.
  expect(carga.feitas + carga.atrasadas + (carga.aFazer - carga.alem) + carga.alem).toBe(carga.total)

  const { svg } = desenharSemana(semana, { largura: 400 })
  expect(svg).toContain('>além do ritmo</text>')
  // O começo das listras já marca onde o ritmo acaba: sem traço nem rótulo.
  expect(svg).not.toContain('>seu ritmo</text>')
  // As prioritárias com as bolinhas da marca no lugar do emoji.
  expect(svg).toContain('>urgente</text>')
  expect(svg).toContain('>importantes</text>')
  expect(svg).toContain('fill="#F06672"/><text')
  // Sem veredito ao lado das prioritárias (só na dica da barra), e o roxo
  // liso (a fazer) sem rótulo.
  expect(svg).not.toMatch(/>[^<]*cabem no seu ritmo<\/text>/)
  expect(svg).not.toContain('>a fazer</text>')
  // Hoje conta as de quinta e as atrasadas: a 🔴 atrasada e as três 🟢.
  expect(svg).toContain('<title>1 urgente (🔴) e 3 importantes (🟢) entre as tarefas de hoje e as atrasadas</title>')
  expect(svg).not.toContain('>atrasada desta semana</text>')

  // Sem ritmo não há o que passe dele: sem traço, sem listras, sem veredito.
  const semRitmo = desenharSemana({ ...semana, ritmo: null }, { largura: 400 }).svg
  expect(semRitmo).not.toContain('seu ritmo</text>')
  expect(semRitmo).not.toContain('além do ritmo')
  expect(semRitmo).toContain('>importantes</text>')

  // Num painel estreito o rótulo do total encurta e nada passa da borda.
  expect(desenharSemana(semana, { largura: 300 }).svg).toContain('>tarefas</text>')
})

test('hoje conta as atrasadas, e os próximos dias listam as reuniões', () => {
  const tarefa = (id: number, vence: string, titulo = `t${id}`) => ({ id, titulo, projeto: '', vence })
  const semana = montarSemana({
    agoraMs: new Date(2026, 9, 12, 9, 0).getTime(), // segunda
    eventos: new Map([
      ['2026-10-15', [{ titulo: 'Reunião de time', inicio: 660, fim: 720, diaInteiro: false, comPessoas: true }]],
      ['2026-10-16', [{ titulo: 'Feriado local', inicio: 0, fim: 1440, diaInteiro: true, comPessoas: false }]],
    ]),
    tarefas: [tarefa(1, '2026-10-15'), tarefa(2, '2026-10-15'), tarefa(3, '2026-10-11', 'Atrasada de domingo')],
    avisos: [],
    contaBasecamp: null,
  })
  const { svg } = desenharSemana(semana, { largura: 400 })

  // Sem seção própria de atrasadas e sem a linha dos dias que já passaram: a
  // atrasada entra na conta do título de Hoje, sem ser listada.
  expect(svg).not.toContain('>Atrasadas</text>')
  expect(svg).not.toContain('já passaram')
  expect(svg).not.toContain('Atrasada de domingo')
  expect(svg).toContain('>1 atrasada</text>')

  // Cada dia que vem mostra as reuniões com horário, e o de dia inteiro.
  expect(svg).toContain('>Quinta</text>')
  expect(svg).toContain('>Reunião de time</text>')
  expect(svg).toContain('>11:00</text>')
  expect(svg).toContain('>Feriado local</text>')
  expect(svg).toContain('>1 reunião · 2 tarefas</text>')
})

test('as concluídas contam no dia em que foram concluídas, pela linha do tempo', () => {
  const tarefa = (id: number, vence: string) => ({ id, titulo: `t${id}`, projeto: '', vence })
  const concluida = (id: number, quando: string) => ({
    kind: 'todo_completed',
    created_at: quando,
    url: `https://3.basecampapi.com/1/buckets/1/todos/${id}.json`,
  })
  const hoje = '2026-10-13' // terça
  const conclusoes = lerConclusoes(
    undefined,
    [
      concluida(1, '2026-10-12T10:00:00'), // vencia sexta passada; concluída ontem
      concluida(2, '2026-10-05T10:00:00'), // semana passada
      concluida(3, '2026-10-06T10:00:00'),
      { kind: 'todo_uncompleted', created_at: '2026-10-07T10:00:00', url: 'https://x/todos/3.json' }, // reaberta
      concluida(4, '2026-10-10T10:00:00'), // sábado: fora do ritmo
      { kind: 'comment_created', created_at: '2026-10-08T10:00:00', url: 'https://x/todos/9.json' },
    ],
    1500,
    hoje,
  )
  // Menos eventos que o limite: o histórico inteiro foi lido.
  expect(conclusoes.dias).toEqual({ '1': '2026-10-12', '2': '2026-10-05', '4': '2026-10-10' })
  expect(conclusoes.cobertura).toBe('0000-01-01')
  expect(conclusoes.lidoAte).toBe('2026-10-12T10:00:00')

  const semana = montarSemana({
    agoraMs: new Date(2026, 9, 13, 9, 0).getTime(),
    eventos: new Map(),
    tarefas: [],
    concluidas: [tarefa(1, '2026-10-09'), tarefa(2, '2026-10-05'), tarefa(3, '2026-10-06'), tarefa(4, '2026-10-10')],
    conclusoes,
    avisos: [],
    contaBasecamp: null,
  })
  // A que vencia sexta passada conta ontem, nesta semana.
  expect(semana.dias.map(d => d.concluidas)).toEqual([0, 1, 0, 0, 0, 0, 0])
  // Ritmo: só a de segunda passada é de dia útil (a 3 foi reaberta; a 4 é de sábado).
  expect(semana.ritmo).toBe(1 / 5)

  // Uma resposta que chega ao limite só garante os dias depois do evento mais antigo:
  // as semanas antes disso ficam fora do ritmo.
  const parcial = lerConclusoes(undefined, [concluida(2, '2026-10-05T10:00:00'), concluida(1, '2026-10-12T10:00:00')], 2, hoje)
  expect(parcial.cobertura).toBe('2026-10-06')
  expect(montarSemana({ ...base(), conclusoes: parcial }).ritmo).toBeNull()

  // A leitura seguinte, curta, junta o que chegou ao que estava guardado.
  const depois = lerConclusoes(conclusoes, [concluida(7, '2026-10-13T08:00:00')], 300, hoje)
  expect(depois.dias).toEqual({ '1': '2026-10-12', '2': '2026-10-05', '4': '2026-10-10', '7': '2026-10-13' })

  function base() {
    return {
      agoraMs: new Date(2026, 9, 13, 9, 0).getTime(),
      eventos: new Map(),
      tarefas: [],
      concluidas: [tarefa(1, '2026-10-09'), tarefa(2, '2026-10-05')],
      avisos: [],
      contaBasecamp: null,
    }
  }
})

test('hoje e amanhã não listam as tarefas: contam as urgentes e as importantes', () => {
  const tarefa = (id: number, vence: string, titulo: string) => ({ id, titulo, projeto: '', vence })
  const semana = montarSemana({
    agoraMs: AGORA, // terça, 13
    eventos: new Map([
      ['2026-10-14', [{ titulo: 'Reunião de time', inicio: 600, fim: 660, diaInteiro: false, comPessoas: true }]],
    ]),
    tarefas: [
      tarefa(1, '2026-10-02', 'Atrasada antiga'),
      tarefa(2, '2026-10-09', '🟢 Atrasada importante'),
      ...[3, 4, 5, 6].map(id => tarefa(id, '2026-10-12', `Outra atrasada ${id}`)),
      tarefa(7, '2026-10-13', 'Comum de hoje'),
      tarefa(8, '2026-10-13', '🔴 Urgente de hoje'),
      ...[9, 10, 11].map(id => tarefa(id, '2026-10-13', `Mais uma de hoje ${id}`)),
      tarefa(12, '2026-10-14', '🔴 Urgente de amanhã'),
      tarefa(13, '2026-10-14', '🔴 Outra urgente de amanhã'),
      tarefa(14, '2026-10-14', 'Comum de amanhã'),
      tarefa(15, '2026-10-16', '🟢 Importante de sexta'),
    ],
    avisos: [],
    contaBasecamp: null,
  })

  const { svg } = desenharSemana(semana, { largura: 400 })
  // Nenhum título de tarefa, nem a conta do que ficou de fora de uma lista.
  expect(svg).not.toMatch(/>[^<]*(Atrasada|de hoje|de amanhã|de sexta)[^<]*<\/text>/)
  expect(svg).not.toMatch(/>\+ \d+ (tarefas?|atrasadas?)<\/text>/)
  // O título do card continua contando tudo.
  expect(svg).toContain('>5 tarefas · 6 atrasadas</text>')
  // Hoje conta as do dia e as atrasadas; amanhã, só as dele. O topo, a semana.
  expect(svg).toContain('<title>1 urgente (🔴) e 1 importante (🟢) entre as tarefas de hoje e as atrasadas</title>')
  expect(svg).toContain('<title>2 urgentes (🔴) entre as tarefas de amanhã</title>')
  expect(svg).toContain('>1 reunião · 3 tarefas</text>')
  // Os outros dias continuam só com as reuniões e o resumo.
  expect(svg).not.toContain('entre as tarefas de sexta')

  // Dia sem urgente nem importante: nada no lugar.
  const semPrioridade = desenharSemana({ ...semana, atrasadas: [], dias: semana.dias.map(d => ({ ...d, tarefas: [] })) }, { largura: 400 }).svg
  expect(semPrioridade).not.toContain('entre as tarefas de')
  expect(semPrioridade).not.toContain('>urgente')

  // No terminal, a mesma conta numa linha.
  expect(hojeEmLinhas(semana)).toEqual(['🔴 1 urgente · 🟢 1 importante'])
})

test('o Up next abre o dia e conta pela data', () => {
  const semana = montarSemana({
    agoraMs: new Date(2026, 9, 12, 9, 0).getTime(), // segunda
    eventos: new Map(),
    tarefas: [{ id: 1, titulo: 'Tarefa de amanhã', projeto: '', vence: '2026-10-13' }],
    upNext: [
      { id: 10, titulo: 'Revisar metas do trimestre', projeto: '', vence: '2026-10-05' }, // atrasada
      { id: 11, titulo: 'Pensar no planejamento', projeto: '', vence: null }, // sem data
      { id: 12, titulo: '🔴 Fechar contrato', projeto: '', vence: '2026-10-13' }, // amanhã
    ],
    avisos: [],
    contaBasecamp: null,
  })
  // A atrasada entra nas atrasadas; a de amanhã, no dia; a sem data, em nenhum dos dois.
  expect(semana.atrasadas.map(t => t.id)).toEqual([10])
  expect(semana.dias[2]?.tarefas.map(t => t.id)).toEqual([12, 1])

  const { svg } = desenharSemana(semana, { largura: 400 })
  expect(svg).toContain('>Up next</text>')
  expect(svg).toContain('>Pensar no planejamento</text>')
  expect(svg).toContain('>venceu 5 out</text>')
  // Amanhã conta as duas e não lista nenhuma; a do Up next, 🔴, entra na conta
  // de urgentes. No Up next o emoji sai do título e vira a cor da bolinha.
  expect(svg).toContain('>2 tarefas</text>')
  expect(svg.match(/>Fechar contrato<\/text>/g)?.length).toBe(1)
  expect(svg).not.toContain('Tarefa de amanhã')
  expect(svg).toContain('<title>1 urgente (🔴) entre as tarefas de amanhã</title>')
})

test('o título é só o primeiro nome do Basecamp', () => {
  expect(primeiroNome({ ok: true, data: { identity: { first_name: '  Joe ', last_name: 'Silva' } } })).toBe('Joe')
  expect(primeiroNome({ ok: true, data: { identity: { first_name: '' } } })).toBeNull()
  expect(primeiroNome(null)).toBeNull()

  expect(tituloDaSemana('Ana')).toBe('Ana')
  expect(tituloDaSemana(null)).toBe('Minha semana')
  // Leitura salva por versão anterior, sem o campo.
  expect(tituloDaSemana(undefined)).toBe('Minha semana')
})

test('/semana proxima lê a semana que vem, sem o bloco de hoje', async ($, on) => {
  const pedidos = mundo(on)
  const { text } = await $.command.run({ command: 'semana', args: 'próxima' })

  // A agenda de domingo a sábado da semana que vem, o domingo primeiro, e os
  // escopos do Basecamp depois desta semana.
  expect(pedidos.dias[0]).toBe('2026-10-18')
  expect([...pedidos.dias].sort()).toEqual([
    '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24',
  ])
  expect([...pedidos.escopos].sort()).toEqual(['due_later', 'due_next_week', 'due_tomorrow'])
  // Sem atrasadas nem Up next: são de hoje. 2 tarefas cabem no ritmo de ~8 em 5 dias úteis.
  expect(text).toBe('Próxima semana, de 18 a 24 de outubro: 2 tarefas e 1 reunião.')

  const desktop = await $.ui.mount({ ...PAINEL, surface: 'desktop' })
  const svg = String((await desktop.find({ type: 'Svg' }))?.props.source)
  expect(svg).toContain('>próxima semana · 18 a 24 de outubro</text>')
  expect(svg).not.toContain('>Hoje</text>')
  expect(svg).not.toContain('>Up next</text>')
  expect(svg).not.toContain('Revisão semanal')
  // Todos os dias ganham bloco, com as reuniões e quantas tarefas vencem.
  expect(svg).toContain('>Domingo</text>')
  expect(svg).toContain('>Reunião com a diretoria</text>')
  expect(svg).toContain('>1 reunião · 1 tarefa</text>')
  // Em outra semana todo dia lista as primeiras tarefas, não só amanhã.
  expect(svg).toContain('>Apresentar resultados</text>')
  expect(svg).toContain('2 tarefas: 0 concluídas, 0 atrasadas e 2 a fazer até sábado')
  // Uma semana que nem começou não tem o que ter concluído: a legenda não fala disso.
  expect(svg).not.toContain('>concluídas</text>')
  expect(svg).toContain('seu ritmo: 2 por dia útil')
  await desktop.unmount()

  // No terminal, um resumo de cada dia; o Atualizar relê a mesma semana.
  const terminal = await $.ui.mount({ ...PAINEL, surface: 'terminal' })
  expect(await terminal.find({ type: 'Text', text: /^Ana · próxima semana · 18 a 24 de outubro/ })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: /^ter 20 out {2}1 reunião · 1 tarefa$/ })).toBeDefined()
  pedidos.dias.length = 0
  await terminal.press({ key: 'atualizar' })
  expect(pedidos.dias).toContain('2026-10-18')
  expect(pedidos.dias).not.toContain('2026-10-13')
  expect(await terminal.find({ type: 'Text', text: /^Ana · próxima semana/ })).toBeDefined()
  await terminal.unmount()

  // /semana sozinho volta para a semana de hoje.
  expect((await $.command.run({ command: 'semana', args: '' })).text).toBe(RESUMO)
})

test('/semana anterior mostra o que foi concluído e o que ficou para trás', async ($, on) => {
  const pedidos = mundo(on)
  const { text } = await $.command.run({ command: 'semana', args: 'anterior' })

  // As pendentes de uma semana passada estão todas em overdue.
  expect(pedidos.escopos).toEqual(['overdue'])
  // 8 concluídas de segunda a sexta; atrasadas, só as que venciam nela: a de
  // sexta e a do Up next, que venceu na segunda.
  expect(text).toBe('Semana passada, de 4 a 10 de outubro: 10 tarefas, 8 concluídas, 2 atrasadas e nenhuma reunião.')

  const ui = await $.ui.mount({ ...PAINEL, surface: 'desktop' })
  const svg = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(svg).toContain('>semana passada · 4 a 10 de outubro</text>')
  expect(svg).not.toContain('>Hoje</text>')
  // Cada dia diz quantas tinha e quantas ficaram, e lista as que ficaram; as
  // concluídas ficam no gráfico, não na linha do dia.
  expect(svg).toContain('>5 tarefas · 1 atrasada</text>')
  expect(svg).not.toMatch(/>[^<]*\d concluídas?[^<]*<\/text>/)
  expect(svg).toContain('>Revisão semanal</text>')
  expect(svg).toContain('>Revisar metas do trimestre</text>')
  await ui.unmount()
})

test('/semana +3 busca as tarefas mais adiante', async ($, on) => {
  const pedidos = mundo(on)
  const { text } = await $.command.run({ command: 'semana', args: '+3' })
  expect(pedidos.dias[0]).toBe('2026-11-01')
  expect(text).toBe('Daqui a 3 semanas, de 1 a 7 de novembro: 1 tarefa e nenhuma reunião.')
})

test('/semana com argumento que não entende, ou longe demais, explica e não lê nada', async ($, on) => {
  const pedidos = mundo(on)
  expect((await $.command.run({ command: 'semana', args: 'amanhã' })).text).toBe(
    'Não entendi "amanhã". Use /semana, /semana proxima, /semana anterior ou /semana +2.',
  )
  expect((await $.command.run({ command: 'semana', args: '-5' })).text).toBe(
    'Dá para ver até 4 semanas para trás e 52 para frente.',
  )
  expect(pedidos.dias).toEqual([])

  expect(lerDeslocamento('')).toBe(0)
  expect(lerDeslocamento(' Atual ')).toBe(0)
  expect(lerDeslocamento('próxima semana')).toBe(1)
  expect(lerDeslocamento('PROXIMA')).toBe(1)
  expect(lerDeslocamento('semana que vem')).toBe(1)
  expect(lerDeslocamento('semana passada')).toBe(-1)
  expect(lerDeslocamento('anterior')).toBe(-1)
  expect(lerDeslocamento('+2')).toBe(2)
  expect(lerDeslocamento('2')).toBe(2)
  expect(lerDeslocamento('- 3')).toBe(-3)
  expect(lerDeslocamento('-0')).toBe(0)
  expect(lerDeslocamento('2026-10-20')).toBeNull()
})

test('outra semana muda os dias, mas o ritmo continua o das últimas 4 semanas', () => {
  const tarefa = (id: number, vence: string) => ({ id, titulo: `t${id}`, projeto: '', vence })
  const base = {
    agoraMs: new Date(2026, 9, 13, 9, 0).getTime(), // terça, 13 de outubro
    eventos: new Map(),
    tarefas: [tarefa(1, '2026-09-30'), tarefa(2, '2026-10-06'), tarefa(3, '2026-10-12'), tarefa(4, '2026-10-20')],
    concluidas: Array.from({ length: 10 }, (_, i) => tarefa(100 + i, `2026-10-0${5 + (i % 5)}`)),
    upNext: [{ id: 9, titulo: 'Sem data', projeto: '', vence: null }],
    avisos: [],
    contaBasecamp: null,
  }
  const atual = montarSemana(base)
  const passada = montarSemana({ ...base, deslocamento: -1 })
  const proxima = montarSemana({ ...base, deslocamento: 1 })

  expect(passada.dias.map(d => d.data)).toEqual([
    '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10',
  ])
  expect(proxima.dias[0]?.data).toBe('2026-10-18')
  expect(passada.ritmo).toBe(atual.ritmo)
  expect(proxima.ritmo).toBe(atual.ritmo)
  expect(passada.hoje).toBe('2026-10-13')

  // Na de hoje, todas as atrasadas; numa passada, só as dela; numa futura, nenhuma.
  expect(atual.atrasadas.map(t => t.id)).toEqual([1, 2, 3])
  expect(passada.atrasadas.map(t => t.id)).toEqual([2])
  expect(proxima.atrasadas).toEqual([])
  // O Up next é do bloco Hoje.
  expect(atual.upNext?.length).toBe(1)
  expect(proxima.upNext).toEqual([])
  expect(proxima.deslocamento).toBe(1)
})

test('quem pediu e os espaços dividem o total da semana, com "Você" nas minhas', async ($, on) => {
  const pedidos = mundo(on)
  await $.command.run({ command: 'semana', args: '' })

  // Só as 6 tarefas do total da semana são abertas: as 2 concluídas nela, as 2
  // atrasadas e as 2 a fazer. As concluídas de outras semanas, não.
  expect([...pedidos.criadores].sort()).toEqual(['1', '10', '11', '2', '3', '50'])

  const ui = await $.ui.mount({ ...PAINEL, surface: 'desktop' })
  const svg = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(svg).toContain('>Quem pediu</text>')
  expect(svg).toContain('>Espaços</text>')
  expect(svg).toContain('>Você</text>')
  // A 11 não abriu: fica fora de quem pediu, com a nota ao lado do título.
  expect(svg).toContain('>1 sem autor</text>')
  expect(svg).toContain('<title>Bruno: 2 tarefas · 1 atrasada · 1 a fazer</title>')
  await ui.unmount()

  // Quem criou fica guardado: a próxima leitura não abre nada de novo, só a 11.
  pedidos.criadores.length = 0
  await $.command.run({ command: 'semana', args: '' })
  expect(pedidos.criadores).toEqual(['11'])
})

test('cada gráfico soma o mesmo total da barra do topo e junta o que passa de 4 linhas', () => {
  const tarefa = (id: number, vence: string, projeto: string, criador?: number) => ({
    id, titulo: `t${id}`, projeto, vence,
    ...(criador === undefined ? {} : { criador: { id: criador, nome: `Pessoa ${criador}` } }),
  })
  const tarefas = [
    tarefa(1, '2026-10-12', 'Financeiro', 1), // atrasada
    ...Array.from({ length: 8 }, (_, i) => tarefa(10 + i, '2026-10-15', `Espaço ${i % 7}`, i)),
    tarefa(30, '2026-10-16', '', undefined),
  ]
  const entrada = {
    agoraMs: new Date(2026, 9, 15, 9, 0).getTime(), // quinta
    eventos: new Map(),
    tarefas: tarefas.map(({ criador, ...t }) => t),
    concluidas: [tarefa(100, '2026-10-13', 'Financeiro')],
    eu: 0,
    avisos: [],
    contaBasecamp: null,
  }
  const criadores = Object.fromEntries(
    [...tarefas, tarefa(100, '', '', 1)].flatMap(t => (t.criador ? [[String(t.id), t.criador]] : [])),
  )
  const semana = montarSemana({ ...entrada, criadores })
  const total = cargaDaSemana(semana).total
  const { pessoas, espacos, semCriador } = origensDaSemana(semana)
  const soma = (gs: typeof pessoas) => gs.reduce((n, g) => n + g.feitas + g.atrasadas + g.aFazer, 0)
  expect(total).toBe(11)
  expect(soma(pessoas) + semCriador).toBe(total)
  expect(soma(espacos)).toBe(total)
  expect(semCriador).toBe(1)
  // Pessoa 1 tem a atrasada, uma a fazer e a concluída: vem primeiro.
  expect(pessoas[0]).toEqual({ nome: 'Pessoa 1', voce: false, feitas: 1, atrasadas: 1, aFazer: 1 })
  expect(pessoas.find(g => g.voce)?.nome).toBe('Você')
  expect(espacos.find(g => g.nome === 'Sem espaço')?.aFazer).toBe(1)

  // 8 pessoas viram 3 linhas e "5 outras pessoas", numa barra mais clara.
  const { svg } = desenharSemana(semana, { largura: 400 })
  expect(svg).toContain('>5 outras pessoas</text>')
  expect(svg).toContain('class="suave"/>')
  // Uma cor só, sem trilha: concluídas, atrasadas e a fazer ficam na dica.
  expect(svg).toContain('<title>Pessoa 1: 3 tarefas · 1 concluída · 1 atrasada · 1 a fazer</title>')
  expect(svg).toContain('>Financeiro</text>')
  expect(origensEmLinhas(semana)[0]).toMatch(/^Quem pediu: Pessoa 1 3 · /)

  // Sem nenhum criador conhecido, só o gráfico dos espaços.
  const semCriadores = desenharSemana(montarSemana(entrada), { largura: 400 }).svg
  expect(semCriadores).not.toContain('>Quem pediu</text>')
  expect(semCriadores).toContain('>Espaços</text>')
})

test('os criadores guardados não passam do limite: saem as tarefas mais antigas', () => {
  const muitos = Object.fromEntries(Array.from({ length: 3005 }, (_, i) => [String(i), { id: 1, nome: 'A' }]))
  const juntos = juntarCriadores(muitos, { 9999: { id: 2, nome: 'B' } })
  expect(Object.keys(juntos).length).toBe(3000)
  expect(juntos['9999']).toEqual({ id: 2, nome: 'B' })
  expect(juntos['0']).toBeUndefined()
})

test('a análise da semana vem depois dos dias, para não separar hoje de amanhã', () => {
  const tarefa = (id: number, vence: string) => ({ id, titulo: `t${id}`, projeto: 'Financeiro', vence })
  const semana = montarSemana({
    agoraMs: new Date(2026, 9, 15, 9, 0).getTime(), // quinta
    eventos: new Map(),
    tarefas: [tarefa(1, '2026-10-15'), tarefa(2, '2026-10-16')],
    avisos: [],
    contaBasecamp: null,
  })
  const { svg } = desenharSemana(semana, { largura: 400 })
  const posicao = (texto: string) => svg.indexOf(`>${texto}</text>`)
  expect(posicao('Hoje')).toBeLessThan(posicao('Amanhã'))
  expect(posicao('Amanhã')).toBeLessThan(posicao('Sábado'))
  expect(posicao('Sábado')).toBeLessThan(posicao('Tarefas por dia'))
  expect(posicao('Tarefas por dia')).toBeLessThan(posicao('Espaços'))
})

test('a colaboração conta as conversas da semana em que comentei, pelo dono do item', async ($, on) => {
  const pedidos = mundo(on, { comentarios: true })
  const { text } = await $.command.run({ command: 'semana', args: '' })

  // Nesta semana: a 100 é minha, a 101 eu pedi, a 102 e a 103 são de outras
  // pessoas e a 104 não abre, então fica fora da conta. Só a 100 veio de menção.
  expect(text).toBe(`${RESUMO} Colaboração: 4 conversas no Basecamp, 1 por menção com @ e 3 fora das suas tarefas.`)
  // Só as conversas da semana mostrada são abertas, uma vez cada, com os comentários.
  expect([...pedidos.conversas].sort()).toEqual(['100', '101', '102', '103', '104'])

  const ui = await $.ui.mount({ ...PAINEL, surface: 'desktop' })
  const svg = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(svg).toContain('>Colaboração</text>')
  // O destaque ao lado do título é o que está fora das suas tarefas.
  expect(svg).toContain('>3 fora das suas</tspan><tspan class="sec"> de 4 conversas</tspan>')
  expect(svg).toContain('>que você pediu</text>')
  expect(svg).toContain('>de outras pessoas</text>')
  expect(svg).toContain(
    '<title>4 conversas do Basecamp em que você comentou nesta semana · 6 comentários · 1 que não deu para abrir</title>',
  )
  expect(svg).toContain('<title>2 conversas em tarefas e mensagens de outras pessoas, em 2 espaços</title>')
  // Só a semana do painel: nada de comparar com as anteriores.
  expect(svg).not.toContain('Semana passada')
  // Embaixo da legenda, num selo, quantas vieram de menção; "por iniciativa" é a conta que sobra.
  expect(svg).toMatch(/<title>Conversas em que alguém marcou você com @[^<]*É um mínimo[^<]*<\/title>[^]*?>1<\/text>[^]*?>por menção com @<\/text>/)
  expect(svg).not.toContain('por iniciativa')
  // Na barra e na legenda, o que está fora das suas vem primeiro.
  expect(svg.indexOf('>de outras pessoas</text>')).toBeLessThan(svg.indexOf('>que você pediu</text>'))
  expect(svg.indexOf('>que você pediu</text>')).toBeLessThan(svg.indexOf('>sua</text>'))
  expect(svg.indexOf('>de outras pessoas</text>')).toBeLessThan(svg.indexOf('>por menção com @</text>'))
  // A análise termina na colaboração, depois dos espaços.
  expect(svg.indexOf('>Espaços</text>')).toBeLessThan(svg.indexOf('>Colaboração</text>'))
  await ui.unmount()

  const terminal = await $.ui.mount({ ...PAINEL, surface: 'terminal' })
  expect(
    await terminal.find({
      type: 'Text',
      text: /^Colaboração: 4 conversas · 1 sua · 1 que você pediu · 2 de outras pessoas · 1 por menção com @$/,
    }),
  ).toBeDefined()
  await terminal.unmount()

  // Cada conversa fica guardada: a próxima leitura só tenta de novo a que não abriu.
  pedidos.conversas.length = 0
  await $.command.run({ command: 'semana', args: '' })
  expect(pedidos.conversas).toEqual(['104'])

  // A semana passada tem a sua própria conta: a 102, de outra pessoa, e a 105,
  // um documento meu. A menção que chamou o 906 conta lá. A 102 já foi aberta
  // nesta semana, com todos os meus comentários: só a 105 abre.
  pedidos.conversas.length = 0
  const passada = await $.command.run({ command: 'semana', args: 'anterior' })
  expect(passada.text).toContain('Colaboração: 2 conversas no Basecamp, 1 por menção com @ e 1 fora das suas tarefas.')
  expect(pedidos.conversas).toEqual(['105'])
})

test('a conversa só é aberta de novo quando tem comentário meu ainda não conferido', async ($, on) => {
  const pedidos = mundo(on, {
    comentarios: true,
    guardado: {
      conversas: {
        // Lida antes do 901: abre de novo para conferir o 901.
        100: { criador: 8, responsaveis: [7], chamados: { 900: true } },
        101: { criador: 7, responsaveis: [8], chamados: { 902: false } },
        102: { criador: 8, responsaveis: [9], chamados: { 903: false, 906: true } },
        // Guardada sem os comentários: abre de novo.
        103: { criador: 9, responsaveis: [] },
        105: { criador: 7, responsaveis: [], chamados: { 907: false } },
      },
    },
  })
  const { text } = await $.command.run({ command: 'semana', args: '' })
  expect([...pedidos.conversas].sort()).toEqual(['100', '103', '104'])
  expect(text).toContain('Colaboração: 4 conversas no Basecamp, 1 por menção com @ e 3 fora das suas tarefas')
  // O que se leu fica guardado: na próxima, só a que não abre.
  pedidos.conversas.length = 0
  await $.command.run({ command: 'semana', args: '' })
  expect(pedidos.conversas).toEqual(['104'])
})

test('um comentário meu é chamado quando alguém me marca com @ depois do meu anterior', () => {
  const ana = 7
  const c = (id: number, quem: number, em: string, chama = false) => ({ id, em, quem, chama })

  // Fora de ordem, como pode vir: o que vale é a hora.
  expect(
    lerChamados(
      [
        c(3, ana, '2026-10-12T12:00:00Z'),
        c(1, 8, '2026-10-12T09:00:00Z', true),
        c(2, ana, '2026-10-12T10:00:00Z'),
        c(5, ana, '2026-10-13T10:00:00Z'),
        c(4, 9, '2026-10-13T09:00:00Z', true),
        c(6, 8, '2026-10-13T11:00:00Z', true),
      ],
      ana,
    ),
  ).toEqual({ 2: true, 3: false, 5: true })
  // Eu me marcar não conta; uma menção em comentário de outra pessoa sem o meu sgid também não.
  expect(lerChamados([c(1, ana, '2026-10-12T09:00:00Z', true), c(2, 8, '2026-10-12T09:30:00Z'), c(3, ana, '2026-10-12T10:00:00Z')], ana)).toEqual({
    1: false,
    3: false,
  })

  // O filtro procura o meu sgid, com aspas de JSON, e não traz o texto.
  expect(filtroDaConversa('abc')).toContain('contains("abc")')
  expect(filtroDaConversa('abc')).not.toContain('content}')

  // Um comentário meu que não voltou no show (além dos 100) fica como não chamado.
  const resposta = { criador: 8, responsaveis: [ana], comentarios: [c(1, 8, '2026-10-12T09:00:00Z', true), c(2, ana, '2026-10-12T10:00:00Z')] }
  expect(lerConversa(resposta, ana, ['2', '99'])).toEqual({ criador: 8, responsaveis: [ana], chamados: { 2: true, 99: false } })
  expect(lerConversa({ criador: 8, responsaveis: [] }, ana, ['2'])).toBeNull()

  // A conversa abre de novo só quando tem comentário meu ainda não conferido.
  const lida = { criador: 8, responsaveis: [ana], chamados: { 2: true } }
  expect(precisaAbrir(lida, ['2'])).toBe(false)
  expect(precisaAbrir(lida, ['2', '3'])).toBe(true)
  expect(precisaAbrir(undefined, [])).toBe(true)
  expect(comentariosPorConversa({ 1: { dia: '2026-10-12', conversa: 100, espaco: 'A' }, 2: { dia: '2026-10-13', conversa: 100, espaco: 'A' } })).toEqual({
    100: ['1', '2'],
  })
})

test('a colaboração só conta uma semana que a linha do tempo cobre, e nunca uma futura', () => {
  const hoje = '2026-10-13' // terça
  expect(semanaDeColaboracao(hoje, 0, '0000-01-01')).toBe('2026-10-11')
  // Até 4 semanas para trás, o que o /semana alcança, tudo fica guardado.
  expect(semanaDeColaboracao(hoje, -4, '0000-01-01')).toBe('2026-09-13')
  // A linha do tempo só está completa desde 1º de outubro: a semana de 27 de setembro fica sem conta.
  expect(semanaDeColaboracao(hoje, -2, '2026-10-01')).toBeNull()
  expect(semanaDeColaboracao(hoje, -1, '2026-10-01')).toBe('2026-10-04')
  expect(semanaDeColaboracao(hoje, 1, '0000-01-01')).toBeNull()

  // Minha quando sou responsável, ou quando criei e não passei para ninguém.
  expect(deQuem({ criador: 8, responsaveis: [7, 9] }, 7)).toBe('suas')
  expect(deQuem({ criador: 7, responsaveis: [] }, 7)).toBe('suas')
  expect(deQuem({ criador: 7, responsaveis: [8] }, 7)).toBe('pediu')
  expect(deQuem({ criador: 8, responsaveis: [] }, 7)).toBe('outros')
  expect(deQuem(undefined, 7)).toBe('semDono')

  // O guardado por uma versão que não lia comentários pede o histórico de novo.
  const antiga = { dias: { 1: '2026-10-12' }, cobertura: '0000-01-01', lidoAte: '2026-10-12T10:00:00' }
  expect(precisaDoHistorico(antiga, hoje)).toBe(true)
  const lida = lerConclusoes(antiga, [comentario(900, 100, 'Pessoal', '2026-10-12T10:00:00')], 1500, hoje)
  expect(lida.comentarios).toEqual({ 900: { dia: '2026-10-12', conversa: 100, espaco: 'Pessoal' } })
  expect(precisaDoHistorico(lida, hoje)).toBe(false)
  // Comentário mais velho que o que fica guardado sai na leitura seguinte.
  const depois = lerConclusoes(lida, [comentario(901, 100, 'Pessoal', '2026-08-01T10:00:00')], 300, hoje)
  expect(Object.keys(depois.comentarios ?? {})).toEqual(['900'])

  // Sem nenhuma conversa, o painel não desenha o bloco.
  const semConversas = montarSemana({
    agoraMs: new Date(2026, 9, 13, 9, 0).getTime(),
    eventos: new Map(),
    tarefas: [],
    conclusoes: lerConclusoes(undefined, [], 1500, hoje),
    conversas: {},
    eu: 7,
    avisos: [],
    contaBasecamp: null,
  })
  expect(semConversas.colaboracao?.comentarios).toBe(0)
  expect(desenharSemana(semConversas, { largura: 400 }).svg).not.toContain('>Colaboração</text>')
})

test('o chat dos projetos entra na colaboração, e o que publiquei vem numa linha à parte', async ($, on) => {
  mundo(on, { comentarios: true, atividades: true })
  const { text } = await $.command.run({ command: 'semana', args: '' })

  // 3 blocos de conversa no chat, em 2 espaços. Publicado: 2 mensagens, 2
  // documentos (o 810 conta uma vez) e 1 arquivo; o repost fica de fora.
  expect(text).toBe(
    `${RESUMO} Colaboração: 4 conversas no Basecamp, 1 por menção com @ e 3 fora das suas tarefas.` +
      ' Chat dos projetos: 3 conversas. Publicado: 2 mensagens, 2 documentos e 1 arquivo.',
  )

  const ui = await $.ui.mount({ ...PAINEL, surface: 'desktop' })
  const svg = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(svg).toContain('>conversas no chat</text>')
  expect(svg).toMatch(/<title>Blocos de conversa no chat dos projetos[^<]*em 2 espaços[^<]*<\/title>/)
  // O que publiquei é uma linha discreta, sem bloco próprio.
  expect(svg).toContain('>Publicado na semana</text>')
  expect(svg).toContain('>2 mensagens · 2 documentos · 1 arquivo</text>')
  // O chat fecha a colaboração, depois das menções; o que publiquei vem por último.
  expect(svg.indexOf('>por menção com @</text>')).toBeLessThan(svg.indexOf('>conversas no chat</text>'))
  expect(svg.indexOf('>conversas no chat</text>')).toBeLessThan(svg.indexOf('>Publicado na semana</text>'))
  await ui.unmount()

  const terminal = await $.ui.mount({ ...PAINEL, surface: 'terminal' })
  expect(await terminal.find({ type: 'Text', text: /^Chat dos projetos: 3 conversas em 2 espaços$/ })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: /^Publicado: 2 mensagens · 2 documentos · 1 arquivo$/ })).toBeDefined()
  await terminal.unmount()

  // A semana passada tem a sua conta: 1 conversa no chat e 1 documento.
  const passada = await $.command.run({ command: 'semana', args: 'anterior' })
  expect(passada.text).toContain('Chat dos projetos: 1 conversa. Publicado: 1 documento.')
})

test('só com chat, a colaboração aparece sem a barra; o guardado sem chat pede o histórico', async ($, on) => {
  mundo(on, { atividades: true })
  const { text } = await $.command.run({ command: 'semana', args: '' })
  expect(text).toBe(`${RESUMO} Chat dos projetos: 3 conversas. Publicado: 2 mensagens, 2 documentos e 1 arquivo.`)

  const ui = await $.ui.mount({ ...PAINEL, surface: 'desktop' })
  const svg = String((await ui.find({ type: 'Svg' }))?.props.source)
  expect(svg).toContain('>Colaboração</text>')
  expect(svg).toContain('>conversas no chat</text>')
  expect(svg).not.toContain('>que você pediu</text>')
  await ui.unmount()

  // Uma leitura guardada por versão sem o chat e o que publiquei lê o histórico de novo.
  const hoje = '2026-10-13'
  const semChat = { dias: {}, comentarios: {}, cobertura: '0000-01-01', lidoAte: '2026-10-12T10:00:00' }
  expect(precisaDoHistorico(semChat, hoje)).toBe(true)
  const lida = lerConclusoes(semChat, ATIVIDADES, 1500, hoje)
  expect(precisaDoHistorico(lida, hoje)).toBe(false)
  // Rascunho e publicação do mesmo documento: vale o primeiro dia.
  expect(lida.publicacoes?.['810']).toEqual({ dia: '2026-10-11', tipo: 'documento' })
  expect(lida.publicacoes?.['830']).toBeUndefined()
  expect(lida.chats?.['7003']).toEqual({ dia: '2026-10-12', espaco: 'Liderança' })
})
