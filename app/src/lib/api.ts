import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type Level = 'beginner' | 'intermediate' | 'advanced';

export type User = {
  id: number;
  name: string;
  email: string;
  level: Level;
  xp: number;
  streak: number;
  activeToday: boolean;
  hearts: number;
  maxHearts: number;
  nextHeartAt: number | null;
  dailyGoal: number;
  xpToday: number;
};

export type LessonSummary = {
  id: string;
  unit: string;
  title: string;
  icon: string;
  level: Level;
  phraseCount: number;
  completed: boolean;
  bestScore: number | null;
};

export type Phrase = { en: string; pt: string };
export type Lesson = Omit<LessonSummary, 'phraseCount' | 'completed' | 'bestScore'> & { phrases: Phrase[] };

export type ScenarioTask = { pt: string; en: string };

export type Scenario = {
  id: string;
  category: string | null;
  title: string;
  icon: string;
  description: string;
  partner: string;
  setting_pt: string;
  goal_pt: string;
  goal_en: string;
  opener: string;
  opener_pt?: string;
  tasks: ScenarioTask[];
  attempts: number;
  completed: boolean;
};

export type ConversationSummary = {
  id: number;
  scenarioId: string;
  title?: string;
  icon?: string;
  createdAt: string;
  completed: boolean;
  tasksDone: number;
  tasksTotal: number;
  messageCount: number;
};

export type Feedback = {
  ok: boolean;
  corrected: string;
  corrected_pt?: string;
  explanation_pt: string;
  tip?: string;
  vocab?: { en: string; pt: string }[];
};

export type SavedItem = {
  id: number;
  kind: 'phrase' | 'word';
  en: string;
  pt: string | null;
  note: string | null;
  source: 'correction' | 'manual';
  strength: number;
  createdAt: string;
};

export type SendResult = {
  feedback: Feedback | null;
  reply: string;
  replyPt: string | null;
  replyMessageId: number;
  tasksCompleted: number[];
  tasksDone: number[];
  scenarioCompleted: boolean;
  savedCount: number;
  xpGained: number;
  user: User;
};
export type ChatMessage = {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  feedback?: Feedback | null;
  /** Portuguese translation of a tutor message. */
  translation?: string | null;
};

export type WritingHelp = { english: string; meaning_pt: string; note_pt: string; ok: boolean };
export type ReplySuggestion = { en: string; pt: string };

export type SkillStatus = 'done' | 'current' | 'locked';
export type PathSkill = { id: string; title: string; icon: string; status: SkillStatus; times: number };
export type PathUnit = { id: string; index: number; title: string; description: string; skills: PathSkill[] };

export type Exercise =
  | { id: string; type: 'word'; prompt: string; audio: string; options: string[]; answer: string }
  | { id: string; type: 'choose'; prompt: string; audio: string; options: string[]; answer: string }
  | { id: string; type: 'build_en' | 'build_pt'; prompt: string; audio: string; bank: string[]; answer: string; accepted: string[] }
  | { id: string; type: 'listen'; audio: string; bank: string[]; answer: string; accepted: string[] }
  | { id: string; type: 'match'; pairs: { en: string; pt: string }[] }
  | { id: string; type: 'fill'; translation: string; audio: string; before: string; after: string; options: string[]; answer: string }
  | { id: string; type: 'speak'; prompt: string; translation: string; audio: string; answer: string };

export type SessionData = { skill: { id: string; title: string; icon: string; unitTitle: string }; exercises: Exercise[] };

export type Stats = {
  lessonsCompleted: number;
  totalLessons: number;
  skillsCompleted: number;
  totalSkills: number;
  conversations: number;
  savedItems: number;
  week: { day: string; xp: number }[];
};

export type ScoreResult = { score: number; heard: string; words: { word: string; ok: boolean }[] };

/**
 * Resolves the API base URL:
 * 1. EXPO_PUBLIC_API_URL if set (use this in production).
 * 2. On a phone/emulator in development, the same host that serves the JS bundle, port 3333.
 * 3. app.json extra.apiUrl (localhost) otherwise.
 */
function resolveBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const fallback = (Constants.expoConfig?.extra?.apiUrl as string) || 'http://localhost:3333';
  if (Platform.OS === 'web') return fallback;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:3333` : fallback;
}

export const BASE_URL = resolveBaseUrl();

let authToken: string | null = null;
export const setAuthToken = (t: string | null) => { authToken = t; };

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(`Não foi possível conectar ao servidor (${BASE_URL}). Ele está rodando?`, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Erro ${res.status}`, res.status);
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

