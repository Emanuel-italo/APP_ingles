// Builds a practice session (~10 exercises) for one skill of the path.

import { units } from './course.js';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr, n) => shuffle(arr).slice(0, n);

/** Splits a sentence into word-bank tokens (punctuation removed, contractions kept). */
export const tokenize = (s) => s.replace(/[.,!?¿¡]/g, '').split(/\s+/).filter(Boolean);
// Lowercases a token for the distractor pool but keeps the pronoun "I" (and I'm, I'll…) capitalized.
const poolToken = (t) => t.toLowerCase().replace(/^i(?=$|')/, "I");

export const normalize = (s) => tokenize(s.toLowerCase().replace(/[’`]/g, "'")).join(' ');

function distractors(answerTokens, pool, n) {
  const used = new Set(answerTokens.map((t) => t.toLowerCase()));
  const candidates = [...new Set(pool.filter((t) => !used.has(t.toLowerCase())))];
  return pick(candidates, n);
}

let counter = 0;
const id = () => `ex${++counter}`;

export function buildSession(skillId) {
  const unit = units.find((u) => u.skills.some((s) => s.id === skillId));
  const skill = unit.skills.find((s) => s.id === skillId);
  const unitSentences = unit.skills.flatMap((s) => s.sentences);
  // Only the sentence-initial word is lowercased, so proper nouns (Brazil, Lucas) keep their capital.
  const enPool = unitSentences.flatMap((s) => tokenize(s.en).map((t, i) => (i === 0 ? poolToken(t) : t)));
  const ptPool = unitSentences.flatMap((s) => tokenize(s.pt)).map((t) => t.toLowerCase());
  const accepted = (s) => [s.en, ...(s.alt ?? [])].map(normalize);

  const sentences = shuffle(skill.sentences);
  const sent = (i) => sentences[i % sentences.length];
  const exercises = [];

  // 1. Vocabulary warm-up: pick the translation of a word.
  for (const [en, pt] of pick(skill.words, 2)) {
    const wrong = pick(skill.words.filter(([, p]) => p !== pt).map(([, p]) => p), 3);
    exercises.push({ id: id(), type: 'word', prompt: en, audio: en, options: shuffle([pt, ...wrong]), answer: pt });
  }

  // 2. Build the English sentence from Portuguese.
  for (const s of [sent(0), sent(1)]) {
    const tokens = tokenize(s.en);
    exercises.push({
      id: id(), type: 'build_en', prompt: s.pt, audio: s.en,
      bank: shuffle([...tokens, ...distractors(tokens, enPool, 4)]),
      answer: s.en, accepted: accepted(s),
    });
  }

  // 3. Pick the correct English translation.
  {
    const s = sent(2);
    const others = pick(skill.sentences.filter((x) => x !== s), 2).map((x) => x.en);
    exercises.push({ id: id(), type: 'choose', prompt: s.pt, options: shuffle([s.en, ...others]), answer: s.en, audio: s.en });
  }

  // 4. Match word pairs.
  exercises.push({ id: id(), type: 'match', pairs: pick(skill.words, 5).map(([en, pt]) => ({ en, pt })) });

  // 5. Build the Portuguese sentence from English.
  {
    const s = sent(3);
    const tokens = tokenize(s.pt);
    exercises.push({
      id: id(), type: 'build_pt', prompt: s.en, audio: s.en,
      bank: shuffle([...tokens, ...distractors(tokens, ptPool, 4)]),
      answer: s.pt, accepted: [normalize(s.pt)],
    });
  }

  // 6. Listen and type what you hear (word bank).
  {
    const s = sent(4);
    const tokens = tokenize(s.en);
    exercises.push({
      id: id(), type: 'listen', audio: s.en,
      bank: shuffle([...tokens, ...distractors(tokens, enPool, 3)]),
      answer: s.en, accepted: accepted(s),
    });
  }

  // 7. Fill in the blank.
  {
    const s = sent(5);
    const tokens = tokenize(s.en);
    const candidates = tokens.map((t, i) => [t, i]).filter(([t]) => t.length > 2);
    const [word, index] = candidates[Math.floor(Math.random() * candidates.length)] ?? [tokens[0], 0];
    const wrong = distractors([word], enPool.filter((t) => t.length > 2), 2);
    exercises.push({
      id: id(), type: 'fill', translation: s.pt, audio: s.en,
      before: tokens.slice(0, index).join(' '), after: tokens.slice(index + 1).join(' '),
      options: shuffle([word.toLowerCase(), ...wrong]), answer: word.toLowerCase(),
    });
  }

  // 8. Speak the sentence aloud.
  {
    const s = sent(1);
    exercises.push({ id: id(), type: 'speak', prompt: s.en, translation: s.pt, audio: s.en, answer: s.en });
  }

  return { skill: { id: skill.id, title: skill.title, icon: skill.icon, unitTitle: unit.title }, exercises };
}
