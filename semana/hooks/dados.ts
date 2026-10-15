// Transforma o que a agenda (Google Calendar) e o Basecamp respondem na
// Semana que o painel desenha. Só funções puras: a busca, que usa o `$`, fica
// no register.tsx, porque o `$` não atravessa imports.
import type { Colaboracao, Comentario, Conclusoes, Criador, Dia, Dono, Evento, Prioridade, Semana, Tarefa } from '../types'

export const DIAS_NA_JANELA = 7

/**
 * Escopos do `basecamp assignments due` que cobrem a semana. No Basecamp a
 * semana também vai de domingo a sábado; o que venceu antes de hoje é `overdue`.
 */
export const ESCOPOS_BASECAMP = ['overdue', 'due_today', 'due_tomorrow', 'due_later_this_week'] as const

/**
 * Os escopos que cobrem a semana pedida. Uma passada só tem pendentes em
 * `overdue`; uma futura pode estar em qualquer escopo depois desta semana. O
 * `montarSemana` filtra pela data, então sobrar não faz mal; faltar faria.
 */
export function escoposDoBasecamp(deslocamento: number): readonly string[] {
  if (deslocamento < 0) return ['overdue']
  if (deslocamento === 0) return ESCOPOS_BASECAMP
  return ['due_tomorrow', 'due_next_week', 'due_later']
}

/**
 * Até onde o /semana vai para frente: um ano. Para trás vai até
 * SEMANAS_DO_RITMO, porque é o que o painel guarda das concluídas.
 */
export const SEMANAS_PARA_FRENTE = 52

/**
 * Quantas semanas depois da de hoje o `/semana <args>` pede: nada é a de hoje,
 * "proxima" é 1, "anterior" é -1 e "+2" ou "-3" contam semanas. Acento,
 * maiúscula e a palavra "semana" não importam. Null quando não entende.
 */
export function lerDeslocamento(args: string): number | null {
  const texto = args
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bsemanas?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (['', 'atual', 'esta', 'essa', 'hoje', '0'].includes(texto)) return 0
  if (['proxima', 'seguinte', 'que vem'].includes(texto)) return 1
  if (['anterior', 'passada'].includes(texto)) return -1
  const numero = texto.replace(/\s/g, '').match(/^([+-]?)(\d{1,3})$/)
  if (numero === null) return null
  const n = Number(numero[2])
  return numero[1] === '-' && n > 0 ? -n : n
}

const SERVIDORES_AGENDA = ['claude.ai Google Calendar', 'Google Calendar']

/**
 * Servidores MCP que podem ser o Google Calendar, do mais provável ao menos:
 * o que funcionou da última vez, os que têm list_events e list_calendars, e
 * os nomes que o conector do claude.ai costuma ter.
 */
export function servidoresDaAgenda(ferramentas: string[], salvo: unknown): string[] {
  const comLista = ferramentas
    .map(nome => nome.match(/^mcp__(.+)__list_events$/)?.[1])
    .filter((s): s is string => s !== undefined)
    .filter(s => ferramentas.includes(`mcp__${s}__list_calendars`))
  return [...new Set([...(typeof salvo === 'string' ? [salvo] : []), ...comLista, ...SERVIDORES_AGENDA])]
}

/**
 * Onde o Claude Code guardou uma resposta grande demais, quando ele troca o
 * conteúdo por um aviso com o caminho do arquivo.
 */
export const caminhoSalvo = (texto: string): string | null =>
  texto.match(/saved to (\/\S+?\.(?:txt|json))\b/)?.[1] ?? null

/** O texto dos blocos de uma resposta MCP. */
export const textoDoResultado = (resultado: { content: { type: string; text?: string }[] }) =>
  resultado.content
    .filter(bloco => bloco.type === 'text')
    .map(bloco => bloco.text ?? '')
    .join('')

const dois = (n: number) => String(n).padStart(2, '0')

export const dataLocal = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

export const somarDias = (data: string, dias: number): string => {
  const [a, m, d] = data.split('-').map(Number)
  const nova = new Date(a ?? 1970, (m ?? 1) - 1, (d ?? 1) + dias)
  return dataLocal(nova.getTime())
}

