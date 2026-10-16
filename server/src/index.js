import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';

import { db, recordActivity, publicUser, getUser, changeHearts, syncHearts, dayString, xpOn, saveItem } from './db.js';
import { hashPassword, verifyPassword, signToken, requireAuth } from './auth.js';
import { lessons } from './content.js';
import { scenarios, categories } from './scenarios.js';
import { units, allSkills } from './course.js';
import { buildSession } from './session.js';
import { tutorReply, transcribe, aiEnabled, translateToPt, assistWriting, suggestReplies } from './ai.js';
import { scorePronunciation } from './pronunciation.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const DAILY_GOALS = [10, 20, 30, 50];
const XP_PER_LESSON = 20;
const XP_PER_MESSAGE = 2;
const XP_PER_TASK = 5;
const XP_SCENARIO_BONUS = 10;
const XP_PER_SKILL = 10;
const XP_PERFECT_BONUS = 5;

app.get('/health', (_req, res) => res.json({ ok: true, ai: aiEnabled() ? 'groq' : 'demo' }));

// ---------- Auth ----------

app.post('/auth/register', (req, res) => {
  const { name, email, password, level } = req.body ?? {};
  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Preencha nome, e-mail e senha' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres' });
  const normalized = email.trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalized)) {
    return res.status(409).json({ error: 'Este e-mail já está cadastrado' });
  }
  const { lastInsertRowid } = db
    .prepare('INSERT INTO users (name, email, password_hash, level) VALUES (?, ?, ?, ?)')
    .run(name.trim(), normalized, hashPassword(password), LEVELS.includes(level) ? level : 'beginner');
  const id = Number(lastInsertRowid);
  res.status(201).json({ token: signToken(id), user: publicUser(getUser(id)) });
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const user = email && db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !password || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

app.get('/me', requireAuth, (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const count = (sql) => db.prepare(sql).get(req.userId).n;
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = dayString(i - 6);
    return { day, xp: xpOn(req.userId, day) };
  });
  res.json({
    user: publicUser(user),
    stats: {
      lessonsCompleted: count('SELECT COUNT(*) AS n FROM lesson_progress WHERE user_id = ?'),
      totalLessons: lessons.length,
      skillsCompleted: count('SELECT COUNT(*) AS n FROM skill_progress WHERE user_id = ? AND times_completed > 0'),
      totalSkills: allSkills.length,
      conversations: count('SELECT COUNT(*) AS n FROM conversations WHERE user_id = ?'),
      savedItems: count('SELECT COUNT(*) AS n FROM saved_items WHERE user_id = ?'),
      week,
    },
  });
});

app.patch('/me', requireAuth, (req, res) => {
  const { name, level, dailyGoal } = req.body ?? {};
  if (level && !LEVELS.includes(level)) return res.status(400).json({ error: 'Nível inválido' });
  if (dailyGoal !== undefined && !DAILY_GOALS.includes(dailyGoal)) return res.status(400).json({ error: 'Meta inválida' });
  if (name?.trim()) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.userId);
  if (level) db.prepare('UPDATE users SET level = ? WHERE id = ?').run(level, req.userId);
  if (dailyGoal) db.prepare('UPDATE users SET daily_goal = ? WHERE id = ?').run(dailyGoal, req.userId);
  res.json({ user: publicUser(getUser(req.userId)) });
});

// ---------- Path (structured course) ----------

function skillStatuses(userId) {
  const done = new Map(
    db.prepare('SELECT skill_id, times_completed FROM skill_progress WHERE user_id = ?')
      .all(userId)
      .map((r) => [r.skill_id, r.times_completed]),
  );
  // Skills unlock in order: everything up to the first unfinished one is playable.
  const statuses = new Map();
  let currentFound = false;
  for (const s of allSkills) {
    const times = done.get(s.id) ?? 0;
    if (times > 0) statuses.set(s.id, { status: 'done', times });
    else if (!currentFound) { statuses.set(s.id, { status: 'current', times }); currentFound = true; }
    else statuses.set(s.id, { status: 'locked', times });
  }
  return statuses;
}

