import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Button, ErrorText, Icon, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { Level } from '@/lib/api';
import { colors, fonts, levelLabel, radius, type } from '@/lib/theme';

const LEVELS: { id: Level; desc: string }[] = [
  { id: 'beginner', desc: 'Sei pouco ou nada' },
  { id: 'intermediate', desc: 'Me viro em conversas simples' },
  { id: 'advanced', desc: 'Converso bem e busco fluência' },
];

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [level, setLevel] = useState<Level>('beginner');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await register({ name, email, password, level });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={type.title}>Crie sua conta</Text>
        <Text style={[type.body, { marginBottom: 8 }]}>Leva menos de um minuto.</Text>
        <Input label="Nome" value={name} onChangeText={setName} autoComplete="name" />
        <Input label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Input label="Senha" placeholder="Mínimo de 6 caracteres" value={password} onChangeText={setPassword} secureTextEntry />

        <Text style={styles.label}>Seu nível atual</Text>
        <View style={styles.levels}>
          {LEVELS.map((l) => {
            const active = level === l.id;
            return (
              <Pressable key={l.id} onPress={() => setLevel(l.id)} style={[styles.level, active && styles.levelActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.levelTitle}>{levelLabel[l.id]}</Text>
                  <Text style={type.small}>{l.desc}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <Icon name="checkmark" size={14} color="#fff" /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <ErrorText>{error}</ErrorText>
        <Button title="Criar conta" onPress={submit} loading={loading} style={{ marginTop: 8 }} />
        <Link href="/(auth)/login" style={styles.link}>Já tem conta? <Text style={styles.linkStrong}>Entrar</Text></Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, maxWidth: 480, width: '100%', alignSelf: 'center' },
  label: { fontSize: 13, fontFamily: fonts.medium, color: colors.ink2, marginTop: 4 },
  levels: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  level: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  levelActive: { backgroundColor: colors.accentSoft },
  levelTitle: { fontSize: 15, fontFamily: fonts.semibold, color: colors.ink },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  link: { color: colors.muted, textAlign: 'center', fontFamily: fonts.regular, padding: 8 },
  linkStrong: { color: colors.ink, fontFamily: fonts.semibold },
});
