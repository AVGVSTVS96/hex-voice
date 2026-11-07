import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { failure, openURL } from '@/hooks/use-failures';
import type { CallCard } from '@/live/agents';
import type { AskOption } from '@/live/asks';
import { reachedBy } from '@/live/inbox';
import { circle, theme } from '@/theme';
import { labelOf, radius, space, textOf } from '@/ui/tokens';

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
  if (card.answer && (sent || failed)) {
    setSent(undefined);
    setFailed(undefined);
  }
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
      <View style={styles.title}>
        <View style={styles.head}>
          <Pressable accessibilityRole="link" hitSlop={8} onPress={onOpenTask}>
            <Text style={styles.topic}>{`${ask.topic} ›`}</Text>
          </Pressable>
          {ask.tag ? <Text style={styles.tag}>{ask.tag}</Text> : null}
        </View>
        <Text selectable style={styles.question}>
          {ask.question}
        </Text>
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
    backgroundColor: theme.fill,
    borderRadius: radius.group,
    borderCurve: 'continuous',
    padding: space[4],
    gap: space[3],
  },
  title: { gap: space[2] },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    paddingHorizontal: space[0.5],
  },
  topic: { ...labelOf('caption', 'semibold'), color: theme.secondary },
  question: { ...textOf('body'), color: theme.text, paddingHorizontal: space[0.5] },
  tag: {
    ...labelOf('caption', 'semibold'),
    color: theme.text,
    backgroundColor: theme.fillStrong,
    borderRadius: radius.inner,
    overflow: 'hidden',
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.control,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: theme.fillStrong,
  },
  pick: { borderColor: theme.accent },
  pressed: { opacity: 0.6 },
  optionText: { ...labelOf('body'), color: theme.text },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[4],
    paddingHorizontal: space[0.5],
  },
  link: { ...labelOf('detail'), color: theme.secondary },
  hint: { ...labelOf('caption'), color: theme.tertiary, textAlign: 'center' },
  failed: { color: theme.danger },
  sent: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingRight: space[6] },
  check: {
    ...circle(26),
    backgroundColor: theme.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { ...labelOf('caption', 'semibold'), color: theme.accent },
  sentText: { ...textOf('body'), flex: 1, color: theme.text },
  quiet: { color: theme.secondary },
});