app.get('/path', requireAuth, (req, res) => {
  const statuses = skillStatuses(req.userId);
  res.json({
    user: publicUser(getUser(req.userId)),
    units: units.map((u, ui) => ({
      id: u.id,
      index: ui + 1,
      title: u.title,
      description: u.description,
      skills: u.skills.map((s) => ({ id: s.id, title: s.title, icon: s.icon, ...statuses.get(s.id) })),
    })),
  });
});

app.get('/path/skills/:id/session', requireAuth, (req, res) => {
  const status = skillStatuses(req.userId).get(req.params.id);
  if (!status) return res.status(404).json({ error: 'Habilidade não encontrada' });
  if (status.status === 'locked') return res.status(403).json({ error: 'Conclua as habilidades anteriores primeiro' });
  const { hearts } = syncHearts(getUser(req.userId));
  if (hearts <= 0) return res.status(403).json({ error: 'Você está sem vidas. Pratique pronúncia para recuperar ou aguarde.', code: 'NO_HEARTS' });
  res.json(buildSession(req.params.id));
});

app.post('/path/hearts/lose', requireAuth, (req, res) => {
  res.json(changeHearts(req.userId, -1));
});

app.post('/path/skills/:id/complete', requireAuth, (req, res) => {
  const status = skillStatuses(req.userId).get(req.params.id);
  if (!status || status.status === 'locked') return res.status(400).json({ error: 'Habilidade inválida' });
  const mistakes = Math.max(0, Number(req.body?.mistakes) || 0);
  db.prepare(`
    INSERT INTO skill_progress (user_id, skill_id, times_completed) VALUES (?, ?, 1)
    ON CONFLICT (user_id, skill_id) DO UPDATE SET times_completed = times_completed + 1, updated_at = datetime('now')
  `).run(req.userId, req.params.id);
  const xpGained = XP_PER_SKILL + (mistakes === 0 ? XP_PERFECT_BONUS : 0);
  const user = recordActivity(req.userId, xpGained);
  res.json({ user: publicUser(user), xpGained, perfect: mistakes === 0 });
});

app.get('/leaderboard', requireAuth, (req, res) => {
  const since = dayString(-6);
  const rows = db.prepare(`
    SELECT u.id, u.name, COALESCE(SUM(d.xp), 0) AS xp
    FROM users u LEFT JOIN daily_xp d ON d.user_id = u.id AND d.day >= ?
    GROUP BY u.id ORDER BY xp DESC, u.id ASC LIMIT 30
  `).all(since);
  res.json({ entries: rows.map((r, i) => ({ rank: i + 1, id: r.id, name: r.name, xp: r.xp, me: r.id === req.userId })) });
});

// ---------- Pronunciation lessons ----------

app.get('/lessons', requireAuth, (req, res) => {
  const progress = new Map(
    db.prepare('SELECT lesson_id, best_score FROM lesson_progress WHERE user_id = ?')
      .all(req.userId)
      .map((r) => [r.lesson_id, r.best_score]),
  );
  res.json({
    lessons: lessons.map(({ phrases, ...l }) => ({
      ...l,
      phraseCount: phrases.length,
      completed: progress.has(l.id),
      bestScore: progress.get(l.id) ?? null,
    })),
  });
});

app.get('/lessons/:id', requireAuth, (req, res) => {
  const lesson = lessons.find((l) => l.id === req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Lição não encontrada' });
  res.json({ lesson });
});

app.post('/lessons/:id/complete', requireAuth, (req, res) => {
  const lesson = lessons.find((l) => l.id === req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Lição não encontrada' });
  const score = Math.max(0, Math.min(100, Math.round(Number(req.body?.score) || 0)));
  db.prepare(`
    INSERT INTO lesson_progress (user_id, lesson_id, best_score) VALUES (?, ?, ?)
    ON CONFLICT (user_id, lesson_id) DO UPDATE SET best_score = MAX(best_score, excluded.best_score), completed_at = datetime('now')
  `).run(req.userId, lesson.id, score);
  // Pronunciation practice restores a heart for the path.
  changeHearts(req.userId, 1);
  const user = recordActivity(req.userId, XP_PER_LESSON);
  res.json({ user: publicUser(user), xpGained: XP_PER_LESSON, heartRestored: true });
});

// ---------- Speech ----------

app.post('/speech/transcribe', requireAuth, upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie um arquivo de áudio no campo "audio"' });
    const text = await transcribe(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ text });
  } catch (err) { next(err); }
});

