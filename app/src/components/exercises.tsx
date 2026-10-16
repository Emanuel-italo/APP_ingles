import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Exercise, ScoreResult } from '@/lib/api';
import { api } from '@/lib/api';
import { speak, useRecorder } from '@/lib/voice';
import { MicButton } from '@/components/MicButton';
import { Button, ErrorText, Icon } from '@/components/ui';
import { colors, fonts, radius, type } from '@/lib/theme';

export const normalize = (s: string) =>
  s.toLowerCase().replace(/[’`]/g, "'").replace(/[.,!?¿¡]/g, '').split(/\s+/).filter(Boolean).join(' ');

const shuffled = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

/** Value reported by option/build exercises while the learner is answering. */
export type Draft = string | null;

export function instructionFor(ex: Exercise) {
  switch (ex.type) {
    case 'word': return 'Selecione a tradução';
    case 'choose': return 'Qual é a tradução correta?';
    case 'build_en': return 'Escreva em inglês';
    case 'build_pt': return 'Traduza para o português';
    case 'listen': return 'Monte o que você ouvir';
    case 'match': return 'Relacione os pares';
    case 'fill': return 'Complete a frase';
    case 'speak': return 'Leia em voz alta';
  }
}

export function checkDraft(ex: Exercise, draft: string): boolean {
  if (ex.type === 'build_en' || ex.type === 'build_pt' || ex.type === 'listen') {
    return ex.accepted.includes(normalize(draft));
  }
  if ('answer' in ex) return draft === ex.answer;
  return false;
}

function SpeakerButton({ text, size = 'md', slow }: { text: string; size?: 'md' | 'lg'; slow?: boolean }) {
  const dim = size === 'lg' ? 72 : 44;
  return (
    <Pressable
      onPress={() => speak(text, { slow })}
      style={({ pressed }) => [
        styles.speaker,
        { width: dim, height: dim, borderRadius: size === 'lg' ? 20 : 12 },
        slow && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
        pressed && { opacity: 0.8 },
      ]}
      accessibilityLabel={slow ? 'Ouvir devagar' : 'Ouvir'}
    >
      <Icon name={slow ? 'hourglass-outline' : 'volume-high'} size={size === 'lg' ? 30 : 20} color={slow ? colors.accent : '#fff'} />
    </Pressable>
  );
}

// ---------- Multiple choice: word, choose, fill ----------

export function OptionsExercise({
  ex,
  locked,
  onDraft,
}: {
  ex: Extract<Exercise, { type: 'word' | 'choose' | 'fill' }>;
  locked: boolean;
  onDraft: (d: Draft) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (ex.type === 'word') speak(ex.audio);
  }, [ex]);

  const choose = (o: string) => {
    if (locked) return;
    setSelected(o);
    onDraft(o);
    if (ex.type === 'word') speak(o, {});
  };

  return (
    <View style={{ gap: 24 }}>
      {ex.type === 'word' ? (
        <View style={styles.promptRow}>
          <SpeakerButton text={ex.audio} />
          <Text style={styles.promptBig}>{ex.prompt}</Text>
        </View>
      ) : null}
      {ex.type === 'choose' ? <Text style={styles.promptSentence}>{ex.prompt}</Text> : null}
      {ex.type === 'fill' ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.promptSentence}>
            {ex.before ? `${ex.before} ` : ''}
            <Text style={styles.blank}>{selected ?? '   '}</Text>
            {ex.after ? ` ${ex.after}` : ''}
          </Text>
          <Text style={type.small}>{ex.translation}</Text>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        {ex.options.map((o, i) => {
          const active = selected === o;
          return (
            <Pressable
              key={o}
              onPress={() => choose(o)}
              style={[styles.option, active && styles.optionActive]}
            >
              <View style={[styles.optionKey, active && { borderColor: colors.accent }]}>
                <Text style={[styles.optionKeyText, active && { color: colors.accent }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.optionText, active && { color: colors.accentInk }]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------- Word bank: build_en, build_pt, listen ----------

export function BuildExercise({
  ex,
  locked,
  onDraft,
}: {
  ex: Extract<Exercise, { type: 'build_en' | 'build_pt' | 'listen' }>;
  locked: boolean;
  onDraft: (d: Draft) => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    if (ex.type === 'listen' || ex.type === 'build_pt') speak(ex.audio);
  }, [ex]);

  const update = (next: number[]) => {
    setPicked(next);
    onDraft(next.length ? next.map((i) => ex.bank[i]).join(' ') : null);
  };

  return (
    <View style={{ gap: 24 }}>
      {ex.type === 'listen' ? (
        <View style={styles.listenRow}>
          <SpeakerButton text={ex.audio} size="lg" />
          <SpeakerButton text={ex.audio} slow />
        </View>
      ) : (
        <View style={styles.promptRow}>
          {ex.type === 'build_pt' ? <SpeakerButton text={ex.audio} /> : null}
          <Text style={[styles.promptSentence, { flex: 1 }]}>{ex.prompt}</Text>
        </View>
      )}

      <View style={styles.answerArea}>
        {picked.map((bankIndex, pos) => (
          <Pressable
            key={`${bankIndex}-${pos}`}
            onPress={() => !locked && update(picked.filter((_, p) => p !== pos))}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{ex.bank[bankIndex]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.bank}>
        {ex.bank.map((word, i) => {
          const used = picked.includes(i);
          return (
            <Pressable
              key={i}
              disabled={used || locked}
              onPress={() => update([...picked, i])}
              style={[styles.chip, used && styles.chipUsed]}
            >
              <Text style={[styles.chipText, used && { color: 'transparent' }]}>{word}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------- Match pairs ----------

export function MatchExercise({
  ex,
  onDone,
  onMiss,
}: {
  ex: Extract<Exercise, { type: 'match' }>;
  onDone: () => void;
  onMiss: () => void;
}) {
  const [left] = useState(() => shuffled(ex.pairs.map((p) => p.en)));
  const [right] = useState(() => shuffled(ex.pairs.map((p) => p.pt)));
  const [selLeft, setSelLeft] = useState<string | null>(null);
  const [selRight, setSelRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);

  const tryPair = (l: string | null, r: string | null) => {
    if (!l || !r) return;
    if (ex.pairs.some((p) => p.en === l && p.pt === r)) {
      const next = [...matched, l, r];
      setMatched(next);
      setSelLeft(null);
      setSelRight(null);
      if (next.length === ex.pairs.length * 2) setTimeout(onDone, 250);
    } else {
      onMiss();
      setWrong([l, r]);
      setTimeout(() => { setWrong([]); setSelLeft(null); setSelRight(null); }, 600);
    }
  };

  const tile = (value: string, side: 'l' | 'r') => {
    const isMatched = matched.includes(value);
    const isSel = side === 'l' ? selLeft === value : selRight === value;
    const isWrong = wrong.includes(value);
    return (
      <Pressable
        key={value}
        disabled={isMatched || wrong.length > 0}
        onPress={() => {
          if (side === 'l') {
            setSelLeft(value);
            speak(value);
            tryPair(value, selRight);
          } else {
            setSelRight(value);
            tryPair(selLeft, value);
          }
        }}
        style={[
          styles.matchTile,
          isSel && styles.optionActive,
          isWrong && { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
          isMatched && { opacity: 0.35, backgroundColor: colors.sunken },
        ]}
      >
        <Text style={[styles.optionText, isSel && { color: colors.accentInk }, isWrong && { color: colors.danger }]}>{value}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.matchGrid}>
      <View style={styles.matchCol}>{left.map((v) => tile(v, 'l'))}</View>
      <View style={styles.matchCol}>{right.map((v) => tile(v, 'r'))}</View>
    </View>
  );
}

// ---------- Speak ----------

export function SpeakExercise({
  ex,
  locked,
  onResult,
  onSkip,
}: {
  ex: Extract<Exercise, { type: 'speak' }>;
  locked: boolean;
  onResult: (ok: boolean) => void;
  onSkip: () => void;
}) {
  const recorder = useRecorder();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { speak(ex.audio); }, [ex]);

  const toggle = async () => {
    if (recorder.isRecording) {
      const uri = await recorder.stop();
      if (!uri) return;
      setBusy(true);
      setError('');
      try {
        const r = await api.score(ex.answer, { uri });
        setResult(r);
        onResult(r.score >= 60);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    } else {
      setResult(null);
      await recorder.start();
    }
  };

  return (
    <View style={{ gap: 24 }}>
      <View style={styles.promptRow}>
        <SpeakerButton text={ex.audio} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.promptSentence}>
            {result
              ? result.words.map((w, i) => (
                  <Text key={i} style={{ color: w.ok ? colors.success : colors.danger }}>{w.word} </Text>
                ))
              : ex.prompt}
          </Text>
          <Text style={type.small}>{ex.translation}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        <MicButton recording={recorder.isRecording} busy={busy} onPress={locked ? () => {} : toggle} />
      </View>
      <ErrorText>{error}</ErrorText>
      {!locked ? <Button title="Não posso falar agora" variant="ghost" onPress={onSkip} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  promptBig: { fontFamily: fonts.display, fontSize: 32, color: colors.ink },
  promptSentence: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32, color: colors.ink },
  blank: { color: colors.accent, textDecorationLine: 'underline' },
  speaker: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  listenRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 12 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface,
  },
  optionActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionKey: { width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  optionKeyText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  optionText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, flexShrink: 1 },
  answerArea: {
    minHeight: 112, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', gap: 8,
    paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line,
  },
  bank: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.sm,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line,
  },
  chipUsed: { backgroundColor: colors.sunken, borderColor: colors.sunken },
  chipText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  matchGrid: { flexDirection: 'row', gap: 12 },
  matchCol: { flex: 1, gap: 10 },
  matchTile: {
    minHeight: 56, alignItems: 'center', justifyContent: 'center', padding: 10,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface,
  },
});
