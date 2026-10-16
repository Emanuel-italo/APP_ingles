import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';

/** Tap to start, tap again to stop. A soft ring pulses while recording. */
export function MicButton({
  recording,
  busy,
  onPress,
  size = 76,
  hint = true,
}: {
  recording: boolean;
  busy?: boolean;
  onPress: () => void;
  size?: number;
  hint?: boolean;
}) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!recording) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  const ring = size + 28;

  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={recording ? 'Parar gravação' : 'Gravar'}>
        <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
          {recording ? (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius: ring / 2,
                  backgroundColor: colors.dangerSoft,
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] }) }],
                },
              ]}
            />
          ) : null}
          <View
            style={[
              styles.button,
              { width: size, height: size, borderRadius: size / 2 },
              recording && { backgroundColor: colors.danger },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : recording ? (
              <View style={styles.stop} />
            ) : (
              <Icon name="mic" size={size * 0.38} color="#fff" />
            )}
          </View>
        </View>
      </Pressable>
      {hint ? (
        <Text style={styles.hint}>{busy ? 'Analisando' : recording ? 'Toque para parar' : 'Toque para falar'}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  stop: { width: 22, height: 22, borderRadius: 5, backgroundColor: '#fff' },
  hint: { color: colors.muted, fontSize: 13, fontFamily: fonts.medium },
});
