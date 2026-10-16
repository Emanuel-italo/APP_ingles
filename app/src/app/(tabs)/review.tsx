import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, type SavedItem } from '@/lib/api';
import { speak } from '@/lib/voice';
import { Button, ErrorText, Icon, Loading } from '@/components/ui';
import { colors, fonts, radius, type } from '@/lib/theme';

type Tab = 'phrase' | 'word';

export default function Review() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [tab, setTab] = useState<Tab>('phrase');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setItems((await api.saved()).items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = async (id: number) => {
    setItems((list) => (list ?? []).filter((i) => i.id !== id));
    try {
      await api.deleteSaved(id);
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  if (!items && !error) return <Loading />;

  const all = items ?? [];
  const phrases = all.filter((i) => i.kind === 'phrase');
  const words = all.filter((i) => i.kind === 'word');
  const list = tab === 'phrase' ? phrases : words;
  const toReview = all.filter((i) => i.strength < 3).length;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      {all.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><Icon name="bookmark-outline" size={30} color={colors.ink2} /></View>
          <Text style={[type.title, { textAlign: 'center' }]}>Nada para revisar ainda</Text>
          <Text style={[type.body, { textAlign: 'center' }]}>
            Quando você errar uma frase numa conversa, a forma correta e as palavras novas aparecem aqui. Você também pode salvar qualquer fala do tutor tocando no marcador.
          </Text>
          <Button title="Começar uma conversa" icon="chatbubbles-outline" onPress={() => router.push('/(tabs)')} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.summaryTitle}>{toReview > 0 ? `${toReview} para revisar` : 'Tudo em dia'}</Text>
              <Text style={styles.summaryText}>{phrases.length} frases · {words.length} palavras salvas</Text>
            </View>
            <Button
              title="Praticar"
              icon="play"
              variant="accent"
              onPress={() => router.push('/practice-cards')}
              style={{ minHeight: 44, paddingHorizontal: 18 }}
            />
          </View>

          <View style={styles.segment}>
            {([['phrase', `Frases (${phrases.length})`], ['word', `Palavras (${words.length})`]] as const).map(([key, label]) => (
              <Pressable key={key} onPress={() => setTab(key)} style={[styles.segItem, tab === key && styles.segActive]}>
                <Text style={[styles.segText, tab === key && { color: '#fff' }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <ErrorText>{error}</ErrorText>

          {list.length === 0 ? (
            <Text style={[type.small, { textAlign: 'center', paddingVertical: 24 }]}>
              {tab === 'word' ? 'Nenhuma palavra salva ainda.' : 'Nenhuma frase salva ainda.'}
            </Text>
          ) : (
            <View style={styles.group}>
              {list.map((item, i) => {
                const open = expanded === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setExpanded(open ? null : item.id)}
                    style={[styles.row, i > 0 && styles.rowBorder]}
                  >
                    <View style={styles.rowMain}>
                      <Pressable onPress={() => speak(item.en)} hitSlop={8} style={styles.play} accessibilityLabel="Ouvir">
                        <Icon name="volume-high-outline" size={18} color={colors.accent} />
                      </Pressable>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.en}>{item.en}</Text>
                        {item.pt ? <Text style={styles.pt}>{item.pt}</Text> : null}
                      </View>
                      <Strength value={item.strength} />
                    </View>
                    {open ? (
                      <View style={styles.details}>
                        {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                        <View style={styles.detailFoot}>
                          <Text style={type.small}>
                            {item.source === 'correction' ? 'Da correção de uma conversa' : 'Salvo por você'} · {new Date(item.createdAt + 'Z').toLocaleDateString('pt-BR')}
                          </Text>
                          <Pressable onPress={() => remove(item.id)} hitSlop={8} style={styles.delete}>
                            <Icon name="trash-outline" size={16} color={colors.danger} />
                            <Text style={styles.deleteText}>Remover</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

/** Five small bars: how well the learner knows the item (from flashcard practice). */
function Strength({ value }: { value: number }) {
  return (
    <View style={styles.strength} accessibilityLabel={`Domínio ${value} de 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.bar, i < value && { backgroundColor: value >= 3 ? colors.success : colors.accent }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 18, maxWidth: 640, width: '100%', alignSelf: 'center' },
  empty: { alignItems: 'center', gap: 14, paddingTop: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.ink, borderRadius: radius.lg, padding: 18 },
  summaryTitle: { fontFamily: fonts.display, fontSize: 22, color: '#fff' },
  summaryText: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 4, gap: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segActive: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  row: { padding: 14, gap: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  play: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  en: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, lineHeight: 21 },
  pt: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, lineHeight: 18 },
  details: { marginLeft: 46, gap: 10 },
  note: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink2, lineHeight: 20 },
  detailFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  delete: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteText: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger },
  strength: { flexDirection: 'row', gap: 2 },
  bar: { width: 4, height: 14, borderRadius: 2, backgroundColor: colors.line },
});
