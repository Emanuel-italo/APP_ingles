// AI provider: Groq (free tier, OpenAI-compatible API).
// - Tutor chat:      openai/gpt-oss-120b
// - Writing helper:  openai/gpt-oss-20b (fast, called while the user types)
// Model names change over time: list the current ones with GET {AI_BASE_URL}/models.
// - Speech-to-text:  whisper-large-v3-turbo
// Without GROQ_API_KEY the server runs in demo mode with canned replies.

const BASE_URL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
const CHAT_MODEL = process.env.AI_CHAT_MODEL || 'openai/gpt-oss-120b';
const FAST_MODEL = process.env.AI_FAST_MODEL || 'openai/gpt-oss-20b';
const STT_MODEL = process.env.AI_STT_MODEL || 'whisper-large-v3-turbo';

export const aiEnabled = () => Boolean(process.env.GROQ_API_KEY);

function authHeaders() {
  return { Authorization: `Bearer ${process.env.GROQ_API_KEY}` };
}

/** Calls the chat API in JSON mode and returns the parsed object (or {} on bad JSON). */
async function chatJson({ model = CHAT_MODEL, temperature = 0.7, messages }) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: 'json_object' },
      // gpt-oss models reason before answering; keep that short so replies stay fast.
      ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
      messages,
    }),
  });
  if (!res.ok) throw new Error(`AI chat failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}

const LEVEL_HINT = {
  beginner: 'Use very simple vocabulary and short sentences (A1-A2).',
  intermediate: 'Use everyday vocabulary and natural sentences (B1-B2).',
  advanced: 'Speak naturally, including idioms and phrasal verbs (C1).',
};

function tasksBlock(tasks, done) {
  if (!tasks?.length) return '';
  const lines = tasks.map((t, i) => `  ${i}. ${t.en}${done.includes(i) ? ' (already done)' : ''}`).join('\n');
  return `
The learner has these conversation tasks (index. task):
${lines}
Gently steer the conversation so the learner gets chances to complete the pending tasks.
Be generous when checking tasks: a task is completed as soon as the learner's latest message attempts it,
even with grammar mistakes (e.g. "my name is Ana" completes "Introduce yourself"; any question about the partner counts as asking a question).
For tasks that need several actions (e.g. "two questions"), count everything the learner said in this conversation.`;
}

function systemPrompt(scenario, level, tasks, done) {
  return `You are role-playing as ${scenario.role}. The user is a Brazilian Portuguese speaker practicing spoken English.
${LEVEL_HINT[level] || LEVEL_HINT.beginner}
${tasksBlock(tasks, done)}

Rules:
- Stay in character and keep the conversation going. Reply in English, 1-3 short sentences, and usually end with a question.
- Review ONLY the user's latest message for grammar, word choice and naturalness. Ignore missing final punctuation and capitalization (it comes from speech).
- If the user writes in Portuguese, answer in English anyway and show in "corrected" how to say it in English.
- Respond with a JSON object and nothing else, in this exact shape:
{
  "reply": "your in-character reply in English",
  "reply_pt": "a natural Brazilian Portuguese translation of your reply",
  "tasks_completed": [indices of pending tasks the user's latest message clearly completed, or empty array],
  "feedback": {
    "ok": true or false,
    "corrected": "a corrected, natural version of the user's message (same as original if ok)",
    "corrected_pt": "Brazilian Portuguese translation of the corrected sentence",
    "explanation_pt": "short explanation in Brazilian Portuguese of what to fix, or a short compliment if ok",
    "tip": "optional: a more natural/native way to say it, or empty string",
    "vocab": [0 to 2 useful English words or short expressions from the correction that the learner got wrong or did not know, as {"en": "...", "pt": "..."}]
  }
}`;
}

/**
 * history: [{ role: 'user' | 'assistant', content: string }]
 * tasks: [{ en, pt }], done: indices already completed.
 * Returns { reply, replyPt, feedback, tasksCompleted }.
 */
export async function tutorReply({ scenario, level, history, tasks = [], done = [] }) {
  if (!aiEnabled()) return demoReply(history, tasks, done);

  const parsed = await chatJson({
    messages: [{ role: 'system', content: systemPrompt(scenario, level, tasks, done) }, ...history.slice(-20)],
  });
  if (parsed._raw) return { reply: parsed._raw.trim(), replyPt: null, feedback: null, tasksCompleted: [] };
  const tasksCompleted = (Array.isArray(parsed.tasks_completed) ? parsed.tasks_completed : [])
    .map(Number)
    .filter((i) => Number.isInteger(i) && i >= 0 && i < tasks.length && !done.includes(i));
  return {
    reply: String(parsed.reply || '').trim() || 'Sorry, could you say that again?',
    replyPt: parsed.reply_pt ? String(parsed.reply_pt).trim() : null,
    feedback: parsed.feedback ?? null,
    tasksCompleted: [...new Set(tasksCompleted)],
  };
}

/** Translates an English message into Brazilian Portuguese. */
export async function translateToPt(text) {
  if (!aiEnabled()) return null;
  const parsed = await chatJson({
    model: FAST_MODEL,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'Translate the user text from English to natural Brazilian Portuguese. Respond only with JSON: {"pt": "..."}' },
      { role: 'user', content: text },
    ],
  });
  return parsed.pt ? String(parsed.pt).trim() : null;
}

/**
 * Live writing support while the learner types a reply.
 * The draft may be English, Portuguese or a mix of both.
 * Returns { english, meaning_pt, note_pt, ok }.
 */
export async function assistWriting({ draft, context, level }) {
  if (!aiEnabled()) {
    return { english: draft, meaning_pt: '', note_pt: 'Modo demo: configure GROQ_API_KEY para receber ajuda na escrita.', ok: true };
  }
  const parsed = await chatJson({
    model: FAST_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: `You help a Brazilian learner (${level}) write a reply in an English conversation.
The learner's draft may be in English, Portuguese, or a mix. It may be unfinished.
${context ? `The other person just said: "${context}"` : ''}
Respond only with JSON:
{
  "english": "the natural, correct English version of what the learner wants to say (keep their meaning; if the draft is already correct English, repeat it)",
  "meaning_pt": "what the English version means, in Brazilian Portuguese",
  "note_pt": "one short tip in Brazilian Portuguese about a mistake or a useful word, or empty string",
  "ok": true if the draft was already correct English, otherwise false
}`,
      },
      { role: 'user', content: draft },
    ],
  });
  return {
    english: String(parsed.english ?? '').trim(),
    meaning_pt: String(parsed.meaning_pt ?? '').trim(),
    note_pt: String(parsed.note_pt ?? '').trim(),
    ok: Boolean(parsed.ok),
  };
}

/** Three short possible replies to the tutor's last message, each with a translation. */
export async function suggestReplies({ scenario, level, history, pendingTasks = [] }) {
  if (!aiEnabled()) {
    return [
      { en: "I'm doing well, thanks!", pt: 'Estou bem, obrigado!' },
      { en: 'Could you repeat that, please?', pt: 'Você pode repetir, por favor?' },
      { en: "I'm not sure. What do you think?", pt: 'Não tenho certeza. O que você acha?' },
    ];
  }
  const transcript = history.slice(-8).map((m) => `${m.role === 'user' ? 'Learner' : 'Partner'}: ${m.content}`).join('\n');
  const parsed = await chatJson({
    model: FAST_MODEL,
    temperature: 0.8,
    messages: [
      {
        role: 'system',
        content: `A Brazilian learner (${level}) is practicing English with ${scenario.role}.
${LEVEL_HINT[level] || LEVEL_HINT.beginner}
Suggest 3 different short replies the learner could say next (vary them: one simple, one with a question back, one more detailed).
${pendingTasks.length ? `When it fits naturally, help with these pending tasks: ${pendingTasks.map((t) => t.en).join('; ')}.` : ''}
Respond only with JSON: {"suggestions": [{"en": "...", "pt": "Brazilian Portuguese translation"}]}`,
      },
      { role: 'user', content: transcript },
    ],
  });
  const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  return list
    .filter((s) => s && s.en)
    .slice(0, 3)
    .map((s) => ({ en: String(s.en).trim(), pt: String(s.pt ?? '').trim() }));
}

/** Transcribes an English audio clip. buffer: Buffer, filename/mime from the upload. */
export async function transcribe(buffer, filename, mimetype) {
  if (!aiEnabled()) {
    throw Object.assign(new Error('Transcrição de voz requer GROQ_API_KEY no servidor. Use o campo de texto no modo demo.'), { status: 503 });
  }
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimetype || 'audio/m4a' }), filename || 'audio.m4a');
  form.append('model', STT_MODEL);
  form.append('language', 'en');
  form.append('response_format', 'json');

  const res = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return String(data.text || '').trim();
}

const DEMO_REPLIES = [
  ["That's great! Tell me more about that.", 'Que ótimo! Me conte mais sobre isso.'],
  ['Interesting! Why do you think so?', 'Interessante! Por que você acha isso?'],
  ['Nice! What did you do next?', 'Legal! O que você fez depois?'],
  ['I see. How did that make you feel?', 'Entendi. Como você se sentiu com isso?'],
  ['Cool! Do you do that often?', 'Legal! Você faz isso com frequência?'],
];

function demoReply(history, tasks = [], done = []) {
  const turns = history.filter((m) => m.role === 'user').length;
  const last = history.at(-1)?.content ?? '';
  const startsLower = last && last[0] === last[0].toLowerCase() && /[a-z]/.test(last[0]);
  const fixed = startsLower ? last[0].toUpperCase() + last.slice(1) : last;
  const [reply, replyPt] = DEMO_REPLIES[turns % DEMO_REPLIES.length];
  const nextTask = tasks.findIndex((_, i) => !done.includes(i));
  return {
    reply: `[demo] ${reply}`,
    replyPt,
    tasksCompleted: nextTask >= 0 ? [nextTask] : [],
    feedback: {
      ok: !startsLower,
      corrected: fixed,
      corrected_pt: '',
      vocab: [],
      explanation_pt: startsLower
        ? 'Modo demo: comece frases com letra maiúscula. Configure GROQ_API_KEY para correções reais.'
        : 'Modo demo: configure GROQ_API_KEY no servidor para receber correções reais da IA.',
      tip: '',
    },
  };
}
