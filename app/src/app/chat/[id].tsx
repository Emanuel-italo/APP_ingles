import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type ChatMessage, type Feedback, type ReplySuggestion, type Scenario, type WritingHelp } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { speak, stopSpeaking, useRecorder } from '@/lib/voice';
import { MicButton } from '@/components/MicButton';
import { Button, Center, ErrorText, Icon, Loading } from '@/components/ui';
import { colors, fonts, radius, type } from '@/lib/theme';

const ASSIST_DELAY_MS = 700;

type Toast = { text: string; tone: 'success' | 'accent' } | null;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);
  const { setUser } = useAuth();
  const recorder = useRecorder();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [tasksDone, setTasksDone] = useState<number[]>([]);
  const [completed, setCompleted] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<Toast>(null);

  const [showPt, setShowPt] = useState(true);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const [suggestions, setSuggestions] = useState<ReplySuggestion[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const [help, setHelp] = useState<WritingHelp | null>(null);
  const [helpFor, setHelpFor] = useState('');
  const [helpLoading, setHelpLoading] = useState(false);
  const assistSeq = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const c = await api.conversation(conversationId);
        setScenario(c.scenario);
        setTasksDone(c.tasksDone);
        setCompleted(c.completed);
        setMessages(c.messages);
        if (c.messages.length === 1) speak(c.messages[0].content);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => { stopSpeaking(); };
  }, [conversationId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Debounced writing help while typing.
  useEffect(() => {
    const draft = text.trim();
    if (mode !== 'text' || draft.length < 2 || busy) return;
    const seq = ++assistSeq.current;
    const timer = setTimeout(async () => {
      setHelpLoading(true);
      try {
        const r = await api.assist(conversationId, draft);
        if (seq === assistSeq.current) { setHelp(r); setHelpFor(draft); }
      } catch {
        // Optional helper; ignore failures.
      } finally {
        if (seq === assistSeq.current) setHelpLoading(false);
      }
    }, ASSIST_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, mode, busy, conversationId]);

  const changeText = (value: string) => {
    setText(value);
    if (value.trim().length < 2) {
      assistSeq.current++;
      setHelp(null);
      setHelpLoading(false);
    }
  };

  const send = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || busy) return;
    assistSeq.current++;
    stopSpeaking();
    setBusy(true);
    setError('');
    setText('');
    setHelp(null);
    setHelpLoading(false);
    setSuggestions(null);
    setMessages((m) => [...(m ?? []), { role: 'user', content: trimmed }]);
    try {
      const r = await api.sendMessage(conversationId, trimmed);
      setUser(r.user);
      setTasksDone(r.tasksDone);
      setMessages((m) => {
        const copy = [...(m ?? [])];
        copy[copy.length - 1] = { ...copy[copy.length - 1], feedback: r.feedback };
        return [...copy, { id: r.replyMessageId, role: 'assistant', content: r.reply, translation: r.replyPt }];
      });
      if (r.feedback && !r.feedback.ok) {
        setSaved((s) => new Set(s).add(r.feedback!.corrected));
      }
      if (r.scenarioCompleted) {
        setCompleted(true);
        setJustCompleted(true);
      } else if (r.tasksCompleted.length && scenario) {
        setToast({ text: `Tarefa concluída: ${scenario.tasks[r.tasksCompleted[0]].pt}`, tone: 'success' });
      } else if (r.savedCount > 0) {
        setToast({ text: 'Correção salva em Revisar', tone: 'accent' });
      }
      speak(r.reply);
    } catch (e) {
      setError((e as Error).message);
      setMessages((m) => (m ?? []).slice(0, -1));
      setText(trimmed);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = async () => {
    if (recorder.isRecording) {
      const uri = await recorder.stop();
      if (!uri) return;
      setBusy(true);
      try {
        const { text: heard } = await api.transcribe(uri);
        setBusy(false);
        if (heard) await send(heard);
        else setError('Não entendi o áudio. Tente de novo, mais perto do microfone.');
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
    } else {
      setError('');
      setSuggestions(null);
      stopSpeaking();
      await recorder.start();
    }
  };

  const loadSuggestions = async () => {
    if (suggestions) { setSuggestions(null); return; }
    setSuggestLoading(true);
    try {
      setSuggestions((await api.suggestions(conversationId)).suggestions);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSuggestLoading(false);
    }
  };

  const saveText = useCallback(async (en: string, pt?: string | null) => {
    if (saved.has(en)) return;
    setSaved((s) => new Set(s).add(en));
    try {
      await api.save({ kind: 'phrase', en, pt });
      setToast({ text: 'Frase salva em Revisar', tone: 'accent' });
    } catch (e) {
      setSaved((s) => { const n = new Set(s); n.delete(en); return n; });
      setError((e as Error).message);
    }
  }, [saved]);

  const translate = useCallback(async (messageId: number) => {
    try {
      const { translation } = await api.translateMessage(conversationId, messageId);
      setMessages((m) => (m ?? []).map((x) => (x.id === messageId ? { ...x, translation } : x)));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [conversationId]);

  if (!messages) return error ? <Center><ErrorText>{error}</ErrorText></Center> : <Loading />;

  const waitingForUser = !busy && messages[messages.length - 1]?.role === 'assistant';
  const draft = text.trim();
  const helpIsCurrent = help && helpFor === draft && draft.length >= 2;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: scenario?.title ?? '',
          headerRight: () => (
            <Pressable
              onPress={() => setShowPt((v) => !v)}
              style={[styles.ptToggle, showPt && styles.ptToggleOn]}
              accessibilityLabel={showPt ? 'Ocultar traduções' : 'Mostrar traduções'}
            >
              <Icon name="language-outline" size={15} color={showPt ? '#fff' : colors.ink2} />
              <Text style={[styles.ptToggleText, showPt && { color: '#fff' }]}>PT</Text>
            </Pressable>
          ),
        }}
      />

      {scenario && scenario.tasks.length > 0 ? <TasksBar tasks={scenario.tasks} done={tasksDone} /> : null}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m, i) => String(m.id ?? `local-${i}`)}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) =>
          item.role === 'assistant' ? (
            <TutorBubble
              message={item}
              partner={scenario?.partner}
              showPt={showPt}
              saved={saved.has(item.content)}
              onSave={() => saveText(item.content, item.translation)}
              onTranslate={translate}
            />
          ) : (
            <UserBubble message={item} />
          )
        }
        ListFooterComponent={
          <View style={{ gap: 14 }}>
            {busy && !recorder.isRecording ? (
              <View style={styles.typing}>
                <ActivityIndicator size="small" color={colors.muted} />
                <Text style={styles.typingText}>{scenario?.partner ?? 'Tutor'} está respondendo…</Text>
              </View>
            ) : null}
            {waitingForUser && !justCompleted ? (
              <YourTurn
                recording={recorder.isRecording}
                suggestions={suggestions}
                loading={suggestLoading}
                onHint={loadSuggestions}
                onUse={(s) => { setMode('text'); changeText(s.en); setSuggestions(null); }}
              />
            ) : null}
            {justCompleted && scenario ? (
              <CompletionCard
                scenario={scenario}
                onContinue={() => setJustCompleted(false)}
                onReview={() => router.push('/(tabs)/review')}
                onExit={() => router.back()}
              />
            ) : null}
          </View>
        }
      />

      {toast ? (
        <View style={[styles.toast, { backgroundColor: toast.tone === 'success' ? colors.success : colors.ink }]}>
          <Icon name={toast.tone === 'success' ? 'checkmark-circle' : 'bookmark'} size={16} color="#fff" />
          <Text style={styles.toastText} numberOfLines={2}>{toast.text}</Text>
        </View>
      ) : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <ErrorText>{error}</ErrorText>

        {mode === 'voice' ? (
          <View style={styles.voiceBar}>
            <View style={styles.sideSlot}>
              {completed && !justCompleted ? (
                <View style={styles.completedPill}>
                  <Icon name="checkmark" size={12} color={colors.success} />
                  <Text style={styles.completedPillText}>Concluído</Text>
                </View>
              ) : null}
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <MicButton recording={recorder.isRecording} busy={busy} onPress={toggleMic} size={68} hint={false} />
              <Text style={styles.micHint}>
                {busy ? 'Aguarde' : recorder.isRecording ? 'Ouvindo… toque para enviar' : 'Toque para falar'}
              </Text>
            </View>
            <View style={[styles.sideSlot, { alignItems: 'flex-end' }]}>
              <Pressable onPress={() => setMode('text')} style={styles.roundButton} accessibilityLabel="Usar teclado" disabled={recorder.isRecording}>
                <Icon name="keypad-outline" size={20} color={colors.ink} />
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {draft.length >= 2 && (helpLoading || helpIsCurrent) ? (
              <WritingHelper help={helpIsCurrent ? help : null} loading={helpLoading} draft={draft} onUse={changeText} />
            ) : null}
            <View style={styles.inputRow}>
              <Pressable onPress={() => setMode('voice')} style={styles.roundButton} accessibilityLabel="Voltar para o microfone">
                <Icon name="mic-outline" size={20} color={colors.ink} />
              </Pressable>
              <TextInput
                value={text}
                onChangeText={changeText}
                placeholder="Escreva em inglês ou português"
                placeholderTextColor={colors.muted}
                style={styles.input}
                onSubmitEditing={() => send(text)}
                editable={!busy}
                returnKeyType="send"
                autoFocus
              />
              <Pressable
                style={[styles.send, (!draft || busy) && { opacity: 0.35 }]}
                onPress={() => send(text)}
                disabled={!draft || busy}
                accessibilityLabel="Enviar"
              >
                <Icon name="arrow-up" size={20} color="#fff" />
              </Pressable>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------- Tasks ----------

function TasksBar({ tasks, done }: { tasks: Scenario['tasks']; done: number[] }) {
  const [open, setOpen] = useState(false);
  const next = tasks.findIndex((_, i) => !done.includes(i));
  const all = next === -1;

  return (
    <Pressable onPress={() => setOpen(!open)} style={styles.tasksBar}>
      <View style={styles.tasksInner}>
        <View style={styles.tasksHead}>
          <Text style={styles.tasksLabel}>Tarefas</Text>
          <View style={styles.dots}>
            {tasks.map((_, i) => (
              <View key={i} style={[styles.dot, done.includes(i) && styles.dotDone]} />
            ))}
          </View>
          <Text style={styles.tasksCount}>{done.length}/{tasks.length}</Text>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
        </View>
        {open ? (
          <View style={{ gap: 10, marginTop: 4 }}>
            {tasks.map((t, i) => {
              const ok = done.includes(i);
              return (
                <View key={i} style={styles.taskRow}>
                  <Icon name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={ok ? colors.success : colors.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskText, ok && styles.taskTextDone]}>{t.pt}</Text>
                    <Text style={type.small}>{t.en}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.nextTask} numberOfLines={1}>
            {all ? 'Todas as tarefas concluídas' : tasks[next].pt}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ---------- Messages ----------

function TutorBubble({
  message,
  partner,
  showPt,
  saved,
  onSave,
  onTranslate,
}: {
  message: ChatMessage;
  partner?: string;
  showPt: boolean;
  saved: boolean;
  onSave: () => void;
  onTranslate: (id: number) => Promise<void>;
}) {
  const [hidden, setHidden] = useState(false);
  // Per-message override of the global translation setting.
  const [ptOverride, setPtOverride] = useState<boolean | null>(null);
  const [translating, setTranslating] = useState(false);
  const ptVisible = ptOverride ?? showPt;

  const togglePt = async () => {
    if (ptVisible && message.translation) {
      setPtOverride(false);
      return;
    }
    // Older messages may not have a translation yet: fetch it on demand.
    if (!message.translation && message.id) {
      setTranslating(true);
      await onTranslate(message.id);
      setTranslating(false);
    }
    setPtOverride(true);
  };

  return (
    <View style={{ alignItems: 'flex-start', gap: 4 }}>
      {partner ? <Text style={styles.speaker}>{partner}</Text> : null}
      <View style={[styles.bubble, styles.tutorBubble]}>
        {hidden ? (
          <Pressable onPress={() => setHidden(false)} style={styles.hiddenText}>
            <Icon name="ear-outline" size={16} color={colors.muted} />
            <Text style={styles.hiddenLabel}>Texto oculto para treinar a escuta. Toque para mostrar.</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.bubbleText}>{message.content}</Text>
            {ptVisible && message.translation ? (
              <View style={styles.translation}>
                <Text style={styles.translationText}>{message.translation}</Text>
              </View>
            ) : null}
          </>
        )}
        <View style={styles.actions}>
          <ActionIcon icon="volume-high-outline" label="Ouvir" onPress={() => speak(message.content)} />
          <ActionIcon icon="hourglass-outline" label="Ouvir devagar" onPress={() => speak(message.content, { slow: true })} />
          <ActionIcon
            icon={translating ? undefined : 'language-outline'}
            label="Tradução"
            active={ptVisible && !!message.translation}
            onPress={togglePt}
          />
          <ActionIcon icon={hidden ? 'eye-outline' : 'eye-off-outline'} label={hidden ? 'Mostrar texto' : 'Ocultar texto'} onPress={() => setHidden(!hidden)} />
          <View style={{ flex: 1 }} />
          <ActionIcon icon={saved ? 'bookmark' : 'bookmark-outline'} label="Salvar frase" active={saved} onPress={onSave} />
        </View>
      </View>
    </View>
  );
}

function ActionIcon({ icon, label, onPress, active }: { icon?: string; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityLabel={label} style={({ pressed }) => [styles.actionIcon, pressed && { backgroundColor: colors.sunken }]}>
      {icon ? <Icon name={icon} size={17} color={active ? colors.accent : colors.muted} /> : <ActivityIndicator size="small" color={colors.muted} />}
    </Pressable>
  );
}

function UserBubble({ message }: { message: ChatMessage }) {
  const fb = message.feedback;
  const hasError = fb && !fb.ok;
  const [open, setOpen] = useState(false);

  return (
    <View style={{ alignItems: 'flex-end', gap: 6 }}>
      <View style={styles.userRow}>
        {hasError ? (
          <Pressable onPress={() => setOpen(!open)} style={styles.asterisk} accessibilityLabel="Ver correção">
            <Text style={styles.asteriskText}>*</Text>
          </Pressable>
        ) : fb?.ok ? (
          <View style={styles.okMark}><Icon name="checkmark" size={12} color={colors.success} /></View>
        ) : null}
        <Pressable
          onPress={() => hasError && setOpen(!open)}
          style={[styles.bubble, styles.userBubble, open && { borderBottomRightRadius: 4 }]}
        >
          <Text style={[styles.bubbleText, { color: '#fff' }]}>{message.content}</Text>
          {hasError && !open ? <Text style={styles.tapHint}>Toque para ver a correção</Text> : null}
        </Pressable>
      </View>
      {hasError && open ? <Correction feedback={fb} /> : null}
    </View>
  );
}

function Correction({ feedback }: { feedback: Feedback }) {
  return (
    <View style={styles.correction}>
      <View style={styles.correctionHead}>
        <Text style={styles.correctionLabel}>Forma correta</Text>
        <Pressable onPress={() => speak(feedback.corrected)} hitSlop={8} accessibilityLabel="Ouvir">
          <Icon name="volume-high-outline" size={18} color={colors.accent} />
        </Pressable>
      </View>
      <Text style={styles.corrected}>{feedback.corrected}</Text>
      {feedback.corrected_pt ? <Text style={styles.correctedPt}>{feedback.corrected_pt}</Text> : null}
      <View style={styles.divider} />
      <Text style={styles.explanation}>{feedback.explanation_pt}</Text>
      {feedback.tip ? (
        <View style={styles.tipRow}>
          <Icon name="bulb-outline" size={14} color={colors.ink2} />
          <Text style={styles.tip}>{feedback.tip}</Text>
        </View>
      ) : null}
      {feedback.vocab?.length ? (
        <View style={styles.vocabRow}>
          {feedback.vocab.map((v) => (
            <View key={v.en} style={styles.vocabChip}>
              <Text style={styles.vocabEn}>{v.en}</Text>
              <Text style={styles.vocabPt}>{v.pt}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.savedNote}>
        <Icon name="bookmark" size={12} color={colors.muted} />
        <Text style={type.small}>Salvo automaticamente em Revisar</Text>
      </View>
    </View>
  );
}

// ---------- Your turn & hints ----------

function YourTurn({
  recording,
  suggestions,
  loading,
  onHint,
  onUse,
}: {
  recording: boolean;
  suggestions: ReplySuggestion[] | null;
  loading: boolean;
  onHint: () => void;
  onUse: (s: ReplySuggestion) => void;
}) {
  return (
    <View style={styles.turn}>
      <View style={styles.turnHead}>
        <Text style={styles.turnText}>{recording ? 'Ouvindo você…' : 'Sua vez. Responda falando.'}</Text>
        <Pressable onPress={onHint} style={[styles.hintButton, suggestions && styles.hintButtonOn]} accessibilityLabel="Ideias do que dizer">
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <Icon name={suggestions ? 'close' : 'bulb-outline'} size={16} color={suggestions ? '#fff' : colors.accent} />
              {!suggestions ? <Text style={styles.hintText}>Ideias</Text> : null}
            </>
          )}
        </Pressable>
      </View>
      {suggestions ? (
        <View style={{ gap: 2 }}>
          <Text style={[type.small, { marginBottom: 4 }]}>Leia uma em voz alta ou toque em Usar para editar.</Text>
          {suggestions.map((s, i) => (
            <View key={i} style={[styles.suggestion, i > 0 && styles.suggestionBorder]}>
              <Pressable onPress={() => speak(s.en)} hitSlop={6} accessibilityLabel="Ouvir sugestão">
                <Icon name="volume-high-outline" size={18} color={colors.ink2} />
              </Pressable>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.suggestionEn}>{s.en}</Text>
                {s.pt ? <Text style={styles.suggestionPt}>{s.pt}</Text> : null}
              </View>
              <Pressable onPress={() => onUse(s)} style={styles.useButton}>
                <Text style={styles.useText}>Usar</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function WritingHelper({ help, loading, draft, onUse }: { help: WritingHelp | null; loading: boolean; draft: string; onUse: (t: string) => void }) {
  if (!help) {
    return (
      <View style={[styles.panel, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
        <ActivityIndicator size="small" color={colors.muted} />
        <Text style={type.small}>Analisando o que você escreveu…</Text>
      </View>
    );
  }
  const correct = help.ok || help.english.trim().toLowerCase() === draft.toLowerCase();
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Icon name={correct ? 'checkmark-circle' : 'sparkles-outline'} size={14} color={correct ? colors.success : colors.accent} />
        <Text style={[styles.panelTitle, { color: correct ? colors.success : colors.accent }]}>
          {correct ? 'Sua frase está correta' : 'Em inglês, fica assim'}
        </Text>
        {loading ? <ActivityIndicator size="small" color={colors.muted} style={{ marginLeft: 'auto' }} /> : null}
      </View>
      {!correct && help.english ? (
        <View style={styles.helperRow}>
          <Pressable onPress={() => speak(help.english)} hitSlop={8}><Icon name="volume-high-outline" size={18} color={colors.ink2} /></Pressable>
          <Text style={styles.helperEnglish}>{help.english}</Text>
          <Pressable onPress={() => onUse(help.english)} style={styles.useButton}><Text style={styles.useText}>Usar</Text></Pressable>
        </View>
      ) : null}
      {help.meaning_pt ? <Text style={styles.explanation}><Text style={{ fontFamily: fonts.semibold }}>Significa: </Text>{help.meaning_pt}</Text> : null}
      {help.note_pt ? (
        <View style={styles.tipRow}>
          <Icon name="bulb-outline" size={14} color={colors.ink2} />
          <Text style={[styles.explanation, { flex: 1 }]}>{help.note_pt}</Text>
        </View>
      ) : null}
    </View>
  );
}

function CompletionCard({ scenario, onContinue, onReview, onExit }: { scenario: Scenario; onContinue: () => void; onReview: () => void; onExit: () => void }) {
  return (
    <View style={styles.complete}>
      <View style={styles.completeIcon}><Icon name="trophy-outline" size={28} color={colors.flame} /></View>
      <Text style={[type.title, { textAlign: 'center' }]}>Cenário concluído</Text>
      <Text style={[type.body, { textAlign: 'center' }]}>
        Você cumpriu todas as tarefas de “{scenario.title}”. Suas correções estão salvas para revisar.
      </Text>
      <View style={{ gap: 8, alignSelf: 'stretch' }}>
        <Button title="Revisar o que aprendi" icon="bookmark-outline" onPress={onReview} />
        <Button title="Continuar conversando" variant="secondary" onPress={onContinue} />
        <Button title="Sair" variant="ghost" onPress={onExit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 24, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },

  ptToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, marginRight: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line },
  ptToggleOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  ptToggleText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink2 },

  tasksBar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 16, paddingVertical: 10 },
  tasksInner: { maxWidth: 720, width: '100%', alignSelf: 'center', gap: 4 },
  tasksHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tasksLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  dots: { flexDirection: 'row', gap: 4, flex: 1 },
  dot: { width: 18, height: 4, borderRadius: 2, backgroundColor: colors.line },
  dotDone: { backgroundColor: colors.success },
  tasksCount: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  nextTask: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink2 },
  taskRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  taskText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  taskTextDone: { color: colors.muted, textDecorationLine: 'line-through' },

  speaker: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginLeft: 4 },
  bubble: { maxWidth: '86%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18 },
  tutorBubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderTopLeftRadius: 4, paddingBottom: 6 },
  userBubble: { backgroundColor: colors.ink, borderTopRightRadius: 4 },
  bubbleText: { fontSize: 16, lineHeight: 23, color: colors.ink, fontFamily: fonts.regular },
  translation: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  translationText: { fontSize: 14, lineHeight: 20, color: colors.muted, fontFamily: fonts.regular },
  hiddenText: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 4 },
  hiddenLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8, marginLeft: -8, marginRight: -8 },
  actionIcon: { width: 34, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '92%' },
  asterisk: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' },
  asteriskText: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.warning, marginTop: 4 },
  okMark: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  tapHint: { fontFamily: fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 6 },

  correction: { maxWidth: '86%', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 3, borderLeftColor: colors.warning, padding: 14, gap: 6 },
  correctionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  correctionLabel: { ...type.overline, color: colors.warning },
  corrected: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, lineHeight: 22 },
  correctedPt: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
  explanation: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink2, lineHeight: 20 },
  tipRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  tip: { flex: 1, fontSize: 14, color: colors.ink2, fontFamily: fonts.displayItalic, lineHeight: 20 },
  vocabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  vocabChip: { backgroundColor: colors.accentSoft, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  vocabEn: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accentInk },
  vocabPt: { fontFamily: fonts.regular, fontSize: 12, color: colors.ink2 },
  savedNote: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 },

  typing: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingLeft: 4 },
  typingText: { color: colors.muted, fontFamily: fonts.displayItalic, fontSize: 14 },

  turn: { alignSelf: 'flex-end', width: '86%', borderRadius: 18, borderTopRightRadius: 4, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, padding: 14, gap: 10 },
  turnHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  turnText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  hintButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
  hintButtonOn: { backgroundColor: colors.ink, paddingHorizontal: 8 },
  hintText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.accent },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  suggestionBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  suggestionEn: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, lineHeight: 21 },
  suggestionPt: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  useButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  useText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },

  complete: { alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 22, marginTop: 8 },
  completeIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' },

  toast: { position: 'absolute', left: 16, right: 16, bottom: 150, alignSelf: 'center', maxWidth: 520, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md },
  toastText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: '#fff' },

  composer: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface, paddingTop: 12, paddingHorizontal: 16, gap: 10, alignItems: 'center' },
  voiceBar: { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 520 },
  sideSlot: { flex: 1 },
  micHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  roundButton: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  completedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.successSoft },
  completedPillText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.success },

  panel: { width: '100%', maxWidth: 720, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  panelTitle: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.3 },
  helperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  helperEnglish: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, lineHeight: 22 },
  inputRow: { flexDirection: 'row', gap: 8, width: '100%', maxWidth: 720, alignItems: 'center' },
  input: { flex: 1, minHeight: 46, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 18, fontSize: 15, color: colors.ink, fontFamily: fonts.regular },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