/** O domingo da semana de `data`: a semana vai de domingo a sábado. */
export const domingoDa = (data: string): string => {
  const [a, m, d] = data.split('-').map(Number)
  return somarDias(data, -new Date(a ?? 1970, (m ?? 1) - 1, d ?? 1).getDay())
}

const minutosDoHorario = (iso: string): number =>
  Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16))

type HorarioBruto = { dateTime?: string; date?: string }
type ConvidadoBruto = { self?: boolean; resource?: boolean; responseStatus?: string }
type EventoBruto = {
  id?: string
  summary?: string
  status?: string
  eventType?: string
  start?: HorarioBruto
  end?: HorarioBruto
  attendees?: ConvidadoBruto[]
}

/** Eventos da agenda, por data AAAA-MM-DD, sem os recusados e cancelados. */
export function normalizarEventos(bruto: unknown): Map<string, Evento[]> {
  const porDia = new Map<string, Evento[]>()
  const eventos = (bruto as { events?: EventoBruto[] } | null)?.events ?? []
  const vistos = new Set<string>()

  for (const e of eventos) {
    if (e.status === 'cancelled' || e.eventType === 'WORKING_LOCATION') continue
    // A agenda é lida dia a dia: um evento de vários dias volta em cada um.
    const chave = `${e.id ?? e.summary}|${e.start?.dateTime ?? e.start?.date}`
    if (vistos.has(chave)) continue
    vistos.add(chave)
    const eu = e.attendees?.find(a => a.self === true)
    if (eu?.responseStatus === 'declined') continue

    const inicio = e.start?.dateTime ?? e.start?.date
    if (inicio === undefined) continue
    const diaInteiro = e.start?.dateTime === undefined
    const fimIso = e.end?.dateTime
    const outros = (e.attendees ?? []).filter(a => a.self !== true && a.resource !== true)

    const evento: Evento = {
      titulo: (e.summary ?? '(sem título)').trim(),
      inicio: diaInteiro ? 0 : minutosDoHorario(inicio),
      fim: diaInteiro || fimIso === undefined ? 24 * 60 : minutosDoHorario(fimIso),
      diaInteiro,
      comPessoas: outros.length > 0,
    }
    // Termina depois da meia-noite: corta no fim do dia.
    if (evento.fim <= evento.inicio) evento.fim = 24 * 60

    const data = inicio.slice(0, 10)
    porDia.set(data, [...(porDia.get(data) ?? []), evento])
  }

  for (const lista of porDia.values()) lista.sort((a, b) => a.inicio - b.inicio)
  return porDia
}

type TarefaBruta = {
  id?: number
  content?: string
  title?: string
  due_on?: string | null
  bucket?: { name?: string }
  app_url?: string
}

const URGENTE = '\u{1F534}' // 🔴
const IMPORTANTE = '\u{1F7E2}' // 🟢

/** Os ícones no começo do título (emoji e símbolos), antes da primeira letra. */
function iconesDoInicio(titulo: string): string[] {
  const icones: string[] = []
  for (const c of titulo.trimStart()) {
    const cp = c.codePointAt(0) ?? 0
    if (c === ' ' || cp === 0xfe0f || cp === 0x200d || (cp >= 0x1f3fb && cp <= 0x1f3ff)) continue
    if (cp < 0x2190) break
    icones.push(c)
  }
  return icones
}

/**
 * A importância de uma tarefa pelo ícone no começo do título: 0 para 🔴
 * (urgente), 1 para 🟢 (importante), 2 para outro ícone e 3 para nenhum.
 */
export function importancia(titulo: string): number {
  const icones = iconesDoInicio(titulo)
  if (icones.includes(URGENTE)) return 0
  if (icones.includes(IMPORTANTE)) return 1
  return icones.length > 0 ? 2 : 3
}

/**
 * O título sem o 🔴 e o 🟢 do começo, que no painel viram a cor do marcador.
 * Os outros ícones ficam.
 */
