import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, type LessonSummary } from '@/lib/api';
import { ErrorText, Icon, IconTile, Loading, Overline } from '@/components/ui';
import { colors, fonts, levelLabel, radius, type } from '@/lib/theme';

export default function Practice() {
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setLessons((await api.lessons()).lessons);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!lessons && !error) return <Loading />;

  const units = (lessons ?? []).reduce<Record<string, LessonSummary[]>>((acc, l) => ((acc[l.unit] ??= []).push(l), acc), {});

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <View style={styles.intro}>
        <Icon name="heart" size={18} color={colors.heart} />
        <Text style={[type.small, { flex: 1, color: colors.ink2 }]}>
          Cada lição de pronúncia concluída recupera uma vida na Trilha.
        </Text>
      </View>

      <ErrorText>{error}</ErrorText>

      {Object.entries(units).map(([unit, items]) => (
        <View key={unit} style={{ gap: 10 }}>
          <Overline>{unit}</Overline>
          <View style={styles.group}>
            {items.map((l, i) => (
              <Pressable
                key={l.id}
                onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: l.id } })}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: colors.sunken }]}
              >
                <IconTile name={l.icon} tone={l.completed ? 'success' : 'neutral'} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{l.title}</Text>
                  <Text style={type.small}>{levelLabel[l.level]} · {l.phraseCount} frases</Text>
                </View>
                {l.completed ? (
                  <Text style={styles.score}>{l.bestScore}%</Text>
                ) : (
                  <Icon name="chevron-forward" size={18} color={colors.muted} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 24, maxWidth: 640, width: '100%', alignSelf: 'center' },
  intro: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  score: { fontFamily: fonts.semibold, fontSize: 14, color: colors.success },
});
