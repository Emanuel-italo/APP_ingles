import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { api, type Lesson, type ScoreResult } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { speak, useRecorder } from '@/lib/voice';
import { MicButton } from '@/components/MicButton';
import { Button, Center, ErrorText, Icon, Input, Loading, ProgressBar } from '@/components/ui';
import { colors, fonts, radius, type } from '@/lib/theme';

const PASS = 70;

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { setUser } = useAuth();
  const recorder = useRecorder();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');
  const [finished, setFinished] = useState<{ avg: number; xp: number } | null>(null);

  useEffect(() => {
    api.lesson(id).then((r) => setLesson(r.lesson)).catch((e) => setError(e.message));
  }, [id]);

  const phrase = lesson?.phrases[index];

  useEffect(() => {
    if (phrase) speak(phrase.en);
  }, [phrase]);

  const evaluate = async (input: { uri?: string; text?: string }) => {
    if (!phrase) return;
    setBusy(true);
    setError('');
    try {
      setResult(await api.score(phrase.en, input));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = async () => {
    if (recorder.isRecording) {
      const uri = await recorder.stop();
      if (uri) await evaluate({ uri });
    } else {
      setResult(null);
      await recorder.start();
    }
  };

  const next = async () => {
    if (!lesson) return;
    const all = [...scores, result?.score ?? 0];
    setScores(all);
    setResult(null);
    setTyped('');
    setError('');
    if (index + 1 < lesson.phrases.length) {
      setIndex(index + 1);
      return;
    }
    const avg = Math.round(all.reduce((a, b) => a + b, 0) / all.length);
    try {
      const r = await api.completeLesson(lesson.id, avg);
      setUser(r.user);
      setFinished({ avg, xp: r.xpGained });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!lesson) return error ? <Center><ErrorText>{error}</ErrorText></Center> : <Loading />;

  if (finished) {
    const good = finished.avg >= PASS;
    return (
      <Center>
        <Stack.Screen options={{ title: lesson.title }} />
        <View style={styles.doneIcon}>
          <Icon name={good ? 'ribbon-outline' : 'barbell-outline'} size={40} color={good ? colors.success : colors.accent} />
        </View>
        <Text style={[type.title, { marginTop: 16 }]}>{good ? 'Ótima pronúncia' : 'Bom treino'}</Text>
        <Text style={[type.body, { marginTop: 4 }]}>Média da lição: {finished.avg}%</Text>
        <View style={styles.rewards}>
          <View style={styles.reward}><Icon name="flash" size={16} color={colors.accent} /><Text style={styles.rewardText}>+{finished.xp} XP</Text></View>
          <View style={styles.reward}><Icon name="heart" size={16} color={colors.heart} /><Text style={styles.rewardText}>+1 vida</Text></View>
        </View>
        <Button title="Voltar" onPress={() => router.back()} style={{ marginTop: 28, alignSelf: 'stretch', maxWidth: 420, width: '100%' }} />
      </Center>
    );
  }

  const progress = (index + (result ? 1 : 0)) / lesson.phrases.length;
  const passed = result && result.score >= PASS;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: lesson.title }} />
      <View style={{ gap: 8 }}>
        <ProgressBar value={progress} />
        <Text style={type.small}>Frase {index + 1} de {lesson.phrases.length}</Text>
      </View>

      <View style={styles.phraseCard}>
        <Text style={type.overline}>Ouça e repita</Text>
        <Text style={styles.phrase}>
          {result
            ? result.words.map((w, i) => (
                <Text key={i} style={{ color: w.ok ? colors.success : colors.danger }}>{w.word} </Text>
              ))
            : phrase!.en}
        </Text>
        <Text style={styles.translation}>{phrase!.pt}</Text>
        <View style={styles.listenRow}>
          <Pressable style={styles.listen} onPress={() => speak(phrase!.en)}>
            <Icon name="volume-high-outline" size={16} color={colors.ink} />
            <Text style={styles.listenText}>Ouvir</Text>
          </Pressable>
          <Pressable style={styles.listen} onPress={() => speak(phrase!.en, { slow: true })}>
            <Icon name="hourglass-outline" size={16} color={colors.ink} />
            <Text style={styles.listenText}>Devagar</Text>
          </Pressable>
        </View>
      </View>

      {result ? (
        <View style={[styles.result, { backgroundColor: passed ? colors.successSoft : colors.warningSoft }]}>
          <Text style={[styles.score, { color: passed ? colors.success : colors.warning }]}>{result.score}%</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.resultText}>
              {passed ? 'Pronúncia clara.' : 'Quase lá. Repita as palavras em vermelho.'}
            </Text>
            <Text style={type.small}>Ouvimos: “{result.heard}”</Text>
          </View>
        </View>
      ) : null}

      <ErrorText>{error}</ErrorText>

      <View style={{ alignItems: 'center', marginVertical: 4 }}>
        <MicButton recording={recorder.isRecording} busy={busy} onPress={toggleMic} />
      </View>

      {!result ? (
        <Input
          placeholder="Sem microfone? Digite a frase e pressione Enter"
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={() => typed.trim() && evaluate({ text: typed })}
        />
      ) : null}

      <View style={{ gap: 10 }}>
        {result ? <Button title={index + 1 < lesson.phrases.length ? 'Próxima frase' : 'Concluir lição'} onPress={next} /> : null}
        {result && !passed ? <Button title="Tentar de novo" variant="secondary" onPress={() => setResult(null)} /> : null}
        {!result ? <Button title="Pular frase" variant="ghost" onPress={next} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 20, maxWidth: 620, width: '100%', alignSelf: 'center' },
  phraseCard: {
    gap: 12, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line,
  },
  phrase: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, textAlign: 'center', lineHeight: 36 },
  translation: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, textAlign: 'center' },
  listenRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  listen: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg,
  },
  listenText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: radius.lg },
  score: { fontFamily: fonts.display, fontSize: 36 },
  resultText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  doneIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  rewards: { flexDirection: 'row', gap: 10, marginTop: 20 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  rewardText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
});