export function semMarcaDePrioridade(titulo: string): string {
  const letras = Array.from(titulo.trimStart())
  const mantidos: string[] = []
  let i = 0
  for (; i < letras.length; i++) {
    const c = letras[i] ?? ''
    const cp = c.codePointAt(0) ?? 0
    if (c === ' ' || cp === 0xfe0f || cp === 0x200d || (cp >= 0x1f3fb && cp <= 0x1f3ff)) {
      if (mantidos.length > 0) mantidos.push(c)
      continue
    }
    if (cp < 0x2190) break
    if (c !== URGENTE && c !== IMPORTANTE) mantidos.push(c)
  }
  const limpo = `${mantidos.join('').trim()} ${letras.slice(i).join('')}`.trim()
  return limpo === '' ? titulo.trim() : limpo
}

/** Ordena por importância; dentro de cada grupo, mantém a ordem que veio (a do vencimento). */
export const porImportancia = (tarefas: Tarefa[]): Tarefa[] =>
  [...tarefas].sort((a, b) => importancia(a.titulo) - importancia(b.titulo))

/** Tarefas do Basecamp sem repetição, de uma ou mais respostas `--json`. */
export function normalizarTarefas(respostas: unknown[]): Tarefa[] {
  const vistas = new Map<number, Tarefa>()

  for (const resposta of respostas) {
    const itens = (resposta as { data?: unknown } | null)?.data
    if (!Array.isArray(itens)) continue
    for (const t of itens as TarefaBruta[]) {
      if (t.id === undefined || t.due_on === undefined || vistas.has(t.id)) continue
      vistas.set(t.id, {
        id: t.id,
        titulo: (t.content ?? t.title ?? '(sem título)').trim(),
        projeto: t.bucket?.name?.trim() ?? '',
        vence: t.due_on,
      })
    }
  }

  return [...vistas.values()].sort((a, b) => a.vence.localeCompare(b.vence))
}

/** O Up next (as "prioridades" de minhas tarefas no Basecamp), com ou sem data. */
export function normalizarUpNext(resposta: unknown): Prioridade[] {
  const itens = (resposta as { data?: { priorities?: unknown } } | null)?.data?.priorities
  if (!Array.isArray(itens)) return []
  return (itens as TarefaBruta[]).flatMap(t =>
    t.id === undefined
      ? []
      : [{ id: t.id, titulo: (t.content ?? t.title ?? '(sem título)').trim(), projeto: t.bucket?.name?.trim() ?? '', vence: t.due_on ?? null }],
  )
}

/** Quantos eventos pedir à linha do tempo: muitos na primeira leitura, poucos depois. */
export const EVENTOS_NA_PRIMEIRA_LEITURA = 1500
export const EVENTOS_POR_LEITURA = 300

/** O primeiro dia que o ritmo usa: o domingo de SEMANAS_DO_RITMO semanas atrás. */
export const inicioDoRitmo = (hoje: string) => somarDias(domingoDa(hoje), -7 * SEMANAS_DO_RITMO)

/** O primeiro dia que fica guardado da linha do tempo: uma semana antes do ritmo. */
const corteDaLinhaDoTempo = (hoje: string) => somarDias(inicioDoRitmo(hoje), -7)

/** As conclusões guardadas, se o que veio do armazenamento tiver a forma certa. */
export function comoConclusoes(valor: unknown): Conclusoes | undefined {
  const c = valor as Partial<Conclusoes> | null | undefined
  const comentariosOk = c?.comentarios === undefined || (typeof c.comentarios === 'object' && c.comentarios !== null)
  return typeof c?.dias === 'object' && c.dias !== null && typeof c.cobertura === 'string' && typeof c.lidoAte === 'string' && comentariosOk
    ? (c as Conclusoes)
    : undefined
}

/**
 * Ler a linha do tempo desde longe: nada guardado, o guardado não cobre o
 * ritmo, ou veio de uma versão que ainda não guardava os comentários.
 */
export const precisaDoHistorico = (salvas: Conclusoes | undefined, hoje: string) =>
  salvas === undefined || salvas.comentarios === undefined || salvas.cobertura > inicioDoRitmo(hoje)

/**
 * O filtro do `basecamp timeline me --agent --jq`: de cada evento, o tipo, a
 * hora e o endereço; de um comentário, também a conversa e o espaço.
 */
export const FILTRO_DA_LINHA_DO_TEMPO =
  '[.[] | {kind, created_at, url} + (if .kind == "comment_created" then {conversa: .parent_recording_id, espaco: .bucket.name} else {} end)]'

