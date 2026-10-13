// Desenha a Semana como um SVG na identidade da Hospedin. Função pura: não
// conhece o Claude Code, então roda igual no mod, nos testes e na prévia.
import type { Dia, Prioridade, Semana, Tarefa } from '../types'
import { importancia, porPrioridade, semMarcaDePrioridade } from './dados'

const COR = {
  roxo: '#765AA6',
  amarelo: '#FBDE64',
  coral: '#F06672',
  verde: '#32BBAA',
  texto: '#29415E',
  textoSec: '#536580',
  card: '#EAEFF6',
  borda: '#D6DDEE',
  branco: '#FFFFFF',
  noite: '#1E3045',
}

const FONTE = "Nunito, 'Open Sans', -apple-system, 'Segoe UI', sans-serif"

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// Símbolo da Hospedin (a casa com H), traçado do logo oficial em 1060 x 1220.
const LOGO =
  'M0 530L530 0L742 212V93H879V350L1060 530L962 627L530 195L98 627Z' +
  'M180 627L353 455V739H707V455L879 627V1077H962V1220H624V1077H707V876H353V1077H436V1220H97V1077H180Z'

// Claro por padrão. No tema escuro o fundo vira o azul de alto contraste da
// marca, e o roxo (que some nele) cede lugar ao branco, com o amarelo no destaque.
const ESTILO = `
  text { font-family: ${FONTE}; }
  .fundo { fill: ${COR.branco}; }
  .card { fill: ${COR.card}; }
  .txt { fill: ${COR.texto}; }
  .sec { fill: ${COR.textoSec}; }
  .hoje { fill: ${COR.roxo}; }
  .linha { stroke: ${COR.borda}; }
  .trilha { fill: ${COR.card}; }
  .trilha.em-card { fill: ${COR.branco}; }
  .reuniao { fill: ${COR.roxo}; }
  .bloco { fill: ${COR.roxo}; fill-opacity: 0.3; }
  .tarefa { stroke: ${COR.roxo}; fill: none; }
  .agora { stroke: ${COR.texto}; }
  .coluna { fill: ${COR.roxo}; }
  .feita { fill: ${COR.verde}; }
  .atrasada { fill: ${COR.coral}; }
  .media { stroke: ${COR.textoSec}; }
  .pilula { fill: ${COR.roxo}; }
  .pilula-vazada { fill: none; stroke: ${COR.textoSec}; }
  .halo { stroke: ${COR.branco}; stroke-width: 4px; stroke-linejoin: round; paint-order: stroke; }
  @media (prefers-color-scheme: dark) {
    .fundo { fill: ${COR.noite}; }
    .card { fill: ${COR.texto}; }
    .txt { fill: ${COR.branco}; }
    .sec { fill: ${COR.borda}; }
    .hoje { fill: ${COR.amarelo}; }
    .linha { stroke: ${COR.texto}; }
    .trilha { fill: ${COR.texto}; }
    .trilha.em-card { fill: ${COR.noite}; }
    .reuniao { fill: ${COR.branco}; }
    .bloco { fill: ${COR.borda}; fill-opacity: 0.25; }
    .media { stroke: ${COR.borda}; }
    .pilula-vazada { stroke: ${COR.borda}; }
    .halo { stroke: ${COR.noite}; }
    .tarefa { stroke: ${COR.borda}; }
    .agora { stroke: ${COR.branco}; }
  }
`

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Avanço de cada caractere da Nunito em milésimos de "em", medido no
// navegador (Regular e Bold). Fora da tabela, a média das minúsculas.
const CARACTERES =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~" +
  'ÀÁÂÃÇÉÊÍÓÔÕÚÜàáâãçéêíóôõúü…·–—°ºª'
const AVANCOS: Record<'regular' | 'negrito', number[]> = {
  regular: [
    258, 228, 392, 600, 600, 930, 693, 221, 317, 317, 450, 600, 228, 424, 228, 283, 600, 600, 600, 600,
    600, 600, 600, 600, 600, 600, 228, 228, 600, 600, 600, 443, 946, 729, 676, 673, 742, 583, 548, 726,
    761, 257, 324, 625, 543, 855, 740, 767, 633, 767, 669, 615, 602, 728, 689, 1101, 650, 596, 589, 315,
    283, 315, 600, 500, 356, 530, 583, 463, 583, 532, 333, 586, 568, 232, 236, 500, 296, 856, 568, 556,
    583, 583, 358, 481, 350, 561, 515, 841, 525, 514, 463, 352, 265, 352, 600, 729, 729, 729, 729, 673,
    583, 583, 257, 767, 767, 767, 728, 728, 530, 530, 530, 530, 463, 532, 532, 232, 556, 556, 556, 561,
    561, 686, 228, 500, 1000, 371, 339, 327,
  ],
  negrito: [
    271, 248, 448, 600, 600, 945, 726, 243, 358, 358, 453, 600, 248, 434, 248, 313, 600, 600, 600, 600,
    600, 600, 600, 600, 600, 600, 248, 248, 600, 600, 600, 459, 950, 744, 688, 680, 762, 597, 562, 736,
    773, 282, 354, 665, 562, 868, 748, 785, 652, 785, 686, 631, 621, 738, 713, 1113, 672, 618, 605, 354,
    313, 354, 600, 500, 377, 547, 600, 472, 600, 542, 364, 604, 585, 255, 259, 536, 319, 877, 585, 576,
    600, 600, 392, 488, 384, 579, 527, 853, 546, 526, 474, 391, 288, 391, 600, 744, 744, 744, 744, 680,
    597, 597, 282, 785, 785, 785, 738, 738, 547, 547, 547, 547, 472, 542, 542, 255, 576, 576, 576, 579,
    579, 745, 248, 500, 1000, 379, 353, 339,
  ],
}
const INDICE = new Map(Array.from(CARACTERES).map((c, i) => [c, i]))

function larguraDoCaractere(c: string, negrito: boolean): number {
  const cp = c.codePointAt(0) ?? 0
  if (cp === 0x200d || cp === 0xfe0f || (cp >= 0x1f3fb && cp <= 0x1f3ff)) return 0
  // Emoji e símbolos caem na fonte de emoji, com avanço de 1 em.
  if (cp >= 0x2190) return 1
  const i = INDICE.get(c)
  const tabela = AVANCOS[negrito ? 'negrito' : 'regular']
  return (i === undefined ? 560 : (tabela[i] ?? 560)) / 1000
}

export function larguraDoTexto(texto: string, tamanho: number, negrito = false): number {
  let total = 0
  let depoisDeZwj = false
  for (const c of texto) {
    total += depoisDeZwj ? 0 : larguraDoCaractere(c, negrito)
    depoisDeZwj = c.codePointAt(0) === 0x200d
  }
  return total * tamanho
}

/** Corta o texto com reticências para caber em `maximo` pixels. */
export function cortar(texto: string, tamanho: number, maximo: number, negrito = false): string {
  if (larguraDoTexto(texto, tamanho, negrito) <= maximo) return texto
  const reticencias = larguraDoTexto('…', tamanho, negrito)
  let saida = ''
  for (const c of texto) {
    if (larguraDoTexto(saida + c, tamanho, negrito) + reticencias > maximo) break
    saida += c
  }
  return `${saida.trimEnd()}…`
}

