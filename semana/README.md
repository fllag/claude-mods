# Semana

Um painel com a sua semana, de domingo a sábado: as reuniões do Google Calendar e as tarefas do Basecamp num lugar só, na identidade da Hospedin. Abra com `/semana`.

É um mod em teste. Leia o [README do catálogo](../README.md) para saber o que isso muda e o que fazer se ele quebrar.

## O que aparece

- **Topo:** o total de tarefas da semana, as horas em reunião e uma barra que divide o total em concluídas, atrasadas, a fazer e o que passa do seu ritmo.
- **Hoje:** o que está acontecendo agora, a próxima reunião, o Up next, as reuniões do dia e quantas tarefas são urgentes e importantes, contando as atrasadas. As tarefas não são listadas: o card diz quantas são, e a lista fica no Basecamp.
- **Próximos dias:** as reuniões de cada dia e quantas tarefas vencem. Amanhã diz também quantas são urgentes e importantes.

Depois dos dias vem a análise da semana:

- **Tarefas por dia:** um gráfico da semana com a linha do seu ritmo. O que passa dela aparece listrado: é de onde tirar tarefa.
- **Quem pediu:** quantas tarefas da semana cada pessoa criou no Basecamp, com as suas como "Você". As cinco maiores aparecem; o resto vira uma linha só.
- **Espaços:** em que espaço do Basecamp estão as tarefas da semana, do mesmo jeito.

  Os dois gráficos contam as mesmas tarefas do total do topo, e cada barra tem as mesmas cores: concluídas, atrasadas e a fazer.

- **Colaboração:** em quantas conversas do Basecamp você comentou, uma barra por semana: a mostrada no alto e as anteriores embaixo, até 4. Cada conversa é a tarefa, o card ou a mensagem em que você comentou, contada uma vez por semana, por mais comentários que tenha. A barra divide as conversas pelo dono do item:
  - **suas:** você é responsável, ou criou o item sem passar para ninguém (uma mensagem, um documento);
  - **que você pediu:** você criou e passou para outra pessoa, ou seja, acompanhamento;
  - **de outras pessoas:** o item é de outra pessoa, e você entrou para ajudar ou responder.

  Ao lado do título fica quantas conversas da semana estão fora das suas tarefas. É o trabalho que não aparece no total do topo, mas toma tempo. Serve de contexto, não de meta: comentar mais ou menos não é o objetivo.

O **ritmo** é a média de tarefas que você concluiu por dia útil nas últimas 4 semanas. Semana sem nenhuma concluída (férias, por exemplo) fica de fora. Na primeira vez o painel lê seu histórico do Basecamp, abre cada tarefa da semana para saber quem a criou e cada conversa em que você comentou para saber de quem ela é, o que pode levar quase um minuto. Depois só busca o que é novo. Quem atualiza de uma versão sem a colaboração passa por essa primeira leitura mais uma vez.

**Prioridade:** comece o título da tarefa no Basecamp com 🔴 para urgente ou 🟢 para importante. Ela entra na conta de urgentes e importantes do topo, de Hoje e de Amanhã, sobe nas listas e ganha uma bolinha colorida no painel. Não usa ícone? Tudo funciona igual, só sem essa conta.

O título é o seu primeiro nome no Basecamp, ao lado do período da semana. Sem o Basecamp, fica "Minha semana".

No app desktop o painel é desenhado e acompanha o tema claro ou escuro. No terminal ele vira texto, com o resumo de hoje.

## Antes de instalar

1. **Google Calendar conectado no claude.ai**, em Configurações, Conectores.
2. **CLI do Basecamp autenticada** com a sua conta:

   ```bash
   claude plugin marketplace add basecamp/claude-plugins
   claude plugin install basecamp@37signals -y
   basecamp auth login
   ```

## Instalar

Se ainda não adicionou o catálogo de mods:

```bash
claude plugin marketplace add fllag/claude-mods
```

Depois:

```bash
claude plugin install semana@hospedin-mods
```

Feche o Claude Code e abra de novo. Depois escreva `/semana`.

## Usar

`/semana` abre o painel e responde com um resumo, como "Hoje: 16 tarefas, 2 atrasadas e nenhuma reunião. Semana de 11 a 17 de outubro: 75 tarefas, 3 concluídas e 36 além do ritmo. Colaboração: 23 conversas no Basecamp, 9 fora das suas tarefas (semana passada: 27)."

Para ver outra semana, escreva qual depois do comando:

| Comando | Semana |
|---|---|
| `/semana` | a de hoje |
| `/semana proxima` | a que vem |
| `/semana anterior` | a passada |
| `/semana +2` ou `/semana -3` | duas para frente, três para trás |

Dá para ir até 4 semanas para trás e 52 para frente. Fora da semana de hoje não tem o bloco Hoje: cada dia mostra as reuniões e as primeiras tarefas. Numa semana passada, mostra o que foi concluído e o que ficou atrasado. O ritmo é sempre o das últimas 4 semanas, contando de hoje.

O painel se atualiza a cada `/semana` e a cada 15 minutos enquanto estiver aberto, sempre na semana que está aberta. `/semana` sozinho volta para a de hoje. No terminal também tem o botão Atualizar. No app desktop o botão não aparece, porque o app ainda não repassa cliques para mods: rode `/semana` de novo.

## Quando dá erro

Se uma fonte falhar, o painel mostra a outra e diz o que fazer, em vermelho no rodapé e na resposta do `/semana`.

| O aviso diz | O que fazer |
|---|---|
| Não achei a CLI do Basecamp | Instale o plugin do Basecamp (passo 2 acima) e rode `basecamp auth login`. |
| Não consegui ler o Basecamp | Rode `basecamp auth login` e tente de novo. |
| Não consegui ler a agenda | Confira se o Google Calendar está conectado no claude.ai e abra uma sessão nova. Se o motivo falar em permissão, peça ao Claude: "libere a ferramenta list_events do Google Calendar no meu settings.json". |
| Não consegui ler (ou atualizar) a linha do tempo | O mod já tentou três vezes. Se tinha uma leitura anterior, usa ela e as concluídas mais recentes entram na próxima atualização; se não, as concluídas contam pela data de vencimento. Falha de passagem some sozinha. Se o aviso volta sempre, veja o motivo entre parênteses; costuma ser versão antiga da CLI: atualize o plugin `basecamp@37signals`. |

Em qualquer outro caso, cole a resposta do `/semana` na conversa e peça ajuda.

## Atualizar, desligar e remover

Está no [README do catálogo](../README.md#atualizar).

## Limites conhecidos

- Testado no Mac. No Windows a CLI do Basecamp pode não ser encontrada.
- A colaboração conta só comentários. Campfire, pings e menções que você leu sem responder ficam de fora.
- O dono de cada conversa é lido uma vez e fica guardado. Se a tarefa mudar de responsável depois, a conta não acompanha.
- Uma atualização do Claude Code pode quebrar o painel até sair uma versão nova dele. Enquanto isso, desligue com `claude plugin disable semana@hospedin-mods`.

## Para quem mexe no código

```
hooks/
  register.tsx   # comando, painel e busca (agenda e Basecamp)
  dados.ts       # transforma as respostas na Semana; só funções puras
  painel.ts      # desenha a Semana em SVG e em texto; só funções puras
types/index.d.ts # o formato da Semana e o estado que o painel guarda
tests/           # claude plugin test
```

Antes de abrir PR, rode da pasta do plugin:

```bash
claude plugin validate .
claude plugin test .
```

Para testar uma mudança sem instalar, abra uma sessão no terminal com `claude --plugin-dir <pasta do plugin>`.
