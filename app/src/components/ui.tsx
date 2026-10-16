import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, fonts, radius, type } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color = colors.ink }: { name: IconName | string; size?: number; color?: string }) {
  return <Ionicons name={name as IconName} size={size} color={color} />;
}

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'success' | 'danger';

const variantStyle: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.ink, fg: '#fff' },
  accent: { bg: colors.accent, fg: '#fff' },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.line },
  ghost: { bg: 'transparent', fg: colors.ink2 },
  success: { bg: colors.success, fg: '#fff' },
  danger: { bg: colors.danger, fg: '#fff' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = variantStyle[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg, borderWidth: v.border ? 1 : 0 },
        (disabled || loading) && { opacity: 0.4 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Icon name={icon} size={18} color={v.fg} /> : null}
          <Text style={[styles.buttonText, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 8 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, style]} {...rest} />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <View style={styles.errorBox}>
      <Icon name="alert-circle-outline" size={16} color={colors.danger} />
      <Text style={styles.error}>{children}</Text>
    </View>
  );
}

export function Center({ children }: { children: ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

export function Loading() {
  return (
    <Center>
      <ActivityIndicator color={colors.ink} />
    </Center>
  );
}

export function Overline({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.overline, style]}>{children}</Text>;
}

/** Rounded square holding an icon — used for list rows. */
export function IconTile({ name, tone = 'neutral', size = 44 }: { name: string; tone?: 'neutral' | 'accent' | 'success'; size?: number }) {
  const bg = tone === 'accent' ? colors.accentSoft : tone === 'success' ? colors.successSoft : colors.sunken;
  const fg = tone === 'accent' ? colors.accent : tone === 'success' ? colors.success : colors.ink2;
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: bg }]}>
      <Icon name={name} size={size * 0.46} color={fg} />
    </View>
  );
}

export function ProgressBar({ value, color = colors.accent, height = 8 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

/** Streak, hearts and similar small stat chips. */
export function Stat({ icon, value, color }: { icon: string; value: string | number; color: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={18} color={color} />
      <Text style={styles.statText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 15, fontFamily: fonts.semibold, letterSpacing: 0.1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  label: { fontSize: 13, fontFamily: fonts.medium, color: colors.ink2 },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.ink,
  },
  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  error: { color: colors.danger, fontSize: 14, fontFamily: fonts.regular, flex: 1, lineHeight: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  tile: { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  track: { width: '100%', backgroundColor: colors.sunken, overflow: 'hidden' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
