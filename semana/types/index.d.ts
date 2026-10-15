export type Evento = {
  titulo: string
  /** Minutos desde a meia-noite, no fuso da agenda. */
  inicio: number
  fim: number
  diaInteiro: boolean
  /** Tem outra pessoa convidada: é reunião, não bloco de agenda. */
  comPessoas: boolean
}

/** Quem criou uma tarefa no Basecamp. */
export type Criador = { id: number; nome: string }

export type Tarefa = {
  id: number
  titulo: string
  projeto: string
  /** AAAA-MM-DD */
  vence: string
  /** Quem criou, lido item a item; ausente enquanto não se sabe. */
  criador?: Criador
}

/** Uma tarefa do Up next do Basecamp, que pode não ter data. */
export type Prioridade = Omit<Tarefa, 'vence'> & { vence: string | null }

/** Um comentário meu no Basecamp, lido da linha do tempo. */
export type Comentario = {
  /** AAAA-MM-DD, no fuso local. */
  dia: string
  /** O id do item comentado (tarefa, card, mensagem): a conversa. */
  conversa: number
  /** O espaço do Basecamp onde ele está. */
  espaco: string
}

/** De quem é uma conversa: quem criou o item e quem está como responsável. */
export type Dono = { criador: number; responsaveis: number[] }

/** As conversas em que comentei numa semana, pelo dono do item comentado. */
export type Colaboracao = {
  /** Em tarefas minhas, ou em itens que criei sem passar para ninguém. */
  suas: number
  /** Em tarefas que criei e passei para outra pessoa. */
  pediu: number
  /** Em tarefas e mensagens de outras pessoas. */
  outros: number
  /** Conversas que não deu para abrir, fora das três contas. */
  semDono: number
  /** Quantos comentários, somando todas as conversas. */
  comentarios: number
  /** Em quantos espaços estão as conversas de outras pessoas. */
  espacosDeOutros: number
}

/** O que a linha do tempo diz, guardado entre leituras: quando cada tarefa foi concluída e o que comentei. */
export type Conclusoes = {
  /** Dia da conclusão (AAAA-MM-DD, no fuso local) por id de tarefa. */
  dias: Record<string, string>
  /** Meus comentários, por id; ausente numa leitura salva por versão anterior. */
  comentarios?: Record<string, Comentario>
  /** A partir de que dia (AAAA-MM-DD) o mapa está completo. */
  cobertura: string
  /** O evento mais novo já lido, em ISO. */
  lidoAte: string
}

export type Dia = {
  /** AAAA-MM-DD */
  data: string
  eventos: Evento[]
  /** Tarefas pendentes que vencem no dia. */
  tarefas: Tarefa[]
  /**
   * Quantas tarefas foram concluídas no dia, pela data de conclusão (sem a
   * linha do tempo do Basecamp, pela de vencimento).
   */
  concluidas: number
  /** As concluídas no dia; ausente numa leitura salva por versão anterior. */
  feitas?: Tarefa[]
}

export type Semana = {
  /** AAAA-MM-DD */
  hoje: string
  /**
   * Quantas semanas depois da de hoje: 0 é a semana de hoje, 1 a próxima, -1 a
   * passada. Ausente numa leitura salva por versão anterior, que era sempre a de hoje.
   */
  deslocamento?: number
  /** Minutos desde a meia-noite na hora da leitura. */
  agora: number
  dias: Dia[]
  /** Na semana de hoje, tudo o que venceu antes de hoje; numa passada, só as dela; numa futura, nenhuma. */
  atrasadas: Tarefa[]
  /**
   * O Up next, com qualquer data, só na semana de hoje (é do bloco Hoje);
   * ausente numa leitura salva por versão anterior.
   */
  upNext?: Prioridade[]
  /**
   * Média de tarefas concluídas por dia útil (segunda a sexta) nas últimas 4
   * semanas, pela data de conclusão, sem as semanas em que nada foi concluído;
   * null sem histórico.
   */
  ritmo: number | null
  /** HH:MM da leitura. */
  atualizadoEm: string
  /** Fontes que falharam, em texto para quem lê. */
  avisos: string[]
  /** Conta do Basecamp, para o link de "minhas tarefas". */
  contaBasecamp: string | null
  /** Primeiro nome no Basecamp, para o título; ausente numa leitura salva por versão anterior. */
  nome?: string | null
  /** Meu id de pessoa no Basecamp, para "Você" em quem pediu. */
  eu?: number | null
  /**
   * As conversas em que comentei na semana mostrada. Ausente numa semana
   * futura, numa que a linha do tempo não cobre inteira, sem a linha do tempo
   * ou numa leitura salva por versão anterior.
   */
  colaboracao?: Colaboracao
}

declare module 'claude-code' {
  interface PluginState {
    /** `deslocamento`: a semana que o painel mostra, a que a atualização relê. */
    semana: { semana: Semana | null; carregando: boolean; deslocamento: number }
  }
}
