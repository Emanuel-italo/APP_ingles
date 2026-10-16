import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Icon } from '@/components/ui';
import { colors, fonts, type } from '@/lib/theme';

const FEATURES = [
  { icon: 'chatbubbles-outline', title: 'Conversação com IA', text: 'Fale em situações reais e receba correções em português, na hora.' },
  { icon: 'mic-outline', title: 'Pronúncia com nota', text: 'Repita frases e veja, palavra por palavra, o que melhorar.' },
  { icon: 'map-outline', title: 'Trilha opcional', text: 'Exercícios curtos de vocabulário para reforçar a base.' },
];

export default function Welcome() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <View style={styles.brandRow}>
          <View style={styles.mark}><Text style={styles.markText}>f</Text></View>
          <Text style={styles.brand}>Fala</Text>
        </View>
        <Text style={styles.headline}>
          Inglês de verdade,{'\n'}
          <Text style={styles.headlineItalic}>falado</Text> desde o primeiro dia.
        </Text>
        <Text style={[type.body, { maxWidth: 380 }]}>
          Um método que combina prática estruturada com conversas reais, no seu ritmo.
        </Text>
      </View>

      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.title} style={styles.feature}>
            <Icon name={f.icon} size={20} color={colors.ink} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={type.small}>{f.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: 10 }}>
        <Button title="Criar conta grátis" onPress={() => router.push('/(auth)/register')} />
        <Button title="Já tenho uma conta" variant="ghost" onPress={() => router.push('/(auth)/login')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: 24, justifyContent: 'space-between', backgroundColor: colors.bg, maxWidth: 520, width: '100%', alignSelf: 'center' },
  top: { gap: 20, marginTop: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  markText: { color: '#fff', fontFamily: fonts.display, fontSize: 22, marginTop: -3 },
  brand: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
  headline: { ...type.display, fontSize: 38, lineHeight: 44 },
  headlineItalic: { fontFamily: fonts.displayItalic, color: colors.accent },
  features: { gap: 18, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 24 },
  feature: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  featureTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