type EventoDaLinhaDoTempo = {
  kind?: string
  created_at?: string
  url?: string
  app_url?: string
  conversa?: unknown
  espaco?: unknown
}

/**
 * Junta o que a linha do tempo respondeu ao que já estava guardado. Vale o
 * último evento de cada tarefa: concluída entra com o dia; reaberta sai. Uma
 * resposta que chegou ao limite só garante os dias depois do seu evento mais
 * antigo; e se uma leitura curta não alcança a anterior, o buraco entre as
 * duas faz a próxima leitura buscar o histórico de novo.
 */
export function lerConclusoes(salvas: Conclusoes | undefined, eventos: unknown[], limite: number, hoje: string): Conclusoes {
  const doHistorico = precisaDoHistorico(salvas, hoje)
  const dias: Record<string, string> = doHistorico ? {} : { ...salvas?.dias }
  const comentarios: Record<string, Comentario> = doHistorico ? {} : { ...salvas?.comentarios }
  const instante = (e: EventoDaLinhaDoTempo) => Date.parse(e.created_at ?? '')
  const ordenados = (eventos as EventoDaLinhaDoTempo[])
    .filter(e => typeof e?.created_at === 'string' && !Number.isNaN(instante(e)))
    .sort((a, b) => instante(a) - instante(b))

  for (const e of ordenados) {
    if (e.kind === 'comment_created') {
      const comentario = (e.url ?? '').match(/\/comments\/(\d+)/)?.[1]
      if (comentario !== undefined && typeof e.conversa === 'number') {
        const espaco = typeof e.espaco === 'string' ? e.espaco.trim() : ''
        comentarios[comentario] = { dia: dataLocal(instante(e)), conversa: e.conversa, espaco }
      }
      continue
    }
    const id = (e.url ?? e.app_url ?? '').match(/\/todos\/(\d+)/)?.[1]
    if (id === undefined) continue
    if (e.kind === 'todo_completed') dias[id] = dataLocal(instante(e))
    else if (e.kind === 'todo_uncompleted') delete dias[id]
  }

  const maisAntigo = ordenados[0]
  const maisNovo = ordenados.at(-1)?.created_at ?? salvas?.lidoAte ?? ''
  const lidoAntes = Date.parse(salvas?.lidoAte ?? '')
  const cobertura =
    eventos.length < limite || maisAntigo === undefined
      ? '0000-01-01'
      : doHistorico || !(instante(maisAntigo) <= lidoAntes)
        ? somarDias(dataLocal(instante(maisAntigo)), 1)
        : (salvas?.cobertura ?? '0000-01-01')

  // O que é mais velho que o ritmo precisa não fica guardado.
  const corte = corteDaLinhaDoTempo(hoje)
  return {
    dias: Object.fromEntries(Object.entries(dias).filter(([, dia]) => dia >= corte)),
    comentarios: Object.fromEntries(Object.entries(comentarios).filter(([, c]) => c.dia >= corte)),
    cobertura,
    lidoAte: maisNovo,
  }
}

/** Quantas semanas o gráfico de colaboração mostra: a da semana e as anteriores. */
export const SEMANAS_DE_COLABORACAO = 4

/**
 * Os domingos das semanas que o gráfico de colaboração mostra: a semana
 * mostrada e as anteriores, da mais nova à mais antiga. Fica de fora a que a
 * linha do tempo não cobre inteira ou que já saiu do que fica guardado; uma
 * semana futura não tem nenhuma.
 */
export function semanasDeColaboracao(hoje: string, deslocamento: number, cobertura: string): string[] {
  if (deslocamento > 0) return []
  const domingo = somarDias(domingoDa(hoje), 7 * deslocamento)
  const corte = corteDaLinhaDoTempo(hoje)
  const primeiro = cobertura > corte ? cobertura : corte
  return Array.from({ length: SEMANAS_DE_COLABORACAO }, (_, i) => somarDias(domingo, -7 * i)).filter(d => d >= primeiro)
}

/** Os comentários feitos de `domingo` a sábado. */
const comentariosDaSemana = (comentarios: Record<string, Comentario>, domingo: string) => {
  const sabado = somarDias(domingo, DIAS_NA_JANELA - 1)
  return Object.values(comentarios).filter(c => c.dia >= domingo && c.dia <= sabado)
}

