import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

/**
 * On web, browsers like Edge default to online "Natural" voices that can take several seconds
 * to start. Prefer a voice installed on the computer so playback begins immediately.
 */
function localWebVoice(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices().filter((v) => v.localService && v.lang.replace('_', '-').startsWith('en'));
  return (voices.find((v) => v.lang.replace('_', '-') === 'en-US') ?? voices[0])?.voiceURI;
}

type SpeakOptions = {
  slow?: boolean;
  /** Called as each word starts, with its [start, end) range in the original `text`. */
  onWord?: (start: number, end: number) => void;
  /** Called once when speech finishes, is stopped or fails. */
  onEnd?: () => void;
};

/** Speaks English text with the device/browser voice (free, offline on most devices). */
export function speak(text: string, opts: SpeakOptions = {}) {
  Speech.stop();
  const spoken = text.replace(/^\[demo\]\s*/, '');
  const offset = text.length - spoken.length;
  const { onWord, onEnd } = opts;
  Speech.speak(spoken, {
    language: 'en-US',
    rate: opts.slow ? 0.7 : 0.95,
    voice: localWebVoice(),
    // Web passes a SpeechSynthesisEvent, native passes { charIndex, charLength }.
    onBoundary: onWord
      ? (ev: { charIndex: number; name?: string }) => {
          if (ev.name && ev.name !== 'word') return;
          const start = ev.charIndex;
          const match = /\s/.exec(spoken.slice(start));
          const end = match ? start + match.index : spoken.length;
          onWord(start + offset, end + offset);
        }
      : undefined,
    onDone: onEnd,
    onStopped: onEnd,
    onError: onEnd,
  });
}

export const stopSpeaking = () => Speech.stop();

function notify(msg: string) {
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert('Microfone', msg);
}

/** Push-to-talk recorder. start() asks for permission the first time; stop() resolves with the file URI. */
export function useRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);

  const start = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      notify('Permita o acesso ao microfone para praticar sua fala.');
      return false;
    }
    Speech.stop();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  }, [recorder]);

  const stop = useCallback(async () => {
    await recorder.stop();
    // Switch back to playback mode so TTS isn't routed to the earpiece on iOS.
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    return recorder.uri;
  }, [recorder]);

  return { start, stop, isRecording: state.isRecording, durationMillis: state.durationMillis };
}
