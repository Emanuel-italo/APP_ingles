// Scores how closely a transcription matches the target phrase, word by word.
// Uses a word-level LCS so missing/extra words don't shift the whole alignment.

const NUMBER_WORDS = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
  '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', '12': 'twelve',
};

function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => NUMBER_WORDS[w] ?? w);
}

export function scorePronunciation(target, heard) {
  const displayWords = target.split(/\s+/).filter(Boolean);
  const t = normalizeWords(target);
  const h = normalizeWords(heard);

  // LCS table over words.
  const dp = Array.from({ length: t.length + 1 }, () => new Array(h.length + 1).fill(0));
  for (let i = t.length - 1; i >= 0; i--) {
    for (let j = h.length - 1; j >= 0; j--) {
      dp[i][j] = t[i] === h[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matched = new Array(t.length).fill(false);
  for (let i = 0, j = 0; i < t.length && j < h.length; ) {
    if (t[i] === h[j]) { matched[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }

  const hits = matched.filter(Boolean).length;
  const extra = Math.max(0, h.length - hits);
  const raw = t.length ? hits / (t.length + extra * 0.5) : 0;
  const score = Math.round(Math.min(1, raw) * 100);

  // normalizeWords and the display split line up 1:1 unless punctuation-only tokens exist.
  const words = displayWords.length === t.length
    ? displayWords.map((w, i) => ({ word: w, ok: matched[i] }))
    : t.map((w, i) => ({ word: w, ok: matched[i] }));

  return { score, heard, words };
}
