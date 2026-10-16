import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Scenario } from '@/lib/api';
import { Button, Center, ErrorText, Icon, IconTile, Loading, Overline } from '@/components/ui';
import { colors, fonts, radius, type } from '@/lib/theme';

/** Briefing shown before a role-play: setting, goal and tasks. */
export default function ScenarioBriefing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    api.scenario(id)
      .then((r) => { setScenario(r.scenario); setOpenId(r.openConversationId); })
      .catch((e) => setError(e.message));
  }, [id]);

  const start = async () => {
    setStarting(true);
    try {
      const { conversationId } = await api.startConversation(id);
      router.replace({ pathname: '/chat/[id]', params: { id: String(conversationId) } });
    } catch (e) {
      setError((e as Error).message);
      setStarting(false);
    }
  };

  if (!scenario) return error ? <Center><ErrorText>{error}</ErrorText></Center> : <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.head}>
          <IconTile name={scenario.icon} tone={scenario.completed ? 'success' : 'accent'} size={64} />
          <Text style={[type.display, { textAlign: 'center' }]}>{scenario.title}</Text>
          <View style={styles.partner}>
            <Icon name="person-circle-outline" size={16} color={colors.ink2} />
            <Text style={styles.partnerText}>Você vai conversar com {scenario.partner}</Text>
          </View>
          {scenario.completed ? (
            <View style={styles.completed}>
              <Icon name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.completedText}>Você já concluiu este cenário</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Overline>Cenário</Overline>
          <Text style={type.body}>{scenario.setting_pt}</Text>
        </View>

        <View style={styles.section}>
          <Overline>Objetivo</Overline>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>{scenario.goal_pt}</Text>
            <Text style={type.small}>{scenario.goal_en}</Text>
          </View>
        </View>

        {scenario.tasks.length > 0 ? (
          <View style={styles.section}>
            <Overline>Tarefas</Overline>
            <View style={styles.tasks}>
              {scenario.tasks.map((t, i) => (
                <View key={i} style={[styles.task, i > 0 && styles.taskBorder]}>
                  <View style={styles.taskNumber}><Text style={styles.taskNumberText}>{i + 1}</Text></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.taskTitle}>{t.pt}</Text>
                    <Text style={type.small}>{t.en}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={type.small}>As tarefas são marcadas automaticamente enquanto você conversa.</Text>
          </View>
        ) : null}

        <View style={styles.tips}>
          <Tip icon="mic-outline" text="Responda falando. Se preferir, use o teclado." />
          <Tip icon="bulb-outline" text="Travou? Toque na lâmpada para ver ideias do que dizer." />
          <Tip icon="alert-circle-outline" text="Frases com erro ganham um asterisco. Toque para ver a correção." />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <ErrorText>{error}</ErrorText>
        <Button title="Começar conversa" icon="mic" onPress={start} loading={starting} style={styles.footerButton} />
        {openId ? (
          <Button
            title="Continuar conversa anterior"
            variant="ghost"
            onPress={() => router.replace({ pathname: '/chat/[id]', params: { id: String(openId) } })}
            style={styles.footerButton}
          />
        ) : null}
      </View>
    </View>
  );
}

function Tip({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.tip}>
      <Icon name={icon} size={16} color={colors.muted} />
      <Text style={[type.small, { flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 32, gap: 24, maxWidth: 620, width: '100%', alignSelf: 'center' },
  head: { alignItems: 'center', gap: 12, paddingTop: 4 },
  partner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  partnerText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink2 },
  completed: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.successSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  completedText: { fontFamily: fonts.medium, fontSize: 12, color: colors.success },
  section: { gap: 10 },
  box: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 4 },
  boxTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  tasks: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  task: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  taskBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  taskNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' },
  taskNumberText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink2 },
  taskTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  tips: { gap: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 16 },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg, paddingHorizontal: 20, paddingTop: 14, gap: 6, alignItems: 'center' },
  footerButton: { width: '100%', maxWidth: 580 },
});