/** Builds a FormData file part from a recorder URI on web (blob:) or native (file://). */
async function audioPart(form: FormData, uri: string) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
    form.append('audio', blob, `audio.${ext}`);
  } else {
    form.append('audio', { uri, name: 'audio.m4a', type: 'audio/m4a' } as unknown as Blob);
  }
}

export const api = {
  health: () => request<{ ok: boolean; ai: 'groq' | 'demo' }>('/health'),

  register: (body: { name: string; email: string; password: string; level: Level }) =>
    request<{ token: string; user: User }>('/auth/register', { method: 'POST', body: json(body) }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: json(body) }),
  me: () =>
    request<{ user: User; stats: Stats }>('/me'),
  updateMe: (body: Partial<Pick<User, 'name' | 'level' | 'dailyGoal'>>) =>
    request<{ user: User }>('/me', { method: 'PATCH', body: json(body) }),

  path: () => request<{ user: User; units: PathUnit[] }>('/path'),
  session: (skillId: string) => request<SessionData>(`/path/skills/${skillId}/session`),
  loseHeart: () => request<{ hearts: number; nextHeartAt: number | null }>('/path/hearts/lose', { method: 'POST' }),
  completeSkill: (skillId: string, mistakes: number) =>
    request<{ user: User; xpGained: number; perfect: boolean }>(`/path/skills/${skillId}/complete`, { method: 'POST', body: json({ mistakes }) }),
  leaderboard: () => request<{ entries: { rank: number; id: number; name: string; xp: number; me: boolean }[] }>('/leaderboard'),

  lessons: () => request<{ lessons: LessonSummary[] }>('/lessons'),
  lesson: (id: string) => request<{ lesson: Lesson }>(`/lessons/${id}`),
  completeLesson: (id: string, score: number) =>
    request<{ user: User; xpGained: number; heartRestored: boolean }>(`/lessons/${id}/complete`, { method: 'POST', body: json({ score }) }),

  async transcribe(uri: string) {
    const form = new FormData();
    await audioPart(form, uri);
    return request<{ text: string }>('/speech/transcribe', { method: 'POST', body: form });
  },
  async score(target: string, input: { uri?: string; text?: string }) {
    const form = new FormData();
    form.append('target', target);
    if (input.uri) await audioPart(form, input.uri);
    if (input.text) form.append('text', input.text);
    return request<ScoreResult>('/speech/score', { method: 'POST', body: form });
  },

  scenarios: () => request<{ categories: string[]; scenarios: Scenario[] }>('/scenarios'),
  scenario: (id: string) => request<{ scenario: Scenario; openConversationId: number | null }>(`/scenarios/${id}`),
  startConversation: (scenarioId: string) =>
    request<{ conversationId: number }>('/conversations', { method: 'POST', body: json({ scenarioId }) }),
  conversations: () => request<{ conversations: ConversationSummary[] }>('/conversations'),
  conversation: (id: number) =>
    request<{ conversationId: number; scenario: Scenario | null; tasksDone: number[]; completed: boolean; messages: ChatMessage[] }>(`/conversations/${id}`),
  sendMessage: (id: number, text: string) =>
    request<SendResult>(`/conversations/${id}/messages`, { method: 'POST', body: json({ text }) }),
  translateMessage: (conversationId: number, messageId: number) =>
    request<{ translation: string }>(`/conversations/${conversationId}/messages/${messageId}/translate`, { method: 'POST' }),
  assist: (conversationId: number, text: string) =>
    request<WritingHelp>(`/conversations/${conversationId}/assist`, { method: 'POST', body: json({ text }) }),
  suggestions: (conversationId: number) =>
    request<{ suggestions: ReplySuggestion[] }>(`/conversations/${conversationId}/suggestions`),

  saved: () => request<{ items: SavedItem[] }>('/saved'),
  save: (body: { kind: SavedItem['kind']; en: string; pt?: string | null; note?: string | null }) =>
    request<{ item: SavedItem }>('/saved', { method: 'POST', body: json(body) }),
  deleteSaved: (id: number) => request<{ ok: true }>(`/saved/${id}`, { method: 'DELETE' }),
  reviewSaved: (id: number, known: boolean) =>
    request<{ item: SavedItem; user: User }>(`/saved/${id}/review`, { method: 'POST', body: json({ known }) }),
};