app.post('/speech/score', requireAuth, upload.single('audio'), async (req, res, next) => {
  try {
    const target = req.body?.target;
    if (!target) return res.status(400).json({ error: 'Informe a frase alvo em "target"' });
    let heard = req.body?.text;
    if (req.file) heard = await transcribe(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (!heard) return res.status(400).json({ error: 'Envie áudio ou texto' });
    res.json(scorePronunciation(target, heard));
  } catch (err) { next(err); }
});

// ---------- Scenarios & conversations ----------

const parseDone = (json) => { try { return JSON.parse(json || '[]'); } catch { return []; } };

function scenarioBriefing(s, userId) {
  const { role, ...pub } = s;
  const stats = db.prepare(`
    SELECT COUNT(*) AS attempts, MAX(completed_at IS NOT NULL) AS completed
    FROM conversations WHERE user_id = ? AND scenario_id = ?
  `).get(userId, s.id);
  return { ...pub, attempts: stats.attempts, completed: Boolean(stats.completed) };
}

app.get('/scenarios', requireAuth, (req, res) => {
  res.json({ categories, scenarios: scenarios.map((s) => scenarioBriefing(s, req.userId)) });
});

app.get('/scenarios/:id', requireAuth, (req, res) => {
  const s = scenarios.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Cenário não encontrado' });
  // Most recent unfinished conversation, so the learner can pick up where they left off.
  const open = db.prepare(`
    SELECT id FROM conversations WHERE user_id = ? AND scenario_id = ? AND completed_at IS NULL ORDER BY id DESC LIMIT 1
  `).get(req.userId, s.id);
  res.json({ scenario: scenarioBriefing(s, req.userId), openConversationId: open?.id ?? null });
});

app.post('/conversations', requireAuth, (req, res) => {
  const scenario = scenarios.find((s) => s.id === req.body?.scenarioId);
  if (!scenario) return res.status(400).json({ error: 'Cenário inválido' });
  const { lastInsertRowid } = db
    .prepare('INSERT INTO conversations (user_id, scenario_id) VALUES (?, ?)')
    .run(req.userId, scenario.id);
  const conversationId = Number(lastInsertRowid);
  db.prepare("INSERT INTO messages (conversation_id, role, content, translation) VALUES (?, 'assistant', ?, ?)")
    .run(conversationId, scenario.opener, scenario.opener_pt ?? null);
  res.status(201).json({ conversationId });
});

app.get('/conversations', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.scenario_id, c.created_at, c.completed_at, c.tasks_done, COUNT(m.id) AS message_count
    FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.user_id = ? GROUP BY c.id ORDER BY c.id DESC LIMIT 30
  `).all(req.userId);
  res.json({
    conversations: rows.map((r) => {
      const s = scenarios.find((x) => x.id === r.scenario_id);
      return {
        id: r.id,
        scenarioId: r.scenario_id,
        title: s?.title,
        icon: s?.icon,
        createdAt: r.created_at,
        completed: Boolean(r.completed_at),
        tasksDone: parseDone(r.tasks_done).length,
        tasksTotal: s?.tasks.length ?? 0,
        messageCount: r.message_count,
      };
    }),
  });
});

function ownConversation(userId, id) {
  return db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(id, userId);
}

app.get('/conversations/:id', requireAuth, (req, res) => {
  const convo = ownConversation(req.userId, req.params.id);
  if (!convo) return res.status(404).json({ error: 'Conversa não encontrada' });
  const scenario = scenarios.find((s) => s.id === convo.scenario_id);
  const messages = db.prepare('SELECT id, role, content, feedback, translation FROM messages WHERE conversation_id = ? ORDER BY id')
    .all(convo.id)
    .map((m) => ({ ...m, feedback: m.feedback ? JSON.parse(m.feedback) : null }));
  res.json({
    conversationId: convo.id,
    scenario: scenario ? scenarioBriefing(scenario, req.userId) : null,
    tasksDone: parseDone(convo.tasks_done),
    completed: Boolean(convo.completed_at),
    messages,
  });
});

app.post('/conversations/:id/messages', requireAuth, async (req, res, next) => {
  try {
    const convo = ownConversation(req.userId, req.params.id);
    if (!convo) return res.status(404).json({ error: 'Conversa não encontrada' });
    const text = String(req.body?.text ?? '').trim();
    if (!text) return res.status(400).json({ error: 'Mensagem vazia' });

    const scenario = scenarios.find((s) => s.id === convo.scenario_id);
    const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id').all(convo.id);
    history.push({ role: 'user', content: text });
    const done = parseDone(convo.tasks_done);

    const { reply, replyPt, feedback, tasksCompleted } = await tutorReply({
      scenario, level: getUser(req.userId).level, history, tasks: scenario.tasks, done,
    });

    const userMsg = db.prepare("INSERT INTO messages (conversation_id, role, content, feedback) VALUES (?, 'user', ?, ?)")
      .run(convo.id, text, feedback ? JSON.stringify(feedback) : null);
    const tutorMsg = db.prepare("INSERT INTO messages (conversation_id, role, content, translation) VALUES (?, 'assistant', ?, ?)")
      .run(convo.id, reply, replyPt);

    // Track scenario tasks; the scenario counts as completed once every task is done.
    const tasksDone = [...new Set([...done, ...tasksCompleted])].sort();
    const justCompleted = scenario.tasks.length > 0 && tasksDone.length === scenario.tasks.length && !convo.completed_at;
    db.prepare(`UPDATE conversations SET tasks_done = ?, completed_at = CASE WHEN ? THEN datetime('now') ELSE completed_at END WHERE id = ?`)
      .run(JSON.stringify(tasksDone), justCompleted ? 1 : 0, convo.id);

    // Mistakes become study material: the corrected sentence and any new vocabulary.
    let savedCount = 0;
    if (feedback && !feedback.ok && feedback.corrected) {
      const item = saveItem(req.userId, {
        kind: 'phrase', en: feedback.corrected, pt: feedback.corrected_pt, note: feedback.explanation_pt, source: 'correction',
      });
      if (item) savedCount++;
    }
    for (const v of Array.isArray(feedback?.vocab) ? feedback.vocab.slice(0, 2) : []) {
      const item = v?.en && saveItem(req.userId, { kind: 'word', en: v.en, pt: v.pt, source: 'correction' });
      if (item) savedCount++;
    }

    const xp = XP_PER_MESSAGE + tasksCompleted.length * XP_PER_TASK + (justCompleted ? XP_SCENARIO_BONUS : 0);
    const user = recordActivity(req.userId, xp);

    res.json({
      userMessageId: Number(userMsg.lastInsertRowid),
      replyMessageId: Number(tutorMsg.lastInsertRowid),
      feedback,
      reply,
      replyPt,
      tasksCompleted,
      tasksDone,
      scenarioCompleted: justCompleted,
      savedCount,
      xpGained: xp,
      user: publicUser(user),
    });
  } catch (err) { next(err); }
});

// Translates (and caches) a tutor message — used for messages saved before translations existed.
app.post('/conversations/:id/messages/:messageId/translate', requireAuth, async (req, res, next) => {
  try {
    const convo = ownConversation(req.userId, req.params.id);
    if (!convo) return res.status(404).json({ error: 'Conversa não encontrada' });
    const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND conversation_id = ?').get(req.params.messageId, convo.id);
    if (!msg) return res.status(404).json({ error: 'Mensagem não encontrada' });
    if (msg.translation) return res.json({ translation: msg.translation });
    const translation = await translateToPt(msg.content);
    if (!translation) return res.status(503).json({ error: 'Tradução indisponível no modo demo' });
    db.prepare('UPDATE messages SET translation = ? WHERE id = ?').run(translation, msg.id);
    res.json({ translation });
  } catch (err) { next(err); }
});

const lastTutorLine = (conversationId) =>
  db.prepare("SELECT content FROM messages WHERE conversation_id = ? AND role = 'assistant' ORDER BY id DESC LIMIT 1").get(conversationId)?.content;

// Live writing help while the learner types (draft can be PT, EN or mixed).
app.post('/conversations/:id/assist', requireAuth, async (req, res, next) => {
  try {
    const convo = ownConversation(req.userId, req.params.id);
    if (!convo) return res.status(404).json({ error: 'Conversa não encontrada' });
    const draft = String(req.body?.text ?? '').trim().slice(0, 500);
    if (draft.length < 2) return res.status(400).json({ error: 'Texto muito curto' });
    res.json(await assistWriting({ draft, context: lastTutorLine(convo.id), level: getUser(req.userId).level }));
  } catch (err) { next(err); }
});

// Three possible replies to the tutor's last message, nudging toward pending tasks.
app.get('/conversations/:id/suggestions', requireAuth, async (req, res, next) => {
  try {
    const convo = ownConversation(req.userId, req.params.id);
    if (!convo) return res.status(404).json({ error: 'Conversa não encontrada' });
    const scenario = scenarios.find((s) => s.id === convo.scenario_id);
    const done = parseDone(convo.tasks_done);
    const pendingTasks = scenario.tasks.filter((_, i) => !done.includes(i));
    const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id').all(convo.id);
    res.json({ suggestions: await suggestReplies({ scenario, level: getUser(req.userId).level, history, pendingTasks }) });
  } catch (err) { next(err); }
});

// ---------- Saved phrases & words (review) ----------

const publicItem = (r) => ({
  id: r.id, kind: r.kind, en: r.en, pt: r.pt, note: r.note, source: r.source, strength: r.strength, createdAt: r.created_at,
});

app.get('/saved', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM saved_items WHERE user_id = ? ORDER BY id DESC').all(req.userId);
  res.json({ items: rows.map(publicItem) });
});

app.post('/saved', requireAuth, async (req, res, next) => {
  try {
    const { kind = 'phrase', en, pt, note } = req.body ?? {};
    if (!['phrase', 'word'].includes(kind) || !String(en ?? '').trim()) {
      return res.status(400).json({ error: 'Informe o texto em inglês' });
    }
    const translation = pt || (await translateToPt(String(en)).catch(() => null));
    const item = saveItem(req.userId, { kind, en, pt: translation, note, source: 'manual' });
    res.status(201).json({ item: publicItem(item) });
  } catch (err) { next(err); }
});

app.delete('/saved/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM saved_items WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  res.json({ ok: true });
});

// Flashcard result: "known" strengthens the item, otherwise it goes back to the start.
app.post('/saved/:id/review', requireAuth, (req, res) => {
  const known = Boolean(req.body?.known);
  db.prepare(`
    UPDATE saved_items SET strength = CASE WHEN ? THEN MIN(strength + 1, 5) ELSE 0 END, reviewed_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(known ? 1 : 0, req.params.id, req.userId);
  const row = db.prepare('SELECT * FROM saved_items WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Item não encontrado' });
  const user = recordActivity(req.userId, 1);
  res.json({ item: publicItem(row), user: publicUser(user) });
});

// ---------- Errors ----------

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Erro interno no servidor' });
});

const port = Number(process.env.PORT) || 3333;
app.listen(port, '0.0.0.0', () => {
  console.log(`API rodando em http://localhost:${port} — IA: ${aiEnabled() ? 'Groq' : 'modo demo (sem GROQ_API_KEY)'}`);
});
