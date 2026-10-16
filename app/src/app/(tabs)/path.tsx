import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type PathSkill, type PathUnit } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ErrorText, Icon, Loading, ProgressBar, Stat } from '@/components/ui';
import { colors, fonts, radius, type } from '@/lib/theme';

// Horizontal offsets that make the nodes wind down the screen.
const WAVE = [0, 56, 84, 56, 0, -56, -84, -56];
const NODE = 72;

/** Optional structured course: short exercises that complement the conversation practice. */
export default function PathScreen() {
  const { user, setUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [units, setUnits] = useState<PathUnit[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const r = await api.path();
      setUnits(r.units);
      setUser(r.user);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [setUser]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!units && !error) return <Loading />;

  const goalProgress = user ? user.xpToday / user.dailyGoal : 0;
  let nodeIndex = 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <View style={styles.topInner}>
          <Text style={styles.brand}>Trilha</Text>
          <View style={styles.stats}>
            <Stat icon="flame" value={user?.streak ?? 0} color={colors.flame} />
            <Stat icon="flash" value={user?.xp ?? 0} color={colors.accent} />
            <Stat icon="heart" value={user?.hearts ?? 0} color={colors.heart} />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Text style={type.body}>Exercícios curtos de vocabulário e gramática para apoiar suas conversas. Use quando quiser.</Text>

        {user ? (
          <View style={styles.goal}>
            <View style={styles.goalHead}>
              <Text style={styles.goalTitle}>Meta diária</Text>
              <Text style={styles.goalValue}>
                {Math.min(user.xpToday, user.dailyGoal)} / {user.dailyGoal} XP
              </Text>
            </View>
            <ProgressBar value={goalProgress} color={goalProgress >= 1 ? colors.success : colors.accent} />
            {goalProgress >= 1 ? <Text style={[type.small, { color: colors.success }]}>Meta de hoje concluída.</Text> : null}
          </View>
        ) : null}

        <ErrorText>{error}</ErrorText>

        {units?.map((unit) => (
          <View key={unit.id} style={{ gap: 28 }}>
            <View style={[styles.unitHeader, unit.skills.every((s) => s.status === 'locked') && styles.unitLocked]}>
              <Text style={styles.unitOverline}>Unidade {unit.index}</Text>
              <Text style={styles.unitTitle}>{unit.title}</Text>
              <Text style={styles.unitDesc}>{unit.description}</Text>
            </View>
            <View style={{ alignItems: 'center', gap: 22 }}>
              {unit.skills.map((skill) => {
                const offset = WAVE[nodeIndex++ % WAVE.length];
                return <SkillNode key={skill.id} skill={skill} offset={offset} />;
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function SkillNode({ skill, offset }: { skill: PathSkill; offset: number }) {
  const locked = skill.status === 'locked';
  const current = skill.status === 'current';
  const done = skill.status === 'done';

  const open = () => {
    if (!locked) router.push({ pathname: '/session/[skillId]', params: { skillId: skill.id } });
  };

  return (
    <View style={{ alignItems: 'center', transform: [{ translateX: offset }], gap: 8 }}>
      {current ? (
        <View style={styles.startTag}>
          <Text style={styles.startText}>Começar</Text>
          <View style={styles.startArrow} />
        </View>
      ) : null}
      <Pressable onPress={open} disabled={locked} accessibilityRole="button" accessibilityLabel={skill.title}>
        {({ pressed }) => (
          <View style={[styles.ring, current && styles.ringCurrent]}>
            <View
              style={[
                styles.node,
                done && { backgroundColor: colors.ink },
                current && { backgroundColor: colors.accent },
                locked && { backgroundColor: colors.sunken },
                pressed && { transform: [{ translateY: 2 }] },
              ]}
            >
              <Icon
                name={locked ? 'lock-closed' : done ? 'checkmark' : skill.icon}
                size={locked ? 22 : 28}
                color={locked ? colors.muted : '#fff'}
              />
            </View>
          </View>
        )}
      </Pressable>
      <Text style={[styles.nodeLabel, locked && { color: colors.muted }]}>{skill.title}</Text>
      {done && skill.times > 1 ? <Text style={styles.nodeMeta}>{skill.times}x concluída</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 12, paddingHorizontal: 20 },
  topInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', maxWidth: 640, width: '100%', alignSelf: 'center' },
  brand: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  stats: { flexDirection: 'row', gap: 18 },
  container: { padding: 20, paddingBottom: 60, gap: 32, maxWidth: 640, width: '100%', alignSelf: 'center' },
  goal: { gap: 10, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16 },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  goalTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  goalValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  unitHeader: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: 20, gap: 4 },
  unitLocked: { backgroundColor: colors.ink2, opacity: 0.55 },
  unitOverline: { ...type.overline, color: 'rgba(255,255,255,0.6)' },
  unitTitle: { fontFamily: fonts.display, fontSize: 24, color: '#fff' },
  unitDesc: { fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  ring: { width: NODE + 16, height: NODE + 16, borderRadius: (NODE + 16) / 2, alignItems: 'center', justifyContent: 'center' },
  ringCurrent: { borderWidth: 3, borderColor: colors.accentSoft },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center' },
  nodeLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  nodeMeta: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: -6 },
  startTag: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  startText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accent, letterSpacing: 0.4, textTransform: 'uppercase' },
  startArrow: { position: 'absolute', bottom: -6, width: 10, height: 10, backgroundColor: colors.surface, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line, transform: [{ rotate: '45deg' }] },
});
