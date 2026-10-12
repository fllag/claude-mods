import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { importancia, lerConclusoes, montarSemana, primeiroNome, semMarcaDePrioridade } from '../hooks/dados'
import { alemDoRitmo, cargaDaSemana, desenharSemana, duracao, tituloDaSemana } from '../hooks/painel'

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
  ],
}

const URL_TAREFA = 'https://app.basecamp.com/123/buckets/1/todos/1'
const TAREFAS: Record<string, unknown[]> = {
  overdue: [{ id: 1, content: 'Revisão semanal', due_on: '2026-10-09', bucket: { name: 'Pessoal' }, app_url: URL_TAREFA }],
  due_today: [{ id: 2, content: 'Fechar proposta', due_on: '2026-10-13', bucket: { name: 'Comercial' }, app_url: URL_TAREFA }],
  due_tomorrow: [{ id: 3, content: 'Revisar contrato', due_on: '2026-10-14', bucket: { name: 'Jurídico' }, app_url: URL_TAREFA }],
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

// No Up next, uma tarefa que venceu na segunda passada.
const UP_NEXT = [{ id: 50, content: 'Revisar metas do trimestre', due_on: '2026-10-05', bucket: { name: 'Pessoal' } }]

const RESUMO =
  // Hoje conta tudo o que vence no dia: 1 a fazer e 1 concluída. As atrasadas
  // são a da semana passada e a do Up next. A semana soma 2 concluídas, 2
  // atrasadas e 2 a fazer; nada passa do ritmo, então o texto não fala dele.
  'Hoje: 2 tarefas (1 concluída), 2 atrasadas e 1 reunião. Semana de 11 a 17 de outubro: 6 tarefas e 2 concluídas.'

type Mundo = {
  agenda?: boolean
  /** `ausente`: a CLI não está instalada; `sem-login`: roda, mas responde com erro. */
  basecamp?: 'ok' | 'ausente' | 'sem-login'
}

/** Agenda, Basecamp e o resto do Claude Code respondendo de memória. */
function mundo(on: On, { agenda: agendaFunciona = true, basecamp = 'ok' }: Mundo = {}) {
  mock.clock(on, { now: AGORA })
  mock.store(on)
  mock.env(on, { HOME: '/Users/teste' })
  on('tool.list', () => ({
    value: [
      { name: 'mcp__agenda__list_events', description: 'Lista eventos', mcp: true },
      { name: 'mcp__agenda__list_calendars', description: 'Lista agendas', mcp: true },
    ],
  }))
  on('mcp.call', ($, e) => ({
    value:
      agendaFunciona && e.server === 'agenda' && e.tool === 'list_events'
        ? { content: [{ type: 'text', text: JSON.stringify(AGENDA) }], isError: false }
        : { content: [{ type: 'text', text: 'indisponível' }], isError: true },
  }))
  on('process.run', ($, e) => {
    if (basecamp === 'ausente') throw new Error(`spawn ${e.argv[0]} ENOENT`)
    if (basecamp === 'sem-login') return { value: { exitCode: 1, stdout: '', stderr: 'not authenticated' } }
    const [, grupo, sub, escopo] = e.argv
    // A linha do tempo vem com --agent: só os dados, sem o envelope.
    const stdout =
      grupo === 'timeline'
        ? JSON.stringify(LINHA_DO_TEMPO)
        : JSON.stringify({
            ok: true,
            data:
              grupo === 'me'
                ? { identity: { first_name: 'Ana', last_name: 'Teste' }, accounts: [] }
                : sub === 'completed'
                  ? CONCLUIDAS
                  : sub === 'list'
                    ? { priorities: UP_NEXT, non_priorities: [] }
                    : (TAREFAS[escopo ?? ''] ?? []),
          })
    return { value: { exitCode: 0, stdout, stderr: '' } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
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
  expect(String(svg?.props.source)).toContain('Fechar proposta')
  // A atrasada da semana passada fica dentro de Hoje, com a data em que venceu.
  expect(String(svg?.props.source)).toContain('>Revisão semanal</text>')
  expect(String(svg?.props.source)).toContain('>venceu 9 out</text>')
  expect(String(svg?.props.source)).toContain('>Semana de Ana</text>')
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

  // O primeiro nome vem do Basecamp, com "de" para servir a qualquer pessoa.
  expect(await ui.find({ type: 'Text', text: /Semana de Ana · 11 a 17 de outubro/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /14:00 {2}1:1 - Ana/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /○ Fechar proposta/ })).toBeDefined()
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
  expect(svg).toContain('>Sua semana</text>')
  await ui.unmount()
})

test('com a CLI do Basecamp sem login, o aviso pede o login', async ($, on) => {
  mundo(on, { basecamp: 'sem-login' })
  const { text } = await $.command.run({ command: 'semana', args: '' })
  expect(text).toContain('Não consegui ler o Basecamp. Rode basecamp auth login e tente de novo.')
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
  // Nas listas o emoji sai do título e vira a cor da bolinha.
  expect(svg).toContain('>atrasada desta semana</text>')
  expect(svg).toContain('>t0</text>')
  // Hoje mostra no máximo 3 tarefas: das 10 de quinta, sobram 7.
  expect(svg).toContain('>+ 7 tarefas</text>')

  // Sem ritmo não há o que passe dele: sem traço, sem listras, sem veredito.
  const semRitmo = desenharSemana({ ...semana, ritmo: null }, { largura: 400 }).svg
  expect(semRitmo).not.toContain('seu ritmo</text>')
  expect(semRitmo).not.toContain('além do ritmo')
  expect(semRitmo).toContain('>importantes</text>')

  // Num painel estreito o rótulo do total encurta e nada passa da borda.
  expect(desenharSemana(semana, { largura: 300 }).svg).toContain('>tarefas</text>')
})

test('hoje traz as atrasadas, e os próximos dias listam as reuniões', () => {
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

  // Sem seção própria de atrasadas e sem a linha dos dias que já passaram.
  expect(svg).not.toContain('>Atrasadas</text>')
  expect(svg).not.toContain('já passaram')
  expect(svg).toContain('>Atrasada de domingo</text>')
  expect(svg).toContain('>venceu dom</text>')
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

test('o Up next abre o dia, conta pela data e não se repete nas listas', () => {
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
  // Amanhã conta as duas, mas lista só a que não está no Up next.
  expect(svg).toContain('>2 tarefas</text>')
  expect(svg.match(/>Fechar contrato<\/text>/g)?.length).toBe(1)
  expect(svg).toContain('>Tarefa de amanhã</text>')
})

test('o título usa o primeiro nome do Basecamp, sem adivinhar "do" ou "da"', () => {
  expect(primeiroNome({ ok: true, data: { identity: { first_name: '  Joe ', last_name: 'Silva' } } })).toBe('Joe')
  expect(primeiroNome({ ok: true, data: { identity: { first_name: '' } } })).toBeNull()
  expect(primeiroNome(null)).toBeNull()

  expect(tituloDaSemana('Ana')).toBe('Semana de Ana')
  expect(tituloDaSemana(null)).toBe('Sua semana')
  // Leitura salva por versão anterior, sem o campo.
  expect(tituloDaSemana(undefined)).toBe('Sua semana')
})
