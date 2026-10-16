import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type SavedItem } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { speak, stopSpeaking } from '@/lib/voice';
import { Button, Center, ErrorText, Icon, Loading, ProgressBar } from '@/components/ui';
import { colors, fonts, radius, type } from '@/lib/theme';

const ROUND = 10;

/** Flashcards over saved items: see the Portuguese, recall the English, self-grade. */
export default function PracticeCards() {
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();
  const [deck, setDeck] = useState<SavedItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    api.saved()
      .then(({ items }) => {
        // Weakest items first, then the oldest-reviewed; a little shuffle within equal strength.
        const sorted = [...items].sort((a, b) => a.strength - b.strength || Math.random() - 0.5);
        setDeck(sorted.slice(0, ROUND));
      })
      .catch((e) => setError(e.message));
    return () => { stopSpeaking(); };
  }, []);

  if (!deck) return error ? <Center><ErrorText>{error}</ErrorText></Center> : <Loading />;

  const close = () => router.back();

  if (deck.length === 0) {
    return (
      <Center>
        <Text style={type.title}>Nada salvo ainda</Text>
        <Button title="Voltar" onPress={close} style={{ marginTop: 20 }} />
      </Center>
    );
  }

  const done = index >= deck.length;
  const card = deck[index];

  const grade = async (ok: boolean) => {
    if (ok) setKnown((k) => k + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
    try {
      const r = await api.reviewSaved(card.id, ok);
      setUser(r.user);
    } catch {
      // Grading is best-effort; the session continues offline.
    }
  };

  const reveal = () => {
    setRevealed(true);
    speak(card.en);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.top}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Fechar">
          <Icon name="close" size={26} color={colors.muted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ProgressBar value={index / deck.length} height={8} />
        </View>
        <Text style={styles.counter}>{Math.min(index + 1, deck.length)}/{deck.length}</Text>
      </View>

      {done ? (
        <View style={styles.result}>
          <View style={styles.resultIcon}><Icon name="ribbon-outline" size={36} color={colors.success} /></View>
          <Text style={type.title}>Revisão concluída</Text>
          <Text style={type.body}>Você lembrou {known} de {deck.length}.</Text>
          <Button title="Voltar para Revisar" onPress={close} style={{ alignSelf: 'stretch', marginTop: 12 }} />
        </View>
      ) : (
        <>
          <View style={styles.body}>
            <Text style={type.overline}>{card.kind === 'word' ? 'Palavra' : 'Frase'} · Como se diz em inglês?</Text>
            <View style={styles.card}>
              <Text style={styles.prompt}>{card.pt ?? card.en}</Text>
              {revealed ? (
                <View style={styles.answer}>
                  <View style={styles.divider} />
                  <View style={styles.answerRow}>
                    <Text style={styles.answerText}>{card.en}</Text>
                    <Pressable onPress={() => speak(card.en)} hitSlop={8} accessibilityLabel="Ouvir">
                      <Icon name="volume-high-outline" size={22} color={colors.accent} />
                    </Pressable>
                  </View>
                  {card.note ? <Text style={styles.note}>{card.note}</Text> : null}
                </View>
              ) : (
                <Text style={[type.small, { textAlign: 'center' }]}>Tente dizer em voz alta antes de ver a resposta.</Text>
              )}
            </View>
          </View>

          <View style={styles.footer}>
            {revealed ? (
              <View style={styles.gradeRow}>
                <Button title="Ainda não sei" variant="secondary" onPress={() => grade(false)} style={{ flex: 1 }} />
                <Button title="Já sei" variant="success" onPress={() => grade(true)} style={{ flex: 1 }} />
              </View>
            ) : (
              <Button title="Mostrar resposta" onPress={reveal} />
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, maxWidth: 620, width: '100%', alignSelf: 'center' },
  counter: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  body: { flex: 1, padding: 20, gap: 14, justifyContent: 'center', maxWidth: 620, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 24, gap: 16, minHeight: 220, justifyContent: 'center' },
  prompt: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34, color: colors.ink, textAlign: 'center' },
  answer: { gap: 12 },
  divider: { height: 1, backgroundColor: colors.line },
  answerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  answerText: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28, color: colors.accentInk, textAlign: 'center', flexShrink: 1 },
  note: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink2, lineHeight: 20, textAlign: 'center' },
  footer: { paddingHorizontal: 20, maxWidth: 620, width: '100%', alignSelf: 'center' },
  gradeRow: { flexDirection: 'row', gap: 10 },
  result: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  resultIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