/** As conversas em que comentei nas semanas que começam nos `domingos`, sem repetir. */
export function conversasDasSemanas(comentarios: Record<string, Comentario>, domingos: string[]): number[] {
  return [...new Set(domingos.flatMap(domingo => comentariosDaSemana(comentarios, domingo).map(c => c.conversa)))]
}

/** O filtro do `basecamp show <id> --jq` que traz só quem criou o item e quem é responsável. */
export const FILTRO_DO_DONO = '.data | {criador: .creator.id, responsaveis: [.assignees[]?.id]}'

/** O dono, da resposta de `basecamp show <id> --jq FILTRO_DO_DONO`. */
export function lerDono(resposta: unknown): Dono | null {
  const d = resposta as { criador?: unknown; responsaveis?: unknown } | null
  return typeof d?.criador === 'number' && Array.isArray(d.responsaveis) && d.responsaveis.every(r => typeof r === 'number')
    ? { criador: d.criador, responsaveis: d.responsaveis as number[] }
    : null
}

/** Os donos guardados, se o que veio do armazenamento tiver a forma certa. */
export const comoDonos = (valor: unknown): Record<string, Dono> => comoGuardados(valor, lerDono)

/**
 * De quem é a conversa: minha, quando sou responsável ou quando criei e não
 * passei para ninguém (uma mensagem, um documento); que eu pedi, quando criei
 * e outra pessoa é a responsável; de outras pessoas no resto.
 */
export function deQuem(dono: Dono | undefined, eu: number): 'suas' | 'pediu' | 'outros' | 'semDono' {
  if (dono === undefined) return 'semDono'
  if (dono.responsaveis.includes(eu)) return 'suas'
  if (dono.criador === eu) return dono.responsaveis.length > 0 ? 'pediu' : 'suas'
  return 'outros'
}

/** As conversas em que comentei em cada semana, divididas pelo dono do item comentado. */
export function lerColaboracao(
  comentarios: Record<string, Comentario>,
  donos: Record<string, Dono>,
  eu: number,
  domingos: string[],
): Colaboracao[] {
  return domingos.map(domingo => {
    const daSemana = comentariosDaSemana(comentarios, domingo)
    const conversas = new Map(daSemana.map(c => [c.conversa, c.espaco]))
    const conta = { suas: 0, pediu: 0, outros: 0, semDono: 0 }
    const espacosDeOutros = new Set<string>()
    for (const [conversa, espaco] of conversas) {
      const dono = deQuem(donos[String(conversa)], eu)
      conta[dono]++
      if (dono === 'outros') espacosDeOutros.add(espaco)
    }
    return { domingo, ...conta, comentarios: daSemana.length, espacosDeOutros: espacosDeOutros.size }
  })
}

/** Meu id de pessoa na conta, da resposta de `basecamp people show me --json`. */
export function pessoaDoBasecamp(resposta: unknown): number | null {
  const id = (resposta as { data?: { id?: unknown } } | null)?.data?.id
  return typeof id === 'number' ? id : null
}

/** O filtro do `basecamp show <id> --jq` que traz só quem criou o item. */
export const FILTRO_DO_CRIADOR = '.data.creator | {id, nome: .name}'

/** Quem criou, da resposta de `basecamp show <id> --jq FILTRO_DO_CRIADOR`. */
export function lerCriador(resposta: unknown): Criador | null {
  const c = resposta as { id?: unknown; nome?: unknown } | null
  return typeof c?.id === 'number' && typeof c.nome === 'string' && c.nome.trim() !== ''
    ? { id: c.id, nome: c.nome.trim() }
    : null
}

/**
 * Quantos criadores (e quantos donos de conversa) guardar entre leituras: quem
 * criou um item não muda, mas a lista não cresce sem fim.
 */
export const CRIADORES_GUARDADOS = 3000

/** O que estava guardado por id, só com os itens que `ler` aceita. */
function comoGuardados<T>(valor: unknown, ler: (item: unknown) => T | null): Record<string, T> {
  if (typeof valor !== 'object' || valor === null) return {}
  return Object.fromEntries(
    Object.entries(valor).flatMap(([id, item]) => {
      const lido = ler(item)
      return lido === null ? [] : [[id, lido]]
    }),
  )
}

