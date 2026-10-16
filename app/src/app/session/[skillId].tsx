import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError, type Exercise, type SessionData } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { speak, stopSpeaking } from '@/lib/voice';
import { Button, ErrorText, Icon, Loading, ProgressBar } from '@/components/ui';
import {
  BuildExercise,
  checkDraft,
  instructionFor,
  MatchExercise,
  OptionsExercise,
  SpeakExercise,
  type Draft,
} from '@/components/exercises';
import { colors, fonts, radius, type } from '@/lib/theme';

type Phase = 'answer' | 'correct' | 'wrong';
type Item = Exercise & { key: string };

const PRAISE = ['Correto', 'Muito bem', 'Exato', 'Perfeito', 'Isso mesmo'];

/** Text shown as "the right answer" after a mistake. */
function solutionOf(ex: Exercise) {
  if (ex.type === 'match') return '';
  if (ex.type === 'fill') return [ex.before, ex.answer, ex.after].filter(Boolean).join(' ');
  return ex.answer;
}

export default function SessionScreen() {
  const { skillId } = useLocalSearchParams<{ skillId: string }>();
  const { user, setUser } = useAuth();
  const insets = useSafeAreaInsets();
  const startedAt = useRef(Date.now());

  const [data, setData] = useState<SessionData | null>(null);
  const [queue, setQueue] = useState<Item[]>([]);
  const [pos, setPos] = useState(0);
  const [solved, setSolved] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hearts, setHearts] = useState(user?.hearts ?? 5);
  const [draft, setDraft] = useState<Draft>(null);
  const [phase, setPhase] = useState<Phase>('answer');
  const [error, setError] = useState('');
  const [noHearts, setNoHearts] = useState(false);
  const [result, setResult] = useState<{ xp: number; perfect: boolean; seconds: number } | null>(null);

  useEffect(() => {
    api.session(skillId)
      .then((d) => {
        setData(d);
        setQueue(d.exercises.map((e) => ({ ...e, key: e.id })));
      })
      .catch((e: ApiError) => {
        if (e.status === 403 && /vidas/.test(e.message)) setNoHearts(true);
        else setError(e.message);
      });
    return () => { stopSpeaking(); };
  }, [skillId]);

  const current = queue[pos];
  const total = data?.exercises.length ?? 1;

  const markWrong = useCallback(async () => {
    setMistakes((m) => m + 1);
    try {
      const r = await api.loseHeart();
      setHearts(r.hearts);
    } catch {
      setHearts((h) => Math.max(0, h - 1));
    }
  }, []);

  const resolve = useCallback(
    (ok: boolean) => {
      if (!current) return;
      setPhase(ok ? 'correct' : 'wrong');
      if (ok) {
        setSolved((s) => s + 1);
      } else {
        markWrong();
        // Retry the same exercise at the end of the session.
        setQueue((q) => [...q, { ...current, key: `${current.key}-r` }]);
      }
      if ('audio' in current && current.type !== 'word') speak(current.audio);
    },
    [current, markWrong],
  );

  const check = () => {
    if (!current || draft === null) return;
    resolve(checkDraft(current, draft));
  };

  const skip = () => {
    // Skipping a speaking exercise counts as done without XP penalty.
    setSolved((s) => s + 1);
    advance();
  };

  const finish = async () => {
    try {
      const r = await api.completeSkill(skillId, mistakes);
      setUser(r.user);
      setResult({ xp: r.xpGained, perfect: r.perfect, seconds: Math.round((Date.now() - startedAt.current) / 1000) });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  function advance() {
    stopSpeaking();
    setDraft(null);
    setPhase('answer');
    if (hearts <= 0) {
      setNoHearts(true);
      return;
    }
    if (pos + 1 >= queue.length) {
      finish();
      return;
    }
    setPos(pos + 1);
  }

  const onMatchMiss = useCallback(() => setMistakes((m) => m + 1), []);
  const onMatchDone = useCallback(() => resolve(true), [resolve]);

  // ---------- Terminal screens ----------

  if (noHearts) {
    return (
      <EndScreen
        icon="heart-dislike-outline"
        iconColor={colors.heart}
        title="Suas vidas acabaram"
        text="As vidas voltam com o tempo (uma a cada 20 minutos). Você também recupera uma vida a cada lição de pronúncia concluída."
        primary={{ title: 'Praticar pronúncia', onPress: () => router.replace('/(tabs)/practice') }}
        secondary={{ title: 'Voltar', onPress: () => router.back() }}
      />
    );
  }

  if (result) {
    const accuracy = Math.round((total / (total + mistakes)) * 100);
    const mm = Math.floor(result.seconds / 60);
    const ss = String(result.seconds % 60).padStart(2, '0');
    return (
      <EndScreen
        icon={result.perfect ? 'trophy-outline' : 'checkmark-done-outline'}
        iconColor={result.perfect ? colors.flame : colors.success}
        title={result.perfect ? 'Lição perfeita' : 'Lição concluída'}
        text={data ? `${data.skill.unitTitle} · ${data.skill.title}` : ''}
        metrics={[
          { label: 'XP', value: `+${result.xp}`, color: colors.accent },
          { label: 'Precisão', value: `${accuracy}%`, color: colors.success },
          { label: 'Tempo', value: `${mm}:${ss}`, color: colors.ink },
        ]}
        primary={{ title: 'Continuar', onPress: () => router.back() }}
      />
    );
  }

  if (!data || !current) {
    return error ? (
      <EndScreen icon="alert-circle-outline" iconColor={colors.danger} title="Não foi possível abrir" text={error} primary={{ title: 'Voltar', onPress: () => router.back() }} />
    ) : (
      <Loading />
    );
  }

  const locked = phase !== 'answer';
  const showCheck = current.type !== 'match' && current.type !== 'speak';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Fechar">
          <Icon name="close" size={26} color={colors.muted} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ProgressBar value={solved / total} height={10} />
        </View>
        <View style={styles.hearts}>
          <Icon name="heart" size={20} color={colors.heart} />
          <Text style={styles.heartsText}>{hearts}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {current.key.endsWith('-r') ? (
          <View style={styles.retryTag}>
            <Icon name="refresh" size={14} color={colors.warning} />
            <Text style={styles.retryText}>Erro anterior</Text>
          </View>
        ) : null}
        <Text style={styles.instruction}>{instructionFor(current)}</Text>

        <View key={current.key}>
          {current.type === 'word' || current.type === 'choose' || current.type === 'fill' ? (
            <OptionsExercise ex={current} locked={locked} onDraft={setDraft} />
          ) : current.type === 'build_en' || current.type === 'build_pt' || current.type === 'listen' ? (
            <BuildExercise ex={current} locked={locked} onDraft={setDraft} />
          ) : current.type === 'match' ? (
            <MatchExercise ex={current} onDone={onMatchDone} onMiss={onMatchMiss} />
          ) : current.type === 'speak' ? (
            <SpeakExercise ex={current} locked={locked} onResult={resolve} onSkip={skip} />
          ) : null}
        </View>
        <ErrorText>{error}</ErrorText>
      </ScrollView>

      {phase === 'answer' ? (
        showCheck ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Button title="Verificar" onPress={check} disabled={draft === null} style={styles.footerButton} />
          </View>
        ) : null
      ) : (
        <View
          style={[
            styles.footer,
            styles.feedback,
            { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: phase === 'correct' ? colors.successSoft : colors.dangerSoft },
          ]}
        >
          <View style={styles.feedbackInner}>
            <View style={styles.feedbackHead}>
              <Icon
                name={phase === 'correct' ? 'checkmark-circle' : 'close-circle'}
                size={26}
                color={phase === 'correct' ? colors.success : colors.danger}
              />
              <Text style={[styles.feedbackTitle, { color: phase === 'correct' ? colors.success : colors.danger }]}>
                {phase === 'correct' ? PRAISE[solved % PRAISE.length] : 'Resposta correta:'}
              </Text>
            </View>
            {phase === 'wrong' && solutionOf(current) ? <Text style={styles.solution}>{solutionOf(current)}</Text> : null}
          </View>
          <Button
            title="Continuar"
            variant={phase === 'correct' ? 'success' : 'danger'}
            onPress={advance}
            style={styles.footerButton}
          />
        </View>
      )}
    </View>
  );
}

