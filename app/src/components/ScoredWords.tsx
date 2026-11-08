import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import type { ScoreResult } from '@/lib/api';
import { speak } from '@/lib/voice';
import { Icon } from '@/components/ui';
import { colors, fonts, radius } from '@/lib/theme';

/** Strips punctuation so the voice says just the word ("menu?" → "menu"). */
const clean = (w: string) => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');

const sayWord = (w: string) => speak(clean(w), { slow: true });

/** The scored sentence: green/red words, each one tappable to hear it on its own. */
export function ScoredSentence({ words, style }: { words: ScoreResult['words']; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={style}>
      {words.map((w, i) => (
        <Text
          key={i}
          onPress={() => sayWord(w.word)}
          suppressHighlighting
          style={[styles.word, { color: w.ok ? colors.success : colors.danger }, !w.ok && styles.wrong]}
        >
          {w.word}
          {i < words.length - 1 ? ' ' : ''}
        </Text>
      ))}
    </Text>
  );
}

/** One button per missed word, to practice it in isolation. */
export function MissedWords({ words }: { words: ScoreResult['words'] }) {
  const missed = [...new Set(words.filter((w) => !w.ok).map((w) => clean(w.word)).filter(Boolean))];
  if (missed.length === 0) return null;
  return (
    <View style={styles.missed}>
      <Text style={styles.missedLabel}>Treine estas palavras</Text>
      <View style={styles.chips}>
        {missed.map((w) => (
          <Pressable
            key={w}
            onPress={() => speak(w, { slow: true })}
            style={({ pressed }) => [styles.chip, pressed && { backgroundColor: colors.dangerSoft }]}
            accessibilityLabel={`Ouvir ${w}`}
          >
            <Icon name="volume-high-outline" size={15} color={colors.danger} />
            <Text style={styles.chipText}>{w}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>Dica: toque em qualquer palavra da frase para ouvi-la.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  word: { cursor: 'pointer' } as TextStyle,
  wrong: { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: colors.danger },
  missed: { gap: 8 },
  missedLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface,
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