/** Os criadores guardados, se o que veio do armazenamento tiver a forma certa. */
export const comoCriadores = (valor: unknown): Record<string, Criador> => comoGuardados(valor, lerCriador)

/**
 * Junta os itens novos aos guardados. Além do limite, saem os de id menor,
 * que são os mais antigos: um objeto ordena chaves numéricas pelo valor.
 */
export function juntarGuardados<T>(salvos: Record<string, T>, novos: Record<string, T>): Record<string, T> {
  const todos = Object.entries({ ...salvos, ...novos })
  return Object.fromEntries(todos.slice(Math.max(0, todos.length - CRIADORES_GUARDADOS)))
}

/** Junta os criadores novos aos guardados, até o limite. */
export const juntarCriadores = (salvos: Record<string, Criador>, novos: Record<string, Criador>) => juntarGuardados(salvos, novos)

/** Em que pé está uma tarefa que entra no total da semana. */
export type Estado = 'feita' | 'atrasada' | 'aFazer'

/**
 * As tarefas que formam o total da semana, as mesmas da barra do topo: as
 * concluídas nela, as atrasadas e o que vence de hoje até sábado.
 */
export function tarefasDoTotal(semana: Semana): { tarefa: Tarefa; estado: Estado }[] {
  return [
    ...semana.dias.flatMap(x => x.feitas ?? []).map(tarefa => ({ tarefa, estado: 'feita' as const })),
    ...semana.atrasadas.map(tarefa => ({ tarefa, estado: 'atrasada' as const })),
    ...semana.dias
      .filter(x => x.data >= semana.hoje)
      .flatMap(x => x.tarefas)
      .map(tarefa => ({ tarefa, estado: 'aFazer' as const })),
  ]
}

/** O primeiro nome de quem está logado, da resposta de `basecamp me --json`. */
export function primeiroNome(resposta: unknown): string | null {
  const nome = (resposta as { data?: { identity?: { first_name?: unknown } } } | null)?.data?.identity?.first_name
  return typeof nome === 'string' && nome.trim() !== '' ? nome.trim() : null
}

