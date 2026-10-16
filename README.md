# Fala — aprenda inglês conversando

App para brasileiros praticarem **conversação em inglês** com um tutor de IA, por voz ou texto.
O tutor responde em personagem, traduz cada fala para o português e corrige seus erros na hora.
Um único código roda em **Android, iOS e Web**.

## Sumário

- [Funcionalidades](#funcionalidades)
- [Como rodar](#como-rodar)
- [Configuração](#configuração)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como adicionar conteúdo](#como-adicionar-conteúdo)
- [API](#api)
- [Problemas comuns](#problemas-comuns)
- [Próximos passos](#próximos-passos)

## Funcionalidades

### Conversação (foco principal)

- **Conversa livre** com o tutor, sem roteiro.
- **11 cenários de role-play** (cafeteria, restaurante, consulta médica, academia, novo vizinho,
  planos de fim de semana, hotel, aeroporto, pedir informação, entrevista de emprego e papo com colega).
  Cada um tem um briefing com contexto, objetivo e **3 tarefas**, marcadas automaticamente pela IA
  durante a conversa.
- **Microfone em primeiro plano**: você responde falando; o teclado é opcional.
- Em cada fala do tutor: **tradução em português**, ouvir (normal ou devagar), ocultar o texto para
  treinar a escuta e salvar a frase.
- **Ideias do que dizer**: o botão de lâmpada sugere 3 respostas, com tradução, priorizando as tarefas pendentes.
- **Correção com asterisco**: frases com erro ganham um `*`; ao tocar, aparece a forma correta,
  a tradução, a explicação em português e as palavras novas.
- **Ajuda na escrita**: no modo teclado, escreva em inglês, português ou misturado e veja como fica em inglês.

### Revisar

- Toda correção é **salva automaticamente**, separada em frases e palavras. Você também pode salvar
  qualquer fala do tutor.
- **Cartões de revisão**: veja a frase em português, tente lembrar em inglês e marque se já sabe.
  Cada item tem um indicador de domínio de 0 a 5.

### Módulos complementares

- **Pronúncia**: ouça uma frase, repita no microfone e receba nota palavra por palavra.
  Cada lição concluída devolve uma vida da Trilha.
- **Trilha** (opcional, estilo curso): 6 unidades e 15 habilidades com exercícios de vocabulário,
  tradução, escuta, lacunas, pares e fala. Usa vidas: 5 no máximo, com uma nova a cada 20 minutos.
- **Progresso**: XP, meta diária, sequência de dias, gráfico semanal e ranking semanal.

## Como rodar

**Requisitos:** Node.js 22.13 ou superior (o banco usa o `node:sqlite` nativo) e uma chave gratuita do Groq.

```bash
# 1. API (porta 3333)
cd server
npm install
cp .env.example .env      # depois coloque sua GROQ_API_KEY no .env
npm run dev

# 2. App (em outro terminal)
cd app
npm install
npm run web               # abre no navegador
npm start                 # mostra um QR code para abrir no Expo Go (celular na mesma rede Wi-Fi)
```

Sem `GROQ_API_KEY`, o servidor roda em **modo demo**: respostas de exemplo e sem reconhecimento de voz.
Use o campo de texto para testar.

## Configuração

Variáveis do arquivo `server/.env`:

| Variável | Padrão | Para que serve |
|---|---|---|
| `GROQ_API_KEY` | — | Chave da IA. Crie grátis em https://console.groq.com/keys |
| `JWT_SECRET` | `dev-secret-change-me` | Assina os logins. **Troque em produção.** |
| `PORT` | `3333` | Porta da API |
| `DB_PATH` | `server/data/app.db` | Arquivo do banco SQLite (criado automaticamente) |
| `AI_BASE_URL` | `https://api.groq.com/openai/v1` | Qualquer API compatível com OpenAI |
| `AI_CHAT_MODEL` | `openai/gpt-oss-120b` | Tutor: respostas, correções e tarefas |
| `AI_FAST_MODEL` | `openai/gpt-oss-20b` | Ajuda na escrita, sugestões e traduções |
| `AI_STT_MODEL` | `whisper-large-v3-turbo` | Voz → texto |

> Os provedores retiram modelos com o tempo. Se a API responder `model_not_found`, veja os modelos
> disponíveis na sua conta com `GET {AI_BASE_URL}/models` e ajuste as variáveis acima.

No app, o endereço da API é descoberto sozinho em desenvolvimento: no celular, ele usa o IP do
computador que serve o bundle. Para um build de produção, defina `EXPO_PUBLIC_API_URL=https://sua-api.com`.

## Estrutura do projeto

```
APP_ingles/
├── server/                  API: Node + Express + SQLite + Groq
│   └── src/
│       ├── index.js         rotas
│       ├── db.js            tabelas, migrações, XP, sequência e vidas
│       ├── ai.js            tutor, traduções, sugestões, ajuda na escrita e transcrição
│       ├── scenarios.js     cenários de conversa (briefing, tarefas, personagens)
│       ├── content.js       lições de pronúncia
│       ├── course.js        unidades e habilidades da Trilha
│       ├── session.js       gerador de exercícios da Trilha
│       ├── pronunciation.js nota de pronúncia por palavra
│       └── auth.js          senhas (scrypt) e JWT
│
└── app/                     Expo (React Native + expo-router)
    └── src/
        ├── app/             telas (cada arquivo é uma rota)
        │   ├── (auth)/      boas-vindas, login, cadastro
        │   ├── (tabs)/      Conversar, Revisar, Pronúncia, Trilha, Perfil
        │   ├── scenario/    briefing do cenário
        │   ├── chat/        conversa com o tutor
        │   ├── lesson/      lição de pronúncia
        │   ├── session/     sessão de exercícios da Trilha
        │   ├── practice-cards.tsx  cartões de revisão
        │   └── ranking.tsx
        ├── components/      UI base, botão de microfone, exercícios
        └── lib/             cliente da API, sessão, voz (gravação e TTS), tema
```

## Como adicionar conteúdo

- **Novo cenário:** acrescente um objeto em `server/src/scenarios.js`, com `id`, `category`, `title`,
  `icon` ([Ionicons](https://icons.expo.fyi)), `partner`, `setting_pt`, `goal_pt`/`goal_en`, `role`
  (instrução em inglês para a IA), `opener`/`opener_pt` e 3 `tasks` (`{ pt, en }`).
- **Nova lição de pronúncia:** `server/src/content.js`.
- **Nova unidade da Trilha:** `server/src/course.js`. Os exercícios são gerados a partir das frases e palavras.

Reinicie a API depois de editar. Com `npm run dev`, ela reinicia sozinha.

## API

Todas as rotas, exceto `/health` e `/auth/*`, exigem o cabeçalho `Authorization: Bearer <token>`.

**Conta**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Status e modo da IA (`groq` ou `demo`) |
| POST | `/auth/register`, `/auth/login` | Retorna `{ token, user }` |
| GET / PATCH | `/me` | Perfil e estatísticas / altera nome, nível ou meta diária |

**Conversação**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/scenarios` | Categorias e cenários, com status de conclusão |
| GET | `/scenarios/:id` | Briefing e conversa em aberto, se houver |
| GET / POST | `/conversations` | Lista as conversas / inicia uma (`{ scenarioId }`) |
| GET | `/conversations/:id` | Mensagens, cenário e tarefas concluídas |
| POST | `/conversations/:id/messages` | `{ text }` → resposta, tradução, correção, tarefas e XP |
| POST | `/conversations/:id/messages/:messageId/translate` | Traduz uma mensagem antiga |
| GET | `/conversations/:id/suggestions` | 3 ideias de resposta |
| POST | `/conversations/:id/assist` | `{ text }` → versão em inglês, significado e dica |

**Revisar**

| Método | Rota | Descrição |
|---|---|---|
| GET / POST | `/saved` | Lista os itens salvos / salva `{ kind: 'phrase' \| 'word', en, pt? }` |
| DELETE | `/saved/:id` | Remove um item |
| POST | `/saved/:id/review` | `{ known }` → atualiza o domínio (0–5) |

**Voz, pronúncia e Trilha**

| Método | Rota | Descrição |
|---|---|---|
| POST | `/speech/transcribe` | Multipart `audio` → `{ text }` |
| POST | `/speech/score` | Multipart `target` + `audio` (ou `text`) → nota por palavra |
| GET | `/lessons`, `/lessons/:id` | Lições de pronúncia e progresso |
| POST | `/lessons/:id/complete` | `{ score }` → +20 XP e +1 vida |
| GET | `/path` | Unidades e habilidades (`done`, `current`, `locked`) |
| GET | `/path/skills/:id/session` | Gera cerca de 10 exercícios |
| POST | `/path/skills/:id/complete` | `{ mistakes }` → +10 XP (+5 se não houver erros) |
| POST | `/path/hearts/lose` | Desconta uma vida |
| GET | `/leaderboard` | Ranking de XP dos últimos 7 dias |

**XP:** +2 por mensagem, +5 por tarefa concluída e +10 ao concluir um cenário.

## Problemas comuns

| Sintoma | Solução |
|---|---|
| "Não foi possível conectar ao servidor" | Verifique se a API está rodando (`cd server && npm run dev`). |
| O celular não conecta à API | Use a mesma rede Wi-Fi do computador e libere a porta 3333 no firewall do Windows. |
| "Erro interno no servidor" ao conversar | Veja o terminal da API. Se aparecer `model_not_found`, troque os modelos (veja [Configuração](#configuração)). |
| O microfone não funciona no navegador | Permita o acesso ao microfone. Em produção, o site precisa usar HTTPS. |
| Respostas começam com `[demo]` | Falta a `GROQ_API_KEY` no `server/.env`. |

## Próximos passos

- Publicar a API (Render, Railway, Fly.io) com um `JWT_SECRET` forte
- Gerar builds de loja com EAS: `npx eas-cli@latest build`
- Escrever mais cenários e unidades
