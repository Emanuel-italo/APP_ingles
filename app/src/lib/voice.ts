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

/** Speaks English text with the device/browser voice (free, offline on most devices). */
export function speak(text: string, opts: { slow?: boolean } = {}) {
  Speech.stop();
  Speech.speak(text.replace(/^\[demo\]\s*/, ''), { language: 'en-US', rate: opts.slow ? 0.7 : 0.95 });
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