/** Quebra o texto em linhas de até `maximo` pixels, nos espaços; uma palavra maior que a linha é cortada. */
export function quebrar(texto: string, tamanho: number, maximo: number): string[] {
  const linhas: string[] = []
  let atual = ''
  for (const palavra of texto.split(' ')) {
    const tentativa = atual === '' ? palavra : `${atual} ${palavra}`
    if (atual !== '' && larguraDoTexto(tentativa, tamanho) > maximo) {
      linhas.push(atual)
      atual = palavra
    } else {
      atual = tentativa
    }
  }
  if (atual !== '') linhas.push(atual)
  return linhas.map(l => cortar(l, tamanho, maximo))
}

type Opcoes = {
  tamanho: number
  peso?: 700
  classe?: string
  cor?: string
  ancora?: 'end' | 'middle'
  opacidade?: number
}

function texto(x: number, y: number, conteudo: string, o: Opcoes): string {
  const atributos = [
    `x="${x}" y="${y}" font-size="${o.tamanho}"`,
    o.peso === undefined ? '' : `font-weight="${o.peso}"`,
    o.classe === undefined ? '' : `class="${o.classe}"`,
    o.cor === undefined ? '' : `fill="${o.cor}"`,
    o.ancora === undefined ? '' : `text-anchor="${o.ancora}"`,
    o.opacidade === undefined ? '' : `fill-opacity="${o.opacidade}"`,
  ]
  return `<text ${atributos.filter(Boolean).join(' ')}>${esc(conteudo)}</text>`
}

const dataPartes = (data: string) => {
  const [a, m, d] = data.split('-').map(Number)
  const dt = new Date(a ?? 1970, (m ?? 1) - 1, d ?? 1)
  return { dia: d ?? 1, mes: (m ?? 1) - 1, semana: dt.getDay() }
}

