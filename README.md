# Mods da Hospedin para o Claude Code

**Em teste.** Mods são um recurso novo do Claude Code e ainda mudam de uma versão para outra. Uma atualização do Claude Code pode quebrar um mod até sair uma versão nova dele. Por isso eles ficam aqui, separados, e cada pessoa instala só o que quer.

## Instalar

Adicione este catálogo uma vez:

```bash
claude plugin marketplace add fllag/claude-mods
```

Depois instale o mod que quiser:

```bash
claude plugin install semana@hospedin-mods
```

Feche o Claude Code e abra de novo.

Prefere não usar o terminal? Cole isto numa conversa do Claude Code:

> Adicione o catálogo de mods `fllag/claude-mods` e instale o `semana@hospedin-mods`.

## Os mods

| Mod | O que faz | Precisa de |
|---|---|---|
| [`semana`](semana/README.md) | `/semana` abre um painel com as reuniões e as tarefas da semana, o que fazer hoje e quanto da semana passa do seu ritmo. | Google Calendar conectado no claude.ai e CLI do Basecamp autenticada |

## Atualizar

Quando avisarem que saiu versão nova, atualize o catálogo:

```bash
claude plugin marketplace update hospedin-mods
```

E o mod:

```bash
claude plugin update semana@hospedin-mods
```

Reinicie o Claude Code depois.

## Quando um mod quebrar

Desligue sem desinstalar:

```bash
claude plugin disable semana@hospedin-mods
```

Avise quem mantém o mod, com a mensagem de erro. Quando sair a correção, atualize e religue com `claude plugin enable semana@hospedin-mods`. Para tirar de vez, `claude plugin uninstall semana@hospedin-mods`.

## Para quem cria mods

Cada mod é uma pasta com `.claude-plugin/plugin.json`, `hooks/` e `tests/`, e uma entrada em `.claude-plugin/marketplace.json`. Antes de subir uma mudança, rode da pasta do mod:

```bash
claude plugin validate .
claude plugin test .
```

Suba a `version` no `plugin.json` do mod a cada mudança: é por ela que quem já instalou vê que tem novidade.

**Este repositório é público.** Nada de dado de ninguém aqui: nem tarefa, nem reunião, nem print do painel com informação real. Teste com exemplos inventados.
