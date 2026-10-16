import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, BASE_URL, type Level, type Stats } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, ErrorText, Icon, Overline } from '@/components/ui';
import { colors, fonts, levelLabel, radius, type } from '@/lib/theme';

const GOALS = [
  { xp: 10, label: 'Leve' },
  { xp: 20, label: 'Regular' },
  { xp: 30, label: 'Sério' },
  { xp: 50, label: 'Intenso' },
];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      api.me().then((r) => { setUser(r.user); setStats(r.stats); }).catch((e) => setError(e.message));
    }, [setUser]),
  );

  const update = async (body: { level?: Level; dailyGoal?: number }) => {
    try {
      setUser((await api.updateMe(body)).user);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!user) return null;

  const maxWeek = Math.max(user.dailyGoal, ...(stats?.week.map((d) => d.xp) ?? [0]));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user.name[0]?.toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>{user.name}</Text>
          <Text style={type.small}>{user.email}</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatBox icon="flame" color={colors.flame} value={user.streak} label="dias seguidos" />
        <StatBox icon="flash" color={colors.accent} value={user.xp} label="XP total" />
        <StatBox icon="map" color={colors.ink} value={`${stats?.skillsCompleted ?? 0}/${stats?.totalSkills ?? 0}`} label="habilidades" />
        <StatBox icon="bookmark" color={colors.success} value={stats?.savedItems ?? 0} label="itens para revisar" />
      </View>

      <Pressable onPress={() => router.push('/ranking')} style={({ pressed }) => [styles.link, pressed && { backgroundColor: colors.sunken }]}>
        <Icon name="podium-outline" size={20} color={colors.ink} />
        <Text style={styles.linkText}>Ranking semanal</Text>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>

      <View style={{ gap: 12 }}>
        <Overline>Últimos 7 dias</Overline>
        <View style={styles.chart}>
          {stats?.week.map((d) => {
            const date = new Date(d.day + 'T12:00:00Z');
            const reached = d.xp >= user.dailyGoal;
            return (
              <View key={d.day} style={styles.barCol}>
                <Text style={styles.barValue}>{d.xp > 0 ? d.xp : ''}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${(d.xp / maxWeek) * 100}%`, backgroundColor: reached ? colors.success : colors.ink },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{WEEKDAYS[date.getUTCDay()]}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Overline>Meta diária</Overline>
        <View style={styles.segment}>
          {GOALS.map((g) => {
            const active = user.dailyGoal === g.xp;
            return (
              <Pressable key={g.xp} onPress={() => update({ dailyGoal: g.xp })} style={[styles.segItem, active && styles.segActive]}>
                <Text style={[styles.segTitle, active && { color: '#fff' }]}>{g.label}</Text>
                <Text style={[styles.segSub, active && { color: 'rgba(255,255,255,0.7)' }]}>{g.xp} XP</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Overline>Nível do tutor de IA</Overline>
        <View style={styles.segment}>
          {(['beginner', 'intermediate', 'advanced'] as Level[]).map((l) => {
            const active = user.level === l;
            return (
              <Pressable key={l} onPress={() => update({ level: l })} style={[styles.segItem, active && styles.segActive]}>
                <Text style={[styles.segTitle, active && { color: '#fff' }]}>{levelLabel[l]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ErrorText>{error}</ErrorText>

      <Button title="Sair da conta" variant="secondary" icon="log-out-outline" onPress={logout} />
      <Text style={[type.small, { textAlign: 'center' }]}>Servidor: {BASE_URL}</Text>
    </ScrollView>
  );
}

function StatBox({ icon, color, value, label }: { icon: string; color: string; value: string | number; label: string }) {
  return (
    <View style={styles.statBox}>
      <Icon name={icon} size={18} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 28, maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 26, fontFamily: fonts.display },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 6 },
  statValue: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  chart: { flexDirection: 'row', gap: 8, height: 160, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barValue: { fontFamily: fonts.medium, fontSize: 10, color: colors.muted, height: 14 },
  barTrack: { flex: 1, width: '100%', maxWidth: 28, justifyContent: 'flex-end', backgroundColor: colors.sunken, borderRadius: 6, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 6 },
  barLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  linkText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 4, gap: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segActive: { backgroundColor: colors.ink },
  segTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  segSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 2 },
});
