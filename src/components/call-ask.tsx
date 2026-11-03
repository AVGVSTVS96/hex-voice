import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CallCard } from '@/live/agents';
import type { AskOption } from '@/live/asks';
import { circle, radius, theme } from '@/theme';

// An ask hex brought up on the call, as a card in the transcript: tap a choice or just say it, or
// open a page it points to. Its topic opens the task it belongs to. Once answered, it folds to what
// was sent where.
export function CallAsk({
  card,
  onAnswer,
  onOpenTask,
}: {
  card: CallCard;
  onAnswer: (option: AskOption) => Promise<unknown>;
  onOpenTask: () => void;
}) {
  const { ask, answer } = card;
  // What you tapped, marked at once while hex takes it, and why if it didn't.
  const [sending, setSending] = useState<string>();
  const [failed, setFailed] = useState<string>();
  const [whole, setWhole] = useState(false);
  const choose = (option: AskOption) => {
    if (sending) return;
    setSending(option.label);
    setFailed(undefined);
    onAnswer(option).then(undefined, (error: unknown) => {
      setSending(undefined);
      setFailed(error instanceof Error ? error.message : 'That didn’t reach hex. Tap it again.');
    });
  };
  if (answer)
    return (
      <View style={styles.sent}>
        <View style={styles.check}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.sentText}>
          {`Sent ${answer} to ${ask.topic}`}
          <Text style={styles.quiet}>
            {ask.places.some((place) => place.app === 'telegram' && place.link)
              ? ' and cleared its Telegram buttons'
              : ''}
          </Text>
        </Text>
      </View>
    );
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={onOpenTask}>
          <Text style={styles.topic}>{`${ask.topic} ›`}</Text>
        </Pressable>
        {ask.tag ? <Text style={styles.tag}>{ask.tag}</Text> : null}
      </View>
      <View style={styles.asked}>
        <Text selectable style={styles.question}>
          {ask.question}
        </Text>
        {ask.context ? (
          <Text
            numberOfLines={whole ? undefined : 2}
            onPress={() => setWhole(!whole)}
            accessibilityHint={whole ? undefined : 'Shows all of it'}
            style={styles.context}
          >
            {ask.context}
          </Text>
        ) : null}
      </View>
      <View style={styles.options}>
        {ask.options.map((option) => (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityLabel={option.pick ? `${option.label}, hex’s pick` : option.label}
            accessibilityState={{ selected: sending === option.label, disabled: !!sending }}
            onPress={() => choose(option)}
            style={({ pressed }) => [
              styles.option,
              option.pick && styles.pick,
              (pressed || (sending && sending !== option.label)) && styles.pressed,
            ]}
          >
            <Text style={styles.optionText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      {ask.links?.length ? (
        <View style={styles.links}>
          {ask.links.map((link) => (
            <Pressable
              key={link.url}
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => void Linking.openURL(link.url)}
            >
              <Text style={styles.link}>{`${link.label} ↗`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {failed ? (
        <Text accessibilityRole="alert" style={[styles.hint, styles.failed]}>
          {failed}
        </Text>
      ) : (
        <Text style={styles.hint}>{sending ? `Sending ${sending}…` : 'Tap, or just say it'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: theme.surface,
    borderRadius: radius.group,
    borderCurve: 'continuous',
    padding: 14,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  topic: { color: theme.secondary, fontSize: 15, fontWeight: '600' },
  asked: { gap: 4, paddingHorizontal: 2 },
  question: { color: theme.text, fontSize: 17, lineHeight: 23 },
  context: { color: theme.secondary, fontSize: 15, lineHeight: 20 },
  tag: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: theme.surfaceSelected,
    borderRadius: radius.inner,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: radius.control,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: theme.surfaceSelected,
  },
  pick: { borderColor: theme.accent },
  pressed: { opacity: 0.6 },
  optionText: { color: theme.text, fontSize: 17 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingHorizontal: 2 },
  link: { color: theme.secondary, fontSize: 15 },
  hint: { color: theme.tertiary, fontSize: 13, textAlign: 'center' },
  failed: { color: theme.danger },
  sent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingRight: 24 },
  check: {
    ...circle(26),
    backgroundColor: theme.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: theme.accent, fontSize: 13, fontWeight: '700' },
  sentText: { flex: 1, color: theme.text, fontSize: 16, lineHeight: 22 },
  quiet: { color: theme.secondary },
});