export function contaDoBasecamp(respostas: unknown[]): string | null {
  for (const resposta of respostas) {
    const itens = (resposta as { data?: TarefaBruta[] } | null)?.data
    const url = Array.isArray(itens) ? itens[0]?.app_url : undefined
    const conta = url?.match(/basecamp\.com\/(\d+)\//)?.[1]
    if (conta !== undefined) return conta
  }
  return null
}

const DIAS_UTEIS = 5
/** Quantas semanas para trás formam o ritmo. */
export const SEMANAS_DO_RITMO = 4

/**
 * Junta tudo numa semana de domingo a sábado: a de hoje, com as atrasadas e o
 * Up next, ou outra, `deslocamento` semanas antes ou depois.
 */
export function montarSemana(args: {
  agoraMs: number
  /** Quantas semanas depois da de hoje; 0 quando não vem. */
  deslocamento?: number
  eventos: Map<string, Evento[]>
  tarefas: Tarefa[]
  /** Minhas tarefas concluídas recentes; sem elas, nada de concluídas nem de ritmo. */
  concluidas?: Tarefa[]
  /** Quando cada uma foi concluída, da linha do tempo; sem isso, conta o dia em que vencia. */
  conclusoes?: Conclusoes
  /** O Up next; as que têm data contam como as outras tarefas. */
  upNext?: Prioridade[]
  avisos: string[]
  contaBasecamp: string | null
  /** Primeiro nome no Basecamp; sem ele, o título fica genérico. */
  nome?: string | null
  /** Quem criou cada tarefa, por id; a que não estiver aqui fica sem criador. */
  criadores?: Record<string, Criador>
  /** Meu id de pessoa no Basecamp. */
  eu?: number | null
  /** De quem é cada conversa comentada, por id; sem isso, a semana fica sem colaboração. */
  donos?: Record<string, Dono>
}): Semana {
  const comCriador = (t: Tarefa): Tarefa => {
    const criador = args.criadores?.[String(t.id)]
    return criador === undefined ? t : { ...t, criador }
  }
  const upNext = args.upNext ?? []
  const jaListadas = new Set(args.tarefas.map(t => t.id))
  const tarefas = [
    ...args.tarefas,
    ...upNext.flatMap(t => (t.vence === null || jaListadas.has(t.id) ? [] : [{ ...t, vence: t.vence }])),
  ].map(comCriador)
  const pendentes = new Set(tarefas.map(t => t.id))
  const concluidas = (args.concluidas ?? []).filter(t => !pendentes.has(t.id)).map(comCriador)
  const conclusoes: { tarefa: Tarefa; dia: string }[] =
    args.conclusoes === undefined
      ? concluidas.map(tarefa => ({ tarefa, dia: tarefa.vence }))
      : concluidas.flatMap(tarefa => {
          const dia = args.conclusoes?.dias[String(tarefa.id)]
          return dia === undefined ? [] : [{ tarefa, dia }]
        })
  const feitasEm = (data: string) => conclusoes.filter(c => c.dia === data).map(c => c.tarefa)
  const concluidasEm = (data: string) => feitasEm(data).length
  const hoje = dataLocal(args.agoraMs)
  const deslocamento = args.deslocamento ?? 0
  // O ritmo conta da semana de hoje, qualquer que seja a semana mostrada.
  const domingoDeHoje = domingoDa(hoje)
  const domingo = somarDias(domingoDeHoje, 7 * deslocamento)
  const sabado = somarDias(domingo, DIAS_NA_JANELA - 1)
  const agora = new Date(args.agoraMs)
  const dias: Dia[] = []

  for (let i = 0; i < DIAS_NA_JANELA; i++) {
    const data = somarDias(domingo, i)
    dias.push({
      data,
      eventos: args.eventos.get(data) ?? [],
      tarefas: porImportancia(tarefas.filter(t => t.vence === data)),
      concluidas: concluidasEm(data),
      feitas: feitasEm(data),
    })
  }

  // O ritmo: concluídas de segunda a sexta nas últimas semanas, por dia útil.
  // Uma semana sem nenhuma concluída (férias), ou que a linha do tempo não
  // cobre inteira, fica de fora, para não puxar a média para baixo.
  const cobertura = args.conclusoes?.cobertura ?? '0000-01-01'
  const feitasPorSemana = Array.from({ length: SEMANAS_DO_RITMO }, (_, s) => {
    const domingoDaSemana = somarDias(domingoDeHoje, -7 * (s + 1))
    if (somarDias(domingoDaSemana, 1) < cobertura) return 0
    return Array.from({ length: DIAS_UTEIS }, (_, i) => concluidasEm(somarDias(domingoDaSemana, i + 1))).reduce((a, b) => a + b, 0)
  }).filter(n => n > 0)
  const totalFeito = feitasPorSemana.reduce((a, b) => a + b, 0)

  // A colaboração precisa saber quem sou e de quem é cada conversa.
  const comentarios = args.conclusoes?.comentarios
  const colaboracao =
    comentarios === undefined || args.donos === undefined || args.eu === undefined || args.eu === null
      ? undefined
      : lerColaboracao(comentarios, args.donos, args.eu, semanasDeColaboracao(hoje, deslocamento, args.conclusoes?.cobertura ?? ''))

  // Fora da semana de hoje, as atrasadas são só as da semana mostrada, e o Up
  // next, que é do bloco Hoje, fica de fora.
  const daSemana = (t: Tarefa) => deslocamento === 0 || (t.vence >= domingo && t.vence <= sabado)

  return {
    hoje,
    deslocamento,
    agora: agora.getHours() * 60 + agora.getMinutes(),
    dias,
    atrasadas: porImportancia(tarefas.filter(t => t.vence < hoje && daSemana(t))),
    upNext: deslocamento === 0 ? upNext : [],
    ritmo: feitasPorSemana.length > 0 ? totalFeito / (feitasPorSemana.length * DIAS_UTEIS) : null,
    atualizadoEm: `${dois(agora.getHours())}:${dois(agora.getMinutes())}`,
    avisos: args.avisos,
    contaBasecamp: args.contaBasecamp,
    nome: args.nome ?? null,
    eu: args.eu ?? null,
    ...(colaboracao === undefined ? {} : { colaboracao }),
  }
}
