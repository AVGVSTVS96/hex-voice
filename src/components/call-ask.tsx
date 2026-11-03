import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { failure, openURL } from '@/hooks/use-failures';
import type { CallCard } from '@/live/agents';
import type { AskOption } from '@/live/asks';
import { reachedBy } from '@/live/inbox';
import { circle, radius, theme } from '@/theme';

// An ask hex brought up on the call, as a card in the transcript: tap a choice or just say it, or
// open a page it points to. Its topic opens the task it belongs to. Once answered, it folds to what
// was sent where and what that reached, as hex recorded it, and an undo opens it again.
export function CallAsk({
  card,
  onAnswer,
  onOpenTask,
}: {
  card: CallCard;
  onAnswer: (option: AskOption) => Promise<unknown>;
  onOpenTask: () => void;
}) {
  const { ask } = card;
  // What you tapped, marked at once while hex takes it, sent once it has until hex's record of the
  // call says so, and why if it didn't.
  const [sending, setSending] = useState<string>();
  const [sent, setSent] = useState<string>();
  const [failed, setFailed] = useState<string>();
  if (card.answer && sent) setSent(undefined);
  const answer = card.answer ?? sent;
  const choose = (option: AskOption) => {
    if (sending) return;
    setSending(option.label);
    setFailed(undefined);
    onAnswer(option).then(
      () => {
        setSending(undefined);
        setSent(option.label);
      },
      (error: unknown) => {
        setSending(undefined);
        setFailed(failure('Not sent', error));
      },
    );
  };
  if (answer)
    return (
      <View style={styles.sent}>
        <View style={styles.check}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.sentText}>
          {`Sent ${answer} to ${ask.topic}`}
          <Text style={styles.quiet}>{reachedBy(ask, card.sent)}</Text>
        </Text>
      </View>
    );
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={onOpenTask}>
          <Text style={styles.topic}>{`${ask.topic} ›`}</Text>
        </Pressable>
        <Text selectable style={styles.question}>
          {ask.question}
        </Text>
        {ask.tag ? <Text style={styles.tag}>{ask.tag}</Text> : null}
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
              onPress={() =>
                openURL(link.url).catch((error: Error) => setFailed(failure('Not opened', error)))
              }
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
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 2 },
  topic: { color: theme.secondary, fontSize: 15, fontWeight: '600' },
  question: { flex: 1, color: theme.tertiary, fontSize: 15 },
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
