import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { ErrorText, Icon, Loading } from '@/components/ui';
import { colors, fonts, radius, type } from '@/lib/theme';

type Entry = Awaited<ReturnType<typeof api.leaderboard>>['entries'][number];

const MEDAL = [colors.flame, '#8E9AAF', '#A0703F'];

export default function Ranking() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setEntries((await api.leaderboard()).entries);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!entries && !error) return <Loading />;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Text style={type.body}>XP conquistado nos últimos 7 dias por todos os alunos.</Text>
      <ErrorText>{error}</ErrorText>

      <View style={styles.group}>
        {entries?.map((e, i) => (
          <View key={e.id} style={[styles.row, i > 0 && styles.rowBorder, e.me && { backgroundColor: colors.accentSoft }]}>
            <View style={styles.rank}>
              {e.rank <= 3 ? (
                <Icon name="ribbon" size={20} color={MEDAL[e.rank - 1]} />
              ) : (
                <Text style={styles.rankText}>{e.rank}</Text>
              )}
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{e.name[0]?.toUpperCase()}</Text>
            </View>
            <Text style={[styles.name, e.me && { color: colors.accentInk }]} numberOfLines={1}>
              {e.name}{e.me ? ' (você)' : ''}
            </Text>
            <Text style={styles.xp}>{e.xp} XP</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 18, maxWidth: 640, width: '100%', alignSelf: 'center' },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rank: { width: 24, alignItems: 'center' },
  rankText: { fontFamily: fonts.semibold, color: colors.muted, fontSize: 14 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.semibold, color: colors.ink2 },
  name: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  xp: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink2 },
});
