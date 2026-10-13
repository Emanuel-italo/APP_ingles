# Fala — aprenda inglês falando

App de inglês com tutor de IA por voz. Um único código roda em **Android, iOS e Web**.

```
APP_ingles/
├── server/   API Node + Express + SQLite (node:sqlite) + IA Groq
└── app/      Expo (React Native + expo-router) — mobile e web
```

## Funcionalidades

- **Trilha**: 6 unidades / 15 habilidades em sequência. Cada sessão tem ~10 exercícios de 7 tipos
  (vocabulário, tradução com banco de palavras PT→EN e EN→PT, escuta, completar lacuna, pares, fala).
  Erros voltam no fim da sessão; cada erro custa uma vida (5 no máximo, +1 a cada 20 min).
- **Pronúncia**: ouça a frase, repita no microfone e receba nota por palavra (recupera uma vida)
- **Conversa com tutor de IA** em 6 situações, por voz ou texto, com correção explicada em português
- **Gamificação**: XP, meta diária configurável, sequência de dias, gráfico semanal e ranking semanal
- Voz do tutor via TTS do próprio aparelho/navegador (grátis)

## IA gratuita (Groq)

1. Crie uma chave grátis em https://console.groq.com/keys
2. Coloque em `server/.env`: `GROQ_API_KEY=gsk_...`

Modelos usados: `llama-3.3-70b-versatile` (tutor) e `whisper-large-v3-turbo` (voz → texto).
Sem chave, o servidor roda em **modo demo** (respostas de exemplo; use o campo de texto em vez do microfone).
Como a API é compatível com OpenAI, dá para trocar de provedor mudando `AI_BASE_URL`, `AI_CHAT_MODEL` e `AI_STT_MODEL`.

## Rodando

Requer Node 22.13+.

```bash
# Terminal 1 — API (porta 3333)
cd server
npm install
npm run dev

# Terminal 2 — app
cd app
npm install
npm run web        # navegador
npm start          # QR code → Expo Go no celular (mesma rede Wi-Fi)
```

No celular, o app descobre sozinho o IP do seu computador (o mesmo que serve o bundle) e usa a porta 3333.
Libere a porta 3333 no firewall do Windows se o celular não conectar.
Para produção, defina `EXPO_PUBLIC_API_URL=https://sua-api.com` ao gerar o build.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | status e modo da IA |
| POST | `/auth/register`, `/auth/login` | retorna `{ token, user }` |
| GET/PATCH | `/me` | perfil, estatísticas, troca de nível |
| GET | `/path` | unidades e habilidades com status (done/current/locked) |
| GET | `/path/skills/:id/session` | gera ~10 exercícios para a habilidade |
| POST | `/path/skills/:id/complete` | `{ mistakes }` → +10 XP (+5 se perfeita) |
| POST | `/path/hearts/lose` | desconta uma vida |
| GET | `/leaderboard` | ranking de XP dos últimos 7 dias |
| GET | `/lessons`, `/lessons/:id` | lições de pronúncia e progresso |
| POST | `/lessons/:id/complete` | `{ score }` → salva melhor nota, +20 XP |
| POST | `/speech/transcribe` | multipart `audio` → `{ text }` |
| POST | `/speech/score` | multipart `target` + `audio` (ou `text`) → nota por palavra |
| GET | `/scenarios` | situações de conversa |
| GET/POST | `/conversations` | listar / iniciar conversa |
| GET | `/conversations/:id` | histórico |
| POST | `/conversations/:id/messages` | `{ text }` → resposta do tutor + correção, +2 XP |

## Próximos passos sugeridos

- Publicar a API (Render, Railway, Fly.io) e trocar `JWT_SECRET`
- Builds de loja com EAS: `npx eas-cli@latest build`
- Mais unidades em `server/src/course.js` e lições de pronúncia em `server/src/content.js`
