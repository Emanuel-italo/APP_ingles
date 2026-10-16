import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type ConversationSummary, type Scenario } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ErrorText, Icon, IconTile, Loading, Overline, ProgressBar, Stat } from '@/components/ui';
import { colors, fonts, radius, type } from '@/lib/theme';

const FREE_TALK = 'free-talk';
const ALL = 'Todos';

export default function Home() {
  const { user, setUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(ALL);
  const [recent, setRecent] = useState<ConversationSummary[]>([]);
  const [aiMode, setAiMode] = useState<'groq' | 'demo' | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const [s, c, h, me] = await Promise.all([api.scenarios(), api.conversations(), api.health(), api.me()]);
      setScenarios(s.scenarios);
      setCategories(s.categories);
      setRecent(c.conversations);
      setAiMode(h.ai);
      setUser(me.user);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [setUser]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!scenarios && !error) return <Loading />;

  const goal = user ? Math.min(1, user.xpToday / user.dailyGoal) : 0;
  const roleplays = (scenarios ?? []).filter((s) => s.id !== FREE_TALK && (category === ALL || s.category === category));
  const completedCount = (scenarios ?? []).filter((s) => s.id !== FREE_TALK && s.completed).length;
  const totalRoleplays = (scenarios ?? []).filter((s) => s.id !== FREE_TALK).length;
  const inProgress = recent.filter((c) => !c.completed && c.messageCount > 1).slice(0, 3);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topInner}>
          <Text style={styles.brand}>Fala</Text>
          <View style={styles.stats}>
            <Stat icon="flame" value={user?.streak ?? 0} color={colors.flame} />
            <Stat icon="flash" value={user?.xp ?? 0} color={colors.accent} />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={{ gap: 4 }}>
          <Text style={type.title}>Olá, {user?.name.split(' ')[0]}.</Text>
          <Text style={type.body}>Escolha uma situação e pratique falando.</Text>
        </View>

        {aiMode === 'demo' ? (
          <View style={styles.demo}>
            <Icon name="information-circle-outline" size={18} color={colors.warning} />
            <Text style={styles.demoText}>Modo demonstração: configure GROQ_API_KEY no servidor para respostas reais.</Text>
          </View>
        ) : null}
        <ErrorText>{error}</ErrorText>

        {/* Primary action: open conversation without a script */}
        <Pressable onPress={() => router.push({ pathname: '/scenario/[id]', params: { id: FREE_TALK } })}>
          {({ pressed }) => (
            <View style={[styles.hero, pressed && { opacity: 0.92 }]}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.heroOverline}>Conversa livre</Text>
                <Text style={styles.heroTitle}>Fale sobre qualquer assunto</Text>
                <Text style={styles.heroText}>Sem roteiro. O tutor responde, traduz e corrige você.</Text>
              </View>
              <View style={styles.heroMic}>
                <Icon name="mic" size={28} color={colors.ink} />
              </View>
            </View>
          )}
        </Pressable>

        {inProgress.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Overline>Continuar de onde parou</Overline>
            <View style={styles.group}>
              {inProgress.map((c, i) => (
                <Pressable
                  key={c.id}
                  onPress={() => router.push({ pathname: '/chat/[id]', params: { id: String(c.id) } })}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: colors.sunken }]}
                >
                  <IconTile name={c.icon ?? 'chatbubbles-outline'} size={38} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.rowTitle}>{c.title}</Text>
                    {c.tasksTotal > 0 ? (
                      <View style={styles.rowProgress}>
                        <View style={{ flex: 1 }}><ProgressBar value={c.tasksDone / c.tasksTotal} height={5} /></View>
                        <Text style={type.small}>{c.tasksDone}/{c.tasksTotal}</Text>
                      </View>
                    ) : (
                      <Text style={type.small}>{c.messageCount} mensagens</Text>
                    )}
                  </View>
                  <Icon name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 12 }}>
          <View style={styles.sectionHead}>
            <Overline>Situações</Overline>
            <Text style={type.small}>{completedCount} de {totalRoleplays} concluídas</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {[ALL, ...categories].map((c) => {
              const active = c === category;
              return (
                <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, active && styles.chipActive]}>
                  <Text style={[styles.chipText, active && { color: '#fff' }]}>{c}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.grid}>
            {roleplays.map((s) => (
              <Pressable
                key={s.id}
                style={styles.gridItem}
                onPress={() => router.push({ pathname: '/scenario/[id]', params: { id: s.id } })}
              >
                {({ pressed }) => (
                  <View style={[styles.card, pressed && { backgroundColor: colors.sunken }]}>
                    <View style={styles.cardTop}>
                      <IconTile name={s.icon} tone={s.completed ? 'success' : 'accent'} size={40} />
                      {s.completed ? (
                        <View style={styles.doneBadge}><Icon name="checkmark" size={12} color="#fff" /></View>
                      ) : null}
                    </View>
                    <Text style={styles.cardTitle}>{s.title}</Text>
                    <Text style={type.small} numberOfLines={2}>{s.description}</Text>
                    <Text style={styles.cardMeta}>{s.tasks.length} tarefas · com {s.partner}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {user ? (
          <View style={styles.goal}>
            <View style={styles.goalHead}>
              <Text style={styles.goalTitle}>Meta diária</Text>
              <Text style={type.small}>{Math.min(user.xpToday, user.dailyGoal)} / {user.dailyGoal} XP</Text>
            </View>
            <ProgressBar value={goal} color={goal >= 1 ? colors.success : colors.accent} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 12, paddingHorizontal: 20 },
  topInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', maxWidth: 640, width: '100%', alignSelf: 'center' },
  brand: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  stats: { flexDirection: 'row', gap: 18 },
  container: { padding: 20, paddingBottom: 48, gap: 24, maxWidth: 640, width: '100%', alignSelf: 'center' },
  demo: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.warningSoft },
  demoText: { flex: 1, color: colors.warning, fontSize: 13, lineHeight: 19, fontFamily: fonts.regular },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.ink, borderRadius: radius.lg, padding: 22 },
  heroOverline: { ...type.overline, color: 'rgba(255,255,255,0.6)' },
  heroTitle: { fontFamily: fonts.display, fontSize: 23, lineHeight: 29, color: '#fff' },
  heroText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.75)' },
  heroMic: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  rowProgress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  gridItem: { width: '50%', padding: 6 },
  card: { gap: 6, minHeight: 170, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  doneBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  cardMeta: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, marginTop: 'auto' },
  goal: { gap: 10, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16 },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  goalTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
