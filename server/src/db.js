import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = process.env.DB_PATH || join(root, 'data', 'app.db');
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'beginner',
    xp INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    last_active_day TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lesson_progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL,
    best_score INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, lesson_id)
  );

  CREATE TABLE IF NOT EXISTS skill_progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL,
    times_completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, skill_id)
  );

  CREATE TABLE IF NOT EXISTS daily_xp (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scenario_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    feedback TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Columns added after the first release — add them to existing databases.
const userColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
const migrations = {
  hearts: 'ALTER TABLE users ADD COLUMN hearts INTEGER NOT NULL DEFAULT 5',
  hearts_at: 'ALTER TABLE users ADD COLUMN hearts_at INTEGER',
  daily_goal: 'ALTER TABLE users ADD COLUMN daily_goal INTEGER NOT NULL DEFAULT 30',
};
for (const [col, sql] of Object.entries(migrations)) if (!userColumns.has(col)) db.exec(sql);

const messageColumns = new Set(db.prepare('PRAGMA table_info(messages)').all().map((c) => c.name));
if (!messageColumns.has('translation')) db.exec('ALTER TABLE messages ADD COLUMN translation TEXT');

const conversationColumns = new Set(db.prepare('PRAGMA table_info(conversations)').all().map((c) => c.name));
if (!conversationColumns.has('tasks_done')) db.exec("ALTER TABLE conversations ADD COLUMN tasks_done TEXT NOT NULL DEFAULT '[]'");
if (!conversationColumns.has('completed_at')) db.exec('ALTER TABLE conversations ADD COLUMN completed_at TEXT');

// Phrases and words the learner saved (automatically from corrections, or by hand).
db.exec(`
  CREATE TABLE IF NOT EXISTS saved_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('phrase', 'word')),
    en TEXT NOT NULL,
    pt TEXT,
    note TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    strength INTEGER NOT NULL DEFAULT 0,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, kind, en)
  );
`);

/** Saves a phrase/word; if it already exists, fills in missing translation/note. Returns the row. */
export function saveItem(userId, { kind, en, pt = null, note = null, source = 'manual' }) {
  const text = String(en ?? '').trim();
  if (!text) return null;
  db.prepare(`
    INSERT INTO saved_items (user_id, kind, en, pt, note, source) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, kind, en) DO UPDATE SET
      pt = COALESCE(saved_items.pt, excluded.pt),
      note = COALESCE(saved_items.note, excluded.note)
  `).run(userId, kind, text, pt || null, note || null, source);
  return db.prepare('SELECT * FROM saved_items WHERE user_id = ? AND kind = ? AND en = ?').get(userId, kind, text);
}

export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 20 * 60 * 1000;

export const dayString = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

export const getUser = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

/** Applies time-based heart regeneration and persists it. Returns { hearts, nextHeartAt }. */
export function syncHearts(user) {
  let { hearts, hearts_at: since } = user;
  const now = Date.now();
  if (hearts < MAX_HEARTS && since) {
    const gained = Math.floor((now - since) / HEART_REGEN_MS);
    if (gained > 0) {
      hearts = Math.min(MAX_HEARTS, hearts + gained);
      since = hearts >= MAX_HEARTS ? null : since + gained * HEART_REGEN_MS;
      db.prepare('UPDATE users SET hearts = ?, hearts_at = ? WHERE id = ?').run(hearts, since, user.id);
    }
  }
  return { hearts, nextHeartAt: hearts < MAX_HEARTS && since ? since + HEART_REGEN_MS : null };
}

export function changeHearts(userId, delta) {
  const user = getUser(userId);
  const { hearts } = syncHearts(user);
  const next = Math.max(0, Math.min(MAX_HEARTS, hearts + delta));
  // Start the regen clock when dropping below max; clear it when full.
  const since = next >= MAX_HEARTS ? null : (getUser(userId).hearts_at ?? Date.now());
  db.prepare('UPDATE users SET hearts = ?, hearts_at = ? WHERE id = ?').run(next, since, userId);
  return syncHearts(getUser(userId));
}

/** Adds XP (total + today's) and updates the daily streak. Returns the updated user row. */
export function recordActivity(userId, xp) {
  const user = getUser(userId);
  const day = dayString();
  let streak = user.streak;
  if (user.last_active_day !== day) {
    streak = user.last_active_day === dayString(-1) ? streak + 1 : 1;
  }
  db.prepare('UPDATE users SET xp = xp + ?, streak = ?, last_active_day = ? WHERE id = ?').run(xp, streak, day, userId);
  db.prepare(`
    INSERT INTO daily_xp (user_id, day, xp) VALUES (?, ?, ?)
    ON CONFLICT (user_id, day) DO UPDATE SET xp = xp + excluded.xp
  `).run(userId, day, xp);
  return getUser(userId);
}

export function xpOn(userId, day) {
  return db.prepare('SELECT xp FROM daily_xp WHERE user_id = ? AND day = ?').get(userId, day)?.xp ?? 0;
}

export function publicUser(u) {
  // A streak only counts if the user was active today or yesterday.
  const alive = u.last_active_day === dayString() || u.last_active_day === dayString(-1);
  const { hearts, nextHeartAt } = syncHearts(u);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    level: u.level,
    xp: u.xp,
    streak: alive ? u.streak : 0,
    activeToday: u.last_active_day === dayString(),
    hearts,
    maxHearts: MAX_HEARTS,
    nextHeartAt,
    dailyGoal: u.daily_goal,
    xpToday: xpOn(u.id, dayString()),
  };
}