function EndScreen({
  icon,
  iconColor,
  title,
  text,
  metrics,
  primary,
  secondary,
}: {
  icon: string;
  iconColor: string;
  title: string;
  text: string;
  metrics?: { label: string; value: string; color: string }[];
  primary: { title: string; onPress: () => void };
  secondary?: { title: string; onPress: () => void };
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, styles.end, { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom, 20) }]}>
      <View style={{ alignItems: 'center', gap: 14, flex: 1, justifyContent: 'center' }}>
        <View style={styles.endIcon}>
          <Icon name={icon} size={44} color={iconColor} />
        </View>
        <Text style={[type.title, { textAlign: 'center' }]}>{title}</Text>
        {text ? <Text style={[type.body, { textAlign: 'center', maxWidth: 360 }]}>{text}</Text> : null}
        {metrics ? (
          <View style={styles.metrics}>
            {metrics.map((m) => (
              <View key={m.label} style={styles.metric}>
                <Text style={type.overline}>{m.label}</Text>
                <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View style={{ gap: 10, width: '100%', maxWidth: 480 }}>
        <Button title={primary.title} onPress={primary.onPress} />
        {secondary ? <Button title={secondary.title} variant="ghost" onPress={secondary.onPress} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingBottom: 8, maxWidth: 680, width: '100%', alignSelf: 'center' },
  hearts: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heartsText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.heart },
  body: { padding: 20, paddingTop: 24, gap: 20, maxWidth: 680, width: '100%', alignSelf: 'center' },
  instruction: { fontFamily: fonts.semibold, fontSize: 20, color: colors.ink },
  retryTag: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.warningSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  retryText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.warning },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 20, paddingTop: 16, gap: 14, alignItems: 'center' },
  footerButton: { width: '100%', maxWidth: 640 },
  feedback: { borderTopWidth: 0 },
  feedbackInner: { width: '100%', maxWidth: 640, gap: 6 },
  feedbackHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedbackTitle: { fontFamily: fonts.bold, fontSize: 18 },
  solution: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, marginLeft: 36 },
  end: { alignItems: 'center', paddingHorizontal: 24 },
  endIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  metrics: { flexDirection: 'row', gap: 10, marginTop: 16 },
  metric: { minWidth: 96, alignItems: 'center', gap: 6, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  metricValue: { fontFamily: fonts.display, fontSize: 24 },
});