const diaSeguinte = (data: string) => {
  const [a, m, d] = data.split('-').map(Number)
  const dt = new Date(a ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const curta = (data: string) => {
  const p = dataPartes(data)
  return `${p.dia} ${MESES[p.mes]}`
}

/** Só o primeiro nome: o período ao lado já diz que é a semana. Sem nome, "Minha semana". */
export const tituloDaSemana = (nome: string | null | undefined): string => nome || 'Minha semana'

export function periodo(inicio: string, fim: string): string {
  const a = dataPartes(inicio)
  const b = dataPartes(fim)
  return a.mes === b.mes
    ? `${a.dia} a ${b.dia} de ${MESES_LONGOS[b.mes]}`
    : `${a.dia} de ${MESES[a.mes]} a ${b.dia} de ${MESES[b.mes]}`
}

/** "próxima semana", "há 2 semanas": qual semana é, contando da de hoje. Null na de hoje. */
export function nomeDaSemana(deslocamento: number | undefined): string | null {
  const n = deslocamento ?? 0
  if (n === 0) return null
  if (n === 1) return 'próxima semana'
  if (n === -1) return 'semana passada'
  return n > 0 ? `daqui a ${n} semanas` : `há ${-n} semanas`
}

const periodoDe = (semana: Semana) => periodo(semana.dias[0]?.data ?? semana.hoje, semana.dias.at(-1)?.data ?? semana.hoje)

/** O período, com o nome da semana na frente quando não é a de hoje: "próxima semana · 18 a 24 de outubro". */
export function periodoDaSemana(semana: Semana): string {
  const nome = nomeDaSemana(semana.deslocamento)
  return nome === null ? periodoDe(semana) : `${nome} · ${periodoDe(semana)}`
}

const hora = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Faixa de horas da trilha: cobre a semana inteira, no mínimo das 8h às 18h. */
function faixaDeHoras(dias: Dia[]): [number, number] {
  const eventos = dias.flatMap(d => d.eventos).filter(e => !e.diaInteiro)
  const inicio = Math.min(8, ...eventos.map(e => Math.floor(e.inicio / 60)))
  const fim = Math.max(18, ...eventos.map(e => Math.ceil(e.fim / 60)))
  return [inicio * 60, Math.min(24, fim) * 60]
}

/**
 * Quantas tarefas listar por dia: hoje e amanhã pedem ação, o resto só conta.
 * No de hoje, as atrasadas entram na mesma conta.
 */
const LIMITE_HOJE = 3
const LIMITE_AMANHA = 3
const LIMITE_ATRASADAS = 3
const LIMITE_UP_NEXT = 3

type Desenho = { partes: string[]; y: number; largura: number; margem: number }

const add = (d: Desenho, ...partes: string[]) => {
  d.partes.push(...partes)
}

/**
 * Faixa roxa: símbolo e título à esquerda, o período à direita e, embaixo,
 * a semana andando, um traço por dia (passados claros, hoje em amarelo).
 */
function cabecalho(d: Desenho, semana: Semana, titulo: string) {
  const L = d.largura
  const r = 14
  const altura = 58
  const base = 27
  const util = L - d.margem * 2
  const xTitulo = d.margem + 28
  const tituloCabe = cortar(titulo, 16, (util - 28) * 0.6, true)
  const xFimDoTitulo = xTitulo + larguraDoTexto(tituloCabe, 16, true)
  // O nome da semana (próxima, passada) só entra se couber inteiro: a data importa mais.
  const espaco = L - d.margem - xFimDoTitulo - 12
  const comNome = periodoDaSemana(semana)
  const direita = larguraDoTexto(comNome, 12) <= espaco ? comNome : cortar(periodoDe(semana), 12, espaco)
  add(
    d,
    `<path d="M0 ${r}a${r} ${r} 0 0 1 ${r}-${r}h${L - r * 2}a${r} ${r} 0 0 1 ${r} ${r}v${altura - r}H0z" fill="${COR.roxo}"/>`,
    `<path d="${LOGO}" fill="${COR.branco}" transform="translate(${d.margem} ${base - 17}) scale(${22 / 1220})"/>`,
    texto(xTitulo, base, tituloCabe, { tamanho: 16, peso: 700, cor: COR.branco }),
    texto(L - d.margem, base, direita, {
      tamanho: 12,
      cor: COR.branco,
      opacidade: 0.85,
      ancora: 'end',
    }),
  )
  const vao = 4
  const w = (util - vao * (semana.dias.length - 1)) / semana.dias.length
  semana.dias.forEach((dia, i) => {
    const ehHoje = dia.data === semana.hoje
    const opacidade = ehHoje ? 1 : dia.data < semana.hoje ? 0.6 : 0.22
    add(
      d,
      `<rect x="${d.margem + i * (w + vao)}" y="${altura - 14}" width="${w}" height="4" rx="2" fill="${ehHoje ? COR.amarelo : COR.branco}" fill-opacity="${opacidade}"/>`,
    )
  })
  d.y = altura + 14
}

/** Duração em texto curto: "45min", "2h", "8,5h". */
export function duracao(minutos: number): string {
  if (minutos < 60) return `${Math.round(minutos)}min`
  const horas = Math.round((minutos / 60) * 2) / 2
  return `${String(horas).replace('.', ',')}h`
}

const ehDiaUtil = (data: string) => {
  const dia = dataPartes(data).semana
  return dia >= 1 && dia <= 5
}

/**
 * Quantas tarefas passam do que cabe no resto da semana: o que falta (de hoje
 * em diante, mais as atrasadas) contra o ritmo vezes os dias úteis que restam.
 * Null sem ritmo, porque sem histórico não há como dizer o que cabe.
 */
export function alemDoRitmo(semana: Semana): { aFazer: number; cabem: number; excesso: number; diasUteis: number } | null {
  const ritmo = semana.ritmo ?? null
  if (ritmo === null) return null
  const restantes = semana.dias.filter(x => x.data >= semana.hoje)
  const aFazer = restantes.reduce((n, x) => n + x.tarefas.length, 0) + semana.atrasadas.length
  const diasUteis = restantes.filter(x => ehDiaUtil(x.data)).length
  const cabem = Math.round(ritmo * diasUteis)
  return { aFazer, cabem, excesso: Math.max(0, aFazer - cabem), diasUteis }
}

/** A semana numa conta só: o que a barra do topo divide e a legenda conta. */
export type Carga = {
  /** Feitas, atrasadas (de qualquer semana) e o que vence de hoje até sábado. */
  total: number
  feitas: number
  atrasadas: number
  /** O que vence de hoje até sábado, sem as atrasadas. */
  aFazer: number
  /** Do que vence de hoje até sábado, quanto passa do ritmo; 0 sem ritmo. */
  alem: number
  /** Quantas cabem no ritmo até o fim da semana, atrasadas incluídas; null sem ritmo. */
  cabem: number | null
  diasUteis: number
  /** Entre as pendentes, atrasadas incluídas, as com 🔴 e as com 🟢 no começo do título. */
  urgentes: number
  importantes: number
}

export function cargaDaSemana(semana: Semana): Carga {
  const feitas = semana.dias.reduce((n, x) => n + (x.concluidas ?? 0), 0)
  const aVencer = semana.dias.filter(x => x.data >= semana.hoje).flatMap(x => x.tarefas)
  const graus = [...semana.atrasadas, ...aVencer].map(t => importancia(t.titulo))
  const ritmo = alemDoRitmo(semana)
  return {
    total: feitas + semana.atrasadas.length + aVencer.length,
    feitas,
    atrasadas: semana.atrasadas.length,
    aFazer: aVencer.length,
    alem: Math.min(ritmo?.excesso ?? 0, aVencer.length),
    cabem: ritmo?.cabem ?? null,
    diasUteis: ritmo?.diasUteis ?? 0,
    urgentes: graus.filter(g => g === 0).length,
    importantes: graus.filter(g => g === 1).length,
  }
}

type Trecho = { n: number; classe: 'feita' | 'atrasada' | 'coluna' | 'excesso'; rotulo: string; dica: string }

/** O quadradinho da legenda; o do excesso leva as listras por cima do roxo. */
const amostra = (x: number, y: number, classe: string) =>
  classe === 'excesso'
    ? `<rect x="${x}" y="${y}" width="9" height="9" rx="2" class="coluna"/><rect x="${x}" y="${y}" width="9" height="9" rx="2" fill="url(#excesso)"/>`
    : `<rect x="${x}" y="${y}" width="9" height="9" rx="2" class="${classe}"/>`

/**
 * O topo: o total da semana e as horas em reunião; embaixo, uma barra que
 * divide o total em feitas, atrasadas, a fazer e o que passa do ritmo; a
 * legenda só do que pede atenção (o roxo liso, a fazer, fica sem rótulo); e
 * quantas prioritárias (🔴 e 🟢) faltam.
 */
function numeros(d: Desenho, semana: Semana) {
  const c = cargaDaSemana(semana)
  const reunioes = semana.dias.flatMap(x => x.eventos).filter(e => e.comPessoas && !e.diaInteiro)
  const minutosEmReuniao = reunioes.reduce((n, e) => n + (e.fim - e.inicio), 0)
  const xEsq = d.margem
  const xDir = d.largura - d.margem
  const util = xDir - xEsq
  const pendentes = c.atrasadas + c.aFazer
  const noRitmo = `cerca de ${c.cabem} cabem em ${plural(c.diasUteis, 'dia útil', 'dias úteis')} no seu ritmo`

  // O total à esquerda e as reuniões à direita, na mesma linha de base. Num
  // painel estreito, "tarefas na semana" encurta para "tarefas".
  const yTopo = d.y + 24
  const horas = duracao(minutosEmReuniao)
  const xHoras = xDir - larguraDoTexto('em reuniões', 12) - 4
  const xRotulo = xEsq + larguraDoTexto(String(c.total), 30, true) + 6
  const cabeRotuloLongo = xRotulo + larguraDoTexto('tarefas na semana', 13) + 24 <= xHoras - larguraDoTexto(horas, 17, true)
  add(
    d,
    `<g><title>${esc(
      `${plural(c.total, 'tarefa', 'tarefas')}: ${plural(c.feitas, 'concluída', 'concluídas')}, ` +
        `${plural(c.atrasadas, 'atrasada', 'atrasadas')} e ${c.aFazer} a fazer até sábado`,
    )}</title>`,
    texto(xEsq, yTopo, String(c.total), { tamanho: 30, peso: 700, classe: 'txt' }),
    texto(xRotulo, yTopo, cabeRotuloLongo ? 'tarefas na semana' : 'tarefas', { tamanho: 13, classe: 'sec' }),
    '</g>',
    `<g><title>${esc(`${plural(reunioes.length, 'reunião', 'reuniões')} com outras pessoas nesta semana`)}</title>`,
    texto(xHoras, yTopo, horas, { tamanho: 17, peso: 700, classe: 'txt', ancora: 'end' }),
    texto(xDir, yTopo, 'em reuniões', { tamanho: 12, classe: 'sec', ancora: 'end' }),
    '</g>',
  )

  const trechos: Trecho[] = [
    {
      n: c.feitas,
      classe: 'feita',
      rotulo: c.feitas === 1 ? 'concluída' : 'concluídas',
      dica: `${plural(c.feitas, 'tarefa concluída', 'tarefas concluídas')} nesta semana`,
    },
    {
      n: c.atrasadas,
      classe: 'atrasada',
      rotulo: c.atrasadas === 1 ? 'atrasada' : 'atrasadas',
      dica: `${plural(c.atrasadas, 'tarefa venceu', 'tarefas venceram')} antes de hoje`,
    },
    {
      n: c.aFazer - c.alem,
      classe: 'coluna',
      rotulo: 'a fazer',
      dica: `${c.aFazer - c.alem} a fazer até sábado${c.cabem === null ? '' : ' que cabem no seu ritmo'}`,
    },
    {
      n: c.alem,
      classe: 'excesso',
      rotulo: 'além do ritmo',
      dica: `${pendentes} a fazer, contando as atrasadas, e ${noRitmo}`,
    },
  ]

  // A barra: cada trecho proporcional ao total, com um mínimo para um trecho
  // pequeno não sumir (o que o mínimo acrescenta sai do maior) e um fio entre
  // eles, o mesmo das colunas do gráfico.
  const yBarra = yTopo + 14
  const h = 10
  const vao = 1
  const visiveis = trechos.filter(t => t.n > 0)
  const livre = util - vao * Math.max(0, visiveis.length - 1)
  const larguras = visiveis.map(t => Math.max(4, (t.n / c.total) * livre))
  const maior = larguras.indexOf(Math.max(...larguras))
  if (maior >= 0) larguras[maior] = (larguras[maior] ?? 0) - (larguras.reduce((a, b) => a + b, 0) - livre)

  add(d, `<clipPath id="barra"><rect x="${xEsq}" y="${yBarra}" width="${util}" height="${h}" rx="${h / 2}"/></clipPath>`)
  if (visiveis.length === 0) add(d, `<rect x="${xEsq}" y="${yBarra}" width="${util}" height="${h}" rx="${h / 2}" class="trilha"/>`)
  add(d, '<g clip-path="url(#barra)">')
  let x = xEsq
  for (const [i, t] of visiveis.entries()) {
    const w = larguras[i] ?? 0
    add(
      d,
      `<g><title>${esc(t.dica)}</title>`,
      `<rect x="${x}" y="${yBarra}" width="${w}" height="${h}" class="${t.classe === 'excesso' ? 'coluna' : t.classe}"/>`,
      t.classe === 'excesso' ? `<rect x="${x}" y="${yBarra}" width="${w}" height="${h}" fill="url(#excesso)"/>` : '',
      '</g>',
    )
    x += w + vao
  }
  add(d, '</g>')

  // A legenda, com os números em cor de texto: a cor fica só no quadradinho.
  let y = yBarra + h + 20
  let xl = xEsq
  const quebra = (largura: number) => {
    if (xl > xEsq && xl + largura > xDir) {
      xl = xEsq
      y += 18
    }
  }
  if (c.total === 0) add(d, texto(xEsq, y, 'Nenhuma tarefa nesta semana', { tamanho: 12, classe: 'sec' }))
  // As concluídas aparecem mesmo zeradas, menos numa semana que ainda nem começou.
  const comecou = semana.dias.some(x => x.data <= semana.hoje)
  const naLegenda = trechos.filter(t => t.classe !== 'coluna' && (t.n > 0 || (t.classe === 'feita' && comecou)))
  for (const t of c.total === 0 ? [] : naLegenda) {
    const larguraDoNumero = larguraDoTexto(String(t.n), 12, true)
    const largura = 14 + larguraDoNumero + 3 + larguraDoTexto(t.rotulo, 12)
    quebra(largura)
    add(
      d,
      `<g><title>${esc(t.dica)}</title>`,
      amostra(xl, y - 8.5, t.classe),
      texto(xl + 14, y, String(t.n), { tamanho: 12, peso: 700, classe: 'txt' }),
      texto(xl + 14 + larguraDoNumero + 3, y, t.rotulo, { tamanho: 12, classe: 'sec' }),
      '</g>',
    )
    xl += largura + 14
  }

  // As prioritárias: quando não cabe tudo, é das outras que se tira. Com a
  // legenda vazia (semana futura que cabe no ritmo), sobem para o lugar dela.
  const semLegenda = c.total > 0 && naLegenda.length === 0
  const prioritarias = c.urgentes + c.importantes
  if (semLegenda && prioritarias === 0) y -= 20
  if (prioritarias > 0) {
    if (!semLegenda) y += 26
    const marcas: [number, number, string][] = [
      [0, c.urgentes, c.urgentes === 1 ? 'urgente' : 'urgentes'],
      [1, c.importantes, c.importantes === 1 ? 'importante' : 'importantes'],
    ]
    const partes: string[] = []
    let xp = xEsq
    for (const [grau, n, rotulo] of marcas.filter(([, n]) => n > 0)) {
      const larguraDoNumero = larguraDoTexto(String(n), 12, true)
      partes.push(
        bolinha(xp + 4.5, y - 4.5, grau),
        texto(xp + 14, y, String(n), { tamanho: 12, peso: 700, classe: 'txt' }),
        texto(xp + 14 + larguraDoNumero + 3, y, rotulo, { tamanho: 12, classe: 'sec' }),
      )
      xp += 14 + larguraDoNumero + 3 + larguraDoTexto(rotulo, 12) + 14
    }
    add(
      d,
      `<g><title>Tarefas a fazer com 🔴 ou 🟢 no começo do título, atrasadas incluídas</title>`,
      ...partes,
      '</g>',
    )
  }
  d.y = y + 24
}

const ABREVIADOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** Listras sobre a parte da coluna que fica acima da linha do ritmo. */
function hachura(x: number, base: number, largura: number, altura: number, yRitmo: number | null): string {
  if (yRitmo === null || altura <= 0) return ''
  const topo = base - altura
  const acima = Math.min(altura, yRitmo - topo)
  if (acima <= 1) return ''
  const r = Math.min(4, acima / 2, largura / 2)
  return (
    `<path d="M${x} ${topo + acima}V${topo + r}Q${x} ${topo} ${x + r} ${topo}H${x + largura - r}` +
    `Q${x + largura} ${topo} ${x + largura} ${topo + r}V${topo + acima}Z" fill="url(#excesso)"/>`
  )
}

const DEFINICOES =
  '<defs><pattern id="excesso" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
  `<rect width="2" height="5" fill="${COR.branco}" fill-opacity="0.6"/></pattern></defs>`

/** Um trecho de coluna; só o de cima tem a ponta arredondada. */
function trecho(x: number, base: number, largura: number, altura: number, classe: string, ponta: boolean): string {
  const topo = base - altura
  if (!ponta) return `<rect x="${x}" y="${topo}" width="${largura}" height="${altura}" class="${classe}"/>`
  const r = Math.min(4, altura / 2, largura / 2)
  return (
    `<path d="M${x} ${base}V${topo + r}Q${x} ${topo} ${x + r} ${topo}H${x + largura - r}` +
    `Q${x + largura} ${topo} ${x + largura} ${topo + r}V${base}Z" class="${classe}"/>`
  )
}

/**
 * Tarefas por dia: cada coluna é o que foi concluído no dia, embaixo, em
 * verde, e o que vence nele e falta, em cima (em coral, se o dia já passou). A
 * linha é o ritmo das últimas 4 semanas: o que passa dela é de onde tirar tarefa.
 */
function grafico(d: Desenho, semana: Semana) {
  if (semana.dias.length === 0) return
  const colunasDoDia = semana.dias.map(dia => ({
    dia,
    feitas: dia.concluidas ?? 0,
    faltam: dia.tarefas.length,
    passou: dia.data < semana.hoje,
  }))
  const totais = colunasDoDia.map(c => c.feitas + c.faltam)
  const media = totais.reduce((a, b) => a + b, 0) / totais.length
  const ritmo = semana.ritmo ?? null
  const referencia = ritmo ?? media
  const maximo = Math.max(1, referencia, ...totais)
  const xEsq = d.margem
  const xDir = d.largura - d.margem

  const yTitulo = d.y + 4
  const rotuloLinha = ritmo === null ? `média de ${Math.round(media)} por dia` : `seu ritmo: ${Math.round(ritmo)} por dia útil`
  const dicaLinha =
    ritmo === null
      ? 'Média de tarefas por dia nesta semana'
      : 'Média de tarefas concluídas por dia útil nas últimas 4 semanas'
  const xRotulo = xDir - larguraDoTexto(rotuloLinha, 11.5)
  add(
    d,
    texto(xEsq, yTitulo, 'Tarefas por dia', { tamanho: 14, peso: 700, classe: 'txt' }),
    `<g><title>${esc(dicaLinha)}</title>`,
    `<line x1="${xRotulo - 18}" x2="${xRotulo - 6}" y1="${yTitulo - 4}" y2="${yTitulo - 4}" class="media" stroke-width="1.5"/>`,
    texto(xDir, yTitulo, rotuloLinha, { tamanho: 11.5, classe: 'sec', ancora: 'end' }),
    '</g>',
  )

  const alturaMaxima = 60
  const base = yTitulo + 22 + alturaMaxima
  const faixa = (xDir - xEsq) / colunasDoDia.length
  const largura = Math.min(22, faixa * 0.55)
  const escalaY = (n: number) => (n / maximo) * alturaMaxima
  const yLinha = base - escalaY(referencia)
  // Só o ritmo de verdade define o que passa da conta; a média da semana não.
  const yLinhaRitmo = ritmo === null ? null : yLinha
  // Um fio, não uma faixa: só o bastante para separar o concluído do que falta.
  const vao = 1

  // Colunas, depois as linhas e, por cima de tudo, os números com um contorno
  // da cor do fundo, para a linha nunca cortar um número.
  const topos = colunasDoDia.map(({ dia, feitas, faltam, passou }, i) => {
    const centro = xEsq + faixa * (i + 0.5)
    const x = centro - largura / 2
    const hFeitas = feitas > 0 ? Math.max(3, escalaY(feitas)) : 0
    const hFaltam = faltam > 0 ? Math.max(3, escalaY(faltam)) : 0
    const yFaltam = base - hFeitas - (hFeitas > 0 && hFaltam > 0 ? vao : 0)
    const p = dataPartes(dia.data)
    const reunioes = dia.eventos.filter(e => e.comPessoas).length
    const dica = [
      `${DIAS[p.semana]}, ${curta(dia.data)}`,
      plural(feitas, 'concluída', 'concluídas'),
      `${faltam} ${passou ? (faltam === 1 ? 'atrasada' : 'atrasadas') : 'a fazer'}`,
      plural(reunioes, 'reunião', 'reuniões'),
    ].join(' · ')
    add(
      d,
      `<g><title>${esc(dica)}</title>`,
      // Área de toque maior que a coluna, para o tooltip.
      `<rect x="${centro - faixa / 2}" y="${base - alturaMaxima - 16}" width="${faixa}" height="${alturaMaxima + 34}" fill="transparent"/>`,
      hFeitas > 0 ? trecho(x, base, largura, hFeitas, 'feita', hFaltam === 0) : '',
      hFaltam > 0 ? trecho(x, yFaltam, largura, hFaltam, passou ? 'atrasada' : 'coluna', true) : '',
      hachura(x, yFaltam, largura, hFaltam, passou ? null : yLinhaRitmo),
      '</g>',
    )
    return { centro, topo: hFaltam > 0 ? yFaltam - hFaltam : base - hFeitas, dia, feitas, faltam }
  })
  add(
    d,
    `<line x1="${xEsq}" x2="${xDir}" y1="${base}" y2="${base}" class="linha" stroke-width="1"/>`,
    `<line x1="${xEsq}" x2="${xDir}" y1="${yLinha}" y2="${yLinha}" class="media" stroke-width="1"/>`,
  )
  const maisCarregado = Math.max(...totais)
  for (const { centro, topo, dia, feitas, faltam } of topos) {
    const ehHoje = dia.data === semana.hoje
    const p = dataPartes(dia.data)
    // Em cima, o total do dia: concluídas e a fazer. A divisão está nas cores.
    const total = feitas + faltam
    add(
      d,
      texto(centro, topo - 5, String(total), {
        tamanho: 11.5,
        ...(total === maisCarregado && total > 0 ? { peso: 700 } : {}),
        classe: total === 0 ? 'sec halo' : 'txt halo',
        ancora: 'middle',
      }),
      texto(centro, base + 15, ehHoje ? 'hoje' : (ABREVIADOS[p.semana] ?? ''), {
        tamanho: 11,
        ...(ehHoje ? { peso: 700, classe: 'hoje' } : { classe: 'sec' }),
        ancora: 'middle',
      }),
    )
  }

  // Sem legenda aqui: as cores são as da barra do topo, que já tem a sua, e
  // cada coluna diz o que é na dica.
  d.y = base + 34
}

type Linha = {
  y: number
  xEsq: number
  xDir: number
  tipo: 'reuniao' | 'tarefa' | 'atrasada'
  titulo: string
  dica: string
  hora?: string
  direita?: string
  /** Já passou: desenhada esmaecida. */
  passado?: boolean
}

/** A bolinha cheia de uma prioridade: coral para 🔴 (urgente), verde para 🟢 (importante). */
const bolinha = (cx: number, cy: number, grau: number) =>
  `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${grau === 0 ? COR.coral : COR.verde}"/>`

/**
 * Uma linha de lista: marcador, hora opcional, título cortado e um rótulo à
 * direita. Numa tarefa com 🔴 ou 🟢 no título, o emoji sai e o marcador vira
 * a bolinha cheia da prioridade.
 */
function linha(d: Desenho, l: Linha) {
  const xHora = l.xEsq + 16
  const xTitulo = l.hora === undefined ? xHora : xHora + 44
  const fim = l.xDir - (l.direita === undefined ? 0 : larguraDoTexto(l.direita, 11.5) + 10)
  const cy = l.y - 4.5
  const classe = l.passado === true ? 'sec' : 'txt'
  const grau = l.tipo === 'reuniao' ? 3 : importancia(l.titulo)
  const titulo = grau <= 1 ? semMarcaDePrioridade(l.titulo) : l.titulo
  const marcador =
    l.tipo === 'reuniao'
      ? `<circle cx="${l.xEsq + 4.5}" cy="${cy}" r="4" class="reuniao"${l.passado === true ? ' fill-opacity="0.4"' : ''}/>`
      : grau <= 1
        ? bolinha(l.xEsq + 4.5, cy, grau)
        : l.tipo === 'tarefa'
          ? `<circle cx="${l.xEsq + 4.5}" cy="${cy}" r="4.25" class="tarefa" stroke-width="1.5"/>`
          : `<circle cx="${l.xEsq + 4.5}" cy="${cy}" r="4.25" fill="none" stroke="${COR.coral}" stroke-width="1.5"/>`
  add(
    d,
    `<g><title>${esc(l.dica)}</title>`,
    marcador,
    l.hora === undefined ? '' : texto(xHora, l.y, l.hora, { tamanho: 12.5, peso: 700, classe }),
    texto(xTitulo, l.y, cortar(titulo, 13, fim - xTitulo), { tamanho: 13, classe }),
    l.direita === undefined ? '' : texto(l.xDir, l.y, l.direita, { tamanho: 11.5, classe: 'sec', ancora: 'end' }),
    '</g>',
  )
}

const dicaDaTarefa = (t: Tarefa | Prioridade) => (t.projeto ? `${t.titulo} · ${t.projeto}` : t.titulo)

/** Na semana mostrada, o dia abreviado ("qui"); fora dela, a data ("8 out"). */
function quando(semana: Semana, data: string): string {
  const domingo = semana.dias[0]?.data ?? semana.hoje
  const sabado = semana.dias.at(-1)?.data ?? semana.hoje
  return data >= domingo && data <= sabado ? (ABREVIADOS[dataPartes(data).semana] ?? curta(data)) : curta(data)
}

/**
 * As tarefas que a lista de um dia mostra: as atrasadas e as do dia disputam
 * as mesmas vagas, e entram as mais prioritárias. Diz também quantas de cada
 * ficaram de fora.
 */
function escolherTarefas(atrasadas: Tarefa[], tarefas: Tarefa[], limite: number) {
  const escolhidas = porPrioridade([...atrasadas, ...tarefas]).slice(0, limite)
  const naLista = new Set(escolhidas.map(t => t.id))
  return {
    escolhidas,
    tarefasDeFora: tarefas.filter(t => !naLista.has(t.id)).length,
    atrasadasDeFora: atrasadas.filter(t => !naLista.has(t.id)).length,
  }
}

/** "+ 10 tarefas e 3 atrasadas": o que ficou de fora da lista; vazio se nada ficou. */
function oQueSobra(tarefas: number, atrasadas: number, passou = false): string {
  const partes = [
    tarefas > 0 ? (passou ? plural(tarefas, 'atrasada', 'atrasadas') : plural(tarefas, 'tarefa', 'tarefas')) : '',
    atrasadas > 0 ? plural(atrasadas, 'atrasada', 'atrasadas') : '',
  ].filter(Boolean)
  return partes.length > 0 ? `+ ${partes.join(' e ')}` : ''
}

function trilha(d: Desenho, dia: Dia, y: number, xEsq: number, xDir: number, faixa: [number, number], agora: number | null, emCard: boolean) {
  const largura = xDir - xEsq
  const [ini, fim] = faixa
  const px = (min: number) => xEsq + ((Math.min(Math.max(min, ini), fim) - ini) / (fim - ini)) * largura
  const h = 8
  add(d, `<rect x="${xEsq}" y="${y}" width="${largura}" height="${h}" rx="4" class="trilha${emCard ? ' em-card' : ''}"/>`)
  for (const e of dia.eventos.filter(ev => !ev.diaInteiro)) {
    const a = px(e.inicio)
    const w = Math.max(3, px(e.fim) - a - 1.5)
    add(
      d,
      `<g><title>${esc(`${hora(e.inicio)} a ${hora(e.fim)} · ${e.titulo}`)}</title>`,
      `<rect x="${a}" y="${y}" width="${w}" height="${h}" rx="2" class="${e.comPessoas ? 'reuniao' : 'bloco'}"/></g>`,
    )
  }
  if (agora !== null && agora >= ini && agora <= fim) {
    const x = px(agora)
    add(
      d,
      `<line x1="${x}" x2="${x}" y1="${y - 3}" y2="${y + h + 3}" class="agora" stroke-width="1.5" stroke-linecap="round"/>`,
      `<circle cx="${x}" cy="${y - 5}" r="3.5" fill="${COR.amarelo}" class="agora" stroke-width="1.2"/>`,
    )
  }
  return px
}

function escala(d: Desenho, y: number, faixa: [number, number], px: (m: number) => number) {
  const [ini, fim] = faixa
  for (let h = Math.ceil(ini / 60 / 6) * 6; h * 60 < fim; h += 6) {
    if (h * 60 > ini) add(d, texto(px(h * 60), y, `${h}h`, { tamanho: 10, classe: 'sec', ancora: 'middle' }))
  }
}

/**
 * As partes de "2 reuniões · 25 tarefas · 3 concluídas · 2 atrasadas": o total
 * do dia, com as concluídas incluídas. Quantas foram concluídas, só no de hoje:
 * nos outros dias a linha fica curta, e o gráfico já mostra.
 */
function resumoDoDia(dia: Dia, atrasadas = 0, comConcluidas = false): string[] {
  const reunioes = dia.eventos.filter(e => e.comPessoas || e.diaInteiro).length
  const feitas = dia.concluidas ?? 0
  const total = dia.tarefas.length + feitas
  const partes = [
    reunioes > 0 ? plural(reunioes, 'reunião', 'reuniões') : '',
    total > 0 ? plural(total, 'tarefa', 'tarefas') : '',
    comConcluidas && feitas > 0 ? plural(feitas, 'concluída', 'concluídas') : '',
    atrasadas > 0 ? plural(atrasadas, 'atrasada', 'atrasadas') : '',
  ].filter(Boolean)
  return partes.length > 0 ? partes : ['livre']
}

/** "25 min", "2h", "3h40": quanto falta, em texto curto. */
function faltaPara(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/**
 * As linhas do topo do card de hoje: o que está acontecendo agora (um bloco
 * ou uma reunião) e, se houver, a próxima reunião com outras pessoas.
 */
function agoraEProxima(d: Desenho, semana: Semana, dia: Dia, xEsq: number, xDir: number, y: number): number {
  const agora = semana.agora
  const eventos = dia.eventos.filter(e => !e.diaInteiro)
  const atual = [...eventos].reverse().find(e => e.inicio <= agora && agora < e.fim)
  const seguinte = eventos.find(e => e.inicio > agora)
  const proxima = eventos.find(e => e.comPessoas && e.inicio > agora)

  const linhas: { rotulo: string; cheia: boolean; titulo: string; direita: string; destaque: boolean }[] = [
    atual
      ? { rotulo: 'AGORA', cheia: true, titulo: atual.titulo, direita: `até ${hora(atual.fim)}`, destaque: true }
      : {
          rotulo: 'AGORA',
          cheia: true,
          titulo: 'Livre',
          direita: seguinte ? `até ${hora(seguinte.inicio)}` : 'até o fim do dia',
          destaque: true,
        },
    ...(proxima
      ? [
          {
            rotulo: 'PRÓXIMA',
            cheia: false,
            titulo: `${hora(proxima.inicio)} ${proxima.titulo}`,
            direita: `em ${faltaPara(proxima.inicio - agora)}`,
            destaque: false,
          },
        ]
      : []),
  ]

  const larguraPilula = Math.max(...linhas.map(l => larguraDoTexto(l.rotulo, 9.5, true))) + 14
  for (const l of linhas) {
    y += 24
    const xTitulo = xEsq + larguraPilula + 8
    const fim = xDir - (l.direita ? larguraDoTexto(l.direita, 11.5) + 8 : 0)
    add(
      d,
      l.cheia
        ? `<rect x="${xEsq}" y="${y - 12.5}" width="${larguraPilula}" height="17" rx="8.5" class="pilula"/>`
        : `<rect x="${xEsq + 0.5}" y="${y - 12}" width="${larguraPilula - 1}" height="16" rx="8" class="pilula-vazada" stroke-width="1"/>`,
      texto(xEsq + larguraPilula / 2, y - 0.5, l.rotulo, {
        tamanho: 9.5,
        peso: 700,
        ...(l.cheia ? { cor: COR.branco } : { classe: 'sec' }),
        ancora: 'middle',
      }),
      texto(xTitulo, y, cortar(l.titulo, 13, fim - xTitulo, l.destaque), {
        tamanho: 13,
        ...(l.destaque ? { peso: 700 } : {}),
        classe: 'txt',
      }),
      l.direita ? texto(xDir, y, l.direita, { tamanho: 11.5, classe: 'sec', ancora: 'end' }) : '',
    )
  }
  return y
}

type OpcoesDaLista = {
  /** Quantas tarefas do dia listar; 0 lista só as reuniões. */
  limite: number
  /** Só no de hoje: as atrasadas e o Up next. */
  atrasadas?: Tarefa[]
  upNext?: Prioridade[]
}

/**
 * As linhas de um dia. No de hoje, primeiro o Up next, com qualquer data e uma
 * linha fina separando do resto; depois as reuniões e as tarefas mais
 * prioritárias entre as atrasadas, com o dia em que venceram, e as do dia. Uma
 * tarefa do Up next não se repete nas outras listas. Devolve onde a última
 * linha terminou.
 */
function listaDoDia(d: Desenho, semana: Semana, dia: Dia, xEsq: number, xDir: number, y: number, o: OpcoesDaLista): number {
  const ehHoje = dia.data === semana.hoje
  // Só aparece numa semana passada: o que vencia nele e ficou é atrasada.
  const passou = dia.data < semana.hoje
  const idsDoUpNext = new Set((semana.upNext ?? []).map(t => t.id))
  const reunioes = dia.eventos.filter(ev => ev.comPessoas || ev.diaInteiro)
  const atrasadas = (o.atrasadas ?? []).filter(t => !idsDoUpNext.has(t.id))
  const tarefas = dia.tarefas.filter(t => !idsDoUpNext.has(t.id))
  const { escolhidas, tarefasDeFora, atrasadasDeFora } = escolherTarefas(atrasadas, tarefas, o.limite)

  const upNext = o.upNext ?? []
  if (upNext.length > 0) {
    y += 18
    add(d, texto(xEsq, y, 'Up next', { tamanho: 11, peso: 700, classe: 'hoje' }))
    for (const t of upNext.slice(0, LIMITE_UP_NEXT)) {
      y += 20
      const atrasada = t.vence !== null && t.vence < semana.hoje
      const direita =
        t.vence === null ? null : atrasada ? `venceu ${quando(semana, t.vence)}` : t.vence === semana.hoje ? 'hoje' : quando(semana, t.vence)
      linha(d, {
        y, xEsq, xDir, tipo: atrasada ? 'atrasada' : 'tarefa', titulo: t.titulo, dica: dicaDaTarefa(t),
        ...(direita === null ? {} : { direita }),
      })
    }
    if (upNext.length > LIMITE_UP_NEXT) {
      y += 19
      add(d, texto(xEsq + 16, y, `+ ${upNext.length - LIMITE_UP_NEXT} no Up next`, { tamanho: 12, classe: 'sec' }))
    }
    if (reunioes.length + escolhidas.length > 0) {
      y += 12
      add(d, `<line x1="${xEsq}" x2="${xDir}" y1="${y}" y2="${y}" class="linha" stroke-width="1"/>`)
    }
  }

  for (const e of reunioes) {
    y += 20
    const periodoDaReuniao = e.diaInteiro ? 'Dia todo' : `${hora(e.inicio)} a ${hora(e.fim)}`
    linha(d, {
      y, xEsq, xDir, tipo: 'reuniao',
      hora: e.diaInteiro ? 'dia' : hora(e.inicio),
      titulo: e.titulo,
      dica: `${periodoDaReuniao} · ${e.titulo}`,
      passado: passou || (ehHoje && !e.diaInteiro && e.fim <= semana.agora),
    })
  }
  for (const t of escolhidas) {
    y += 20
    const venceuAntes = t.vence < dia.data
    linha(d, {
      y, xEsq, xDir, tipo: passou || venceuAntes ? 'atrasada' : 'tarefa', titulo: t.titulo, dica: dicaDaTarefa(t),
      ...(venceuAntes ? { direita: `venceu ${quando(semana, t.vence)}` } : {}),
    })
  }
  // Num dia que só lista as reuniões, as tarefas já estão no resumo do título.
  const sobra = oQueSobra(o.limite > 0 ? tarefasDeFora : 0, atrasadasDeFora, passou)
  if (sobra !== '') {
    y += 19
    add(d, texto(xEsq + 16, y, sobra, { tamanho: 12, classe: 'sec' }))
  }
  return y
}

/**
 * O título do dia à esquerda e o resumo à direita. Se o resumo não couber,
 * saem partes inteiras do fim (a última é a menos importante) antes de cortar.
 */
function tituloDoDia(d: Desenho, y: number, xEsq: number, xDir: number, rotulo: string, detalhe: string, partes: string[], tamanho: number, classe: string) {
  const xDetalhe = xEsq + larguraDoTexto(rotulo, tamanho, true) + 7
  const fimDoDetalhe = xDetalhe + larguraDoTexto(detalhe, 12.5)
  const espaco = xDir - fimDoDetalhe - 12
  let n = partes.length
  while (n > 1 && larguraDoTexto(partes.slice(0, n).join(' · '), 11.5) > espaco) n--
  const resumo = partes.slice(0, n).join(' · ')
  add(
    d,
    texto(xEsq, y, rotulo, { tamanho, peso: 700, classe }),
    texto(xDetalhe, y, detalhe, { tamanho: 12.5, classe: 'sec' }),
    texto(xDir, y, cortar(resumo, 11.5, espaco), { tamanho: 11.5, classe: 'sec', ancora: 'end' }),
  )
}

/** O card de hoje, no topo: agora e próxima, a barra do dia e o que fazer, do Up next às tarefas do dia. */
function cardDeHoje(d: Desenho, semana: Semana, dia: Dia, faixa: [number, number]) {
  const topo = d.y
  const recuo = 14
  const xEsq = d.margem + recuo
  const xDir = d.largura - d.margem - recuo
  const antes = d.partes.length
  const p = dataPartes(dia.data)

  let y = topo + 26
  tituloDoDia(d, y, xEsq, xDir, 'Hoje', `${DIAS[p.semana]}, ${curta(dia.data)}`, resumoDoDia(dia, semana.atrasadas.length, true), 15, 'hoje')
  y = agoraEProxima(d, semana, dia, xEsq, xDir, y + 2)

  // A barra do dia, com a escala embaixo. Sem legenda: reunião é o roxo
  // cheio, como na lista, e cada bloco diz o que é na dica.
  y += 16
  const px = trilha(d, dia, y, xEsq, xDir, faixa, semana.agora, true)
  y += 8 + 12
  escala(d, y, faixa, px)

  y = listaDoDia(d, semana, dia, xEsq, xDir, y + 4, { limite: LIMITE_HOJE, atrasadas: semana.atrasadas, upNext: semana.upNext ?? [] })

  const altura = y - topo + 18
  d.partes.splice(
    antes,
    0,
    `<rect x="${d.margem}" y="${topo}" width="${d.largura - d.margem * 2}" height="${altura}" rx="12" class="card"/>`,
    `<rect x="${d.margem}" y="${topo + 14}" width="3" height="${altura - 28}" rx="1.5" fill="${COR.amarelo}"/>`,
  )
  d.y = topo + altura + 22
}

/**
 * Um dia fora do card de hoje: nome, resumo e as reuniões. Na semana de hoje,
 * só amanhã lista as primeiras tarefas; em outra semana, todo dia lista: as
 * primeiras a fazer ou, se o dia já passou, as atrasadas.
 */
function blocoDoDia(d: Desenho, semana: Semana, dia: Dia) {
  const ehAmanha = dia.data === diaSeguinte(semana.hoje)
  const passou = dia.data < semana.hoje
  const outraSemana = (semana.deslocamento ?? 0) !== 0
  const nome = DIAS[dataPartes(dia.data).semana] ?? ''
  const [rotulo, detalhe] = ehAmanha
    ? ['Amanhã', `${nome}, ${curta(dia.data)}`]
    : [nome.charAt(0).toUpperCase() + nome.slice(1), curta(dia.data)]
  const xEsq = d.margem
  const xDir = d.largura - d.margem
  let y = d.y + 26
  tituloDoDia(d, y, xEsq, xDir, rotulo, detalhe, resumoDoDia(dia, passou ? dia.tarefas.length : 0), 14, 'txt')
  const limite = passou ? LIMITE_ATRASADAS : ehAmanha || outraSemana ? LIMITE_AMANHA : 0
  y = listaDoDia(d, semana, dia, xEsq, xDir, y + 4, { limite })
  d.y = y + 22
}

function divisoria(d: Desenho) {
  add(d, `<line x1="${d.margem}" x2="${d.largura - d.margem}" y1="${d.y}" y2="${d.y}" class="linha" stroke-width="1"/>`)
}

function rodape(d: Desenho, semana: Semana) {
  d.y += 14
  // O aviso inteiro, em quantas linhas precisar: é ele que diz o que fazer.
  for (const aviso of semana.avisos) {
    for (const trecho of quebrar(aviso, 11.5, d.largura - d.margem * 2)) {
      add(d, texto(d.margem, d.y + 4, trecho, { tamanho: 11.5, cor: COR.coral }))
      d.y += 16
    }
    d.y += 2
  }
  add(d, texto(d.largura - d.margem, d.y + 6, `atualizado às ${semana.atualizadoEm}`, { tamanho: 11, classe: 'sec', ancora: 'end' }))
  d.y += 24
}

type OpcoesDoPainel = { largura?: number; titulo?: string }

/**
 * O SVG do painel e suas medidas, para a largura pedida em pixels. A ordem
 * segue o uso: primeiro o que fazer hoje, depois o planejamento da semana. Em
 * outra semana não há o card de hoje, e todos os dias ganham seu bloco.
 */
export function desenharSemana(semana: Semana, opcoes: OpcoesDoPainel = {}): { svg: string; altura: number; largura: number } {
  const largura = Math.round(Math.min(560, Math.max(300, opcoes.largura ?? 400)))
  const d: Desenho = { partes: [], y: 0, largura, margem: 16 }
  const faixa = faixaDeHoras(semana.dias)
  const hoje = semana.dias.find(x => x.data === semana.hoje)

  cabecalho(d, semana, opcoes.titulo ?? 'Minha semana')
  numeros(d, semana)
  if (hoje !== undefined) cardDeHoje(d, semana, hoje, faixa)
  d.y += 10
  grafico(d, semana)
  d.y += 4
  for (const dia of hoje === undefined ? semana.dias : semana.dias.filter(x => x.data > semana.hoje)) {
    divisoria(d)
    blocoDoDia(d, semana, dia)
  }
  rodape(d, semana)

  const altura = Math.ceil(d.y)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">` +
    `<style>${ESTILO}</style>` +
    DEFINICOES +
    `<rect width="${largura}" height="${altura}" rx="14" class="fundo"/>` +
    d.partes.join('') +
    '</svg>'
  return { svg, altura, largura }
}

/** O dia de hoje em linhas de texto, para o terminal, que não desenha SVG. */
export function hojeEmLinhas(semana: Semana): string[] {
  const hoje = semana.dias.find(x => x.data === semana.hoje)
  if (hoje === undefined) return []
  const upNext = semana.upNext ?? []
  const idsDoUpNext = new Set(upNext.map(t => t.id))
  const atrasadas = semana.atrasadas.filter(t => !idsDoUpNext.has(t.id))
  const tarefas = hoje.tarefas.filter(t => !idsDoUpNext.has(t.id))
  const { escolhidas, tarefasDeFora, atrasadasDeFora } = escolherTarefas(atrasadas, tarefas, LIMITE_HOJE)
  const sobra = oQueSobra(tarefasDeFora, atrasadasDeFora)
  return [
    ...upNext.slice(0, LIMITE_UP_NEXT).map(t => `Up next · ${t.titulo}`),
    ...hoje.eventos.filter(e => e.comPessoas || e.diaInteiro).map(e => `● ${e.diaInteiro ? 'dia todo' : hora(e.inicio)}  ${e.titulo}`),
    ...escolhidas.map(t => `○ ${t.titulo}${t.vence < hoje.data ? ` · venceu ${quando(semana, t.vence)}` : ''}`),
    ...(sobra === '' ? [] : [`  ${sobra}`]),
  ]
}

/** Cada dia numa linha, para o terminal numa semana que não é a de hoje. */
export function diasEmLinhas(semana: Semana): string[] {
  return semana.dias.map(dia => {
    const passou = dia.data < semana.hoje
    const partes = resumoDoDia(dia, passou ? dia.tarefas.length : 0)
    return `${ABREVIADOS[dataPartes(dia.data).semana] ?? ''} ${curta(dia.data)}  ${partes.join(' · ')}`
  })
}

/** "a, b e c". */
const juntar = (itens: string[]) => (itens.length <= 1 ? (itens[0] ?? '') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`)

/**
 * O resumo em texto: a resposta do /semana, o `alt` do SVG e o que o terminal
 * mostra. Hoje primeiro, depois a semana, com as mesmas palavras do painel:
 * "Hoje: 16 tarefas, 2 atrasadas e nenhuma reunião. Semana de 11 a 17 de
 * outubro: 75 tarefas, 3 concluídas e 36 além do ritmo." Em outra semana, só
 * ela: "Próxima semana, de 18 a 24 de outubro: 30 tarefas, 12 além do ritmo e
 * 4 reuniões."
 */
export function resumoEmTexto(semana: Semana): string {
  const nome = nomeDaSemana(semana.deslocamento)
  if (nome !== null) return resumoDeOutraSemana(semana, nome)

  const hoje = semana.dias.find(x => x.data === semana.hoje)
  const reunioesHoje = hoje?.eventos.filter(e => e.comPessoas).length ?? 0
  const concluidasHoje = hoje?.concluidas ?? 0
  const tarefasHoje = (hoje?.tarefas.length ?? 0) + concluidasHoje
  const c = cargaDaSemana(semana)
  const deHoje = [
    (tarefasHoje === 0 ? 'nenhuma tarefa' : plural(tarefasHoje, 'tarefa', 'tarefas')) +
      (concluidasHoje > 0 ? ` (${plural(concluidasHoje, 'concluída', 'concluídas')})` : ''),
    ...(c.atrasadas > 0 ? [plural(c.atrasadas, 'atrasada', 'atrasadas')] : []),
    reunioesHoje === 0 ? 'nenhuma reunião' : plural(reunioesHoje, 'reunião', 'reuniões'),
  ]
  const daSemana =
    c.total === 0
      ? ['nenhuma tarefa']
      : [
          plural(c.total, 'tarefa', 'tarefas'),
          plural(c.feitas, 'concluída', 'concluídas'),
          ...(c.alem > 0 ? [`${c.alem} além do ritmo`] : []),
        ]
  return `Hoje: ${juntar(deHoje)}. Semana de ${periodoDe(semana)}: ${juntar(daSemana)}.`
}

/** Numa semana passada, o que foi concluído e o que ficou; numa futura, o que passa do ritmo. */
function resumoDeOutraSemana(semana: Semana, nome: string): string {
  const c = cargaDaSemana(semana)
  const passada = (semana.deslocamento ?? 0) < 0
  const reunioes = semana.dias.flatMap(x => x.eventos).filter(e => e.comPessoas).length
  const partes = [
    c.total === 0 ? 'nenhuma tarefa' : plural(c.total, 'tarefa', 'tarefas'),
    ...(passada && c.total > 0 ? [plural(c.feitas, 'concluída', 'concluídas')] : []),
    ...(c.atrasadas > 0 ? [plural(c.atrasadas, 'atrasada', 'atrasadas')] : []),
    ...(c.alem > 0 ? [`${c.alem} além do ritmo`] : []),
    reunioes === 0 ? 'nenhuma reunião' : plural(reunioes, 'reunião', 'reuniões'),
  ]
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}, de ${periodoDe(semana)}: ${juntar(partes)}.`
}
