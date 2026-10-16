import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import { Button, ErrorText, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, fonts, type } from '@/lib/theme';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={type.title}>Bem-vindo de volta</Text>
        <Text style={[type.body, { marginBottom: 8 }]}>Continue de onde parou.</Text>
        <Input label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Input label="Senha" value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={submit} />
        <ErrorText>{error}</ErrorText>
        <Button title="Entrar" onPress={submit} loading={loading} style={{ marginTop: 8 }} />
        <Link href="/(auth)/register" style={styles.link}>Ainda não tem conta? <Text style={styles.linkStrong}>Cadastre-se</Text></Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, maxWidth: 480, width: '100%', alignSelf: 'center' },
  link: { color: colors.muted, textAlign: 'center', fontFamily: fonts.regular, padding: 8 },
  linkStrong: { color: colors.ink, fontFamily: fonts.semibold },
});
