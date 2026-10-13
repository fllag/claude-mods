export type Evento = {
  titulo: string
  /** Minutos desde a meia-noite, no fuso da agenda. */
  inicio: number
  fim: number
  diaInteiro: boolean
  /** Tem outra pessoa convidada: é reunião, não bloco de agenda. */
  comPessoas: boolean
}

export type Tarefa = {
  id: number
  titulo: string
  projeto: string
  /** AAAA-MM-DD */
  vence: string
}

/** Uma tarefa do Up next do Basecamp, que pode não ter data. */
export type Prioridade = Omit<Tarefa, 'vence'> & { vence: string | null }

/** Quando cada tarefa foi concluída, lido da linha do tempo e guardado entre leituras. */
export type Conclusoes = {
  /** Dia da conclusão (AAAA-MM-DD, no fuso local) por id de tarefa. */
  dias: Record<string, string>
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
}

declare module 'claude-code' {
  interface PluginState {
    /** `deslocamento`: a semana que o painel mostra, a que a atualização relê. */
    semana: { semana: Semana | null; carregando: boolean; deslocamento: number }
  }
}
