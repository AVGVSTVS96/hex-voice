import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { failure, openURL } from '@/hooks/use-failures';
import type { CallCard } from '@/live/agents';
import { PICK } from '@/live/asks';
import type { AskOption } from '@/live/asks';
import { reachedBy } from '@/live/inbox';
import { circle, theme } from '@/theme';
import { labelOf, metrics, radius, space, textOf } from '@/ui/tokens';

export const CallAsk = ({
  card,
  onAnswer,
  onOpenTask,
}: {
  card: CallCard;
  onAnswer: (option: AskOption) => Promise<void>;
  onOpenTask: () => void;
}) => {
  const { ask } = card;
  const [sending, setSending] = useState<string>();
  const [sent, setSent] = useState<string>();
  const [failed, setFailed] = useState<string>();

  if ((card.answer ?? '') !== '' && ((sent ?? '') !== '' || failed !== undefined)) {
    setSent(undefined);
    setFailed(undefined);
  }

  const answer = card.answer ?? sent;

  const choose = async (option: AskOption) => {
    if ((sending ?? '') !== '') {
      return;
    }

    setSending(option.label);
    setFailed(undefined);

    try {
      await onAnswer(option);
      setSending(undefined);
      setSent(option.label);
    } catch (error) {
      setSending(undefined);
      setFailed(failure('Not sent', error));
    }
  };

  if ((answer ?? '') !== '') {
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
  }

  return (
    <View style={styles.card}>
      <View style={styles.title}>
        <View style={styles.head}>
          <Pressable accessibilityRole="link" hitSlop={8} onPress={onOpenTask}>
            <Text style={styles.topic}>{`${ask.topic} ›`}</Text>
          </Pressable>
          {(ask.tag ?? '') === '' ? null : <Text style={styles.tag}>{ask.tag}</Text>}
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
            accessibilityLabel={option.pick === true ? `${option.label}, ${PICK}` : option.label}
            accessibilityState={{
              selected: sending === option.label,
              disabled: (sending ?? '') !== '',
            }}
            onPress={() => {
              void choose(option);
            }}
            style={({ pressed }) => [
              styles.option,
              option.pick === true && styles.pick,
              (pressed || ((sending ?? '') !== '' && sending !== option.label)) && styles.pressed,
            ]}
          >
            <Text style={[styles.optionText, option.pick === true && styles.pickText]}>
              {option.label}
            </Text>
            {option.pick === true ? <Text style={styles.pickNote}>{PICK}</Text> : null}
          </Pressable>
        ))}
      </View>
      {ask.links !== undefined && ask.links.length > 0 ? (
        <View style={styles.links}>
          {ask.links.map((link) => (
            <Pressable
              key={link.url}
              accessibilityRole="link"
              hitSlop={8}
              onPress={async () => {
                try {
                  await openURL(link.url);
                } catch (error) {
                  setFailed(failure('Not opened', error));
                }
              }}
            >
              <Text style={styles.link}>{`${link.label} ↗`}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {failed === undefined ? (
        <Text style={styles.hint}>
          {sending === undefined || sending === '' ? 'Tap, or just say it' : `Sending ${sending}…`}
        </Text>
      ) : (
        <Text accessibilityRole="alert" style={[styles.hint, styles.failed]}>
          {failed}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: theme.surface,
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
  topic: { ...labelOf('caption', 'medium'), color: theme.secondary },
  question: { ...textOf('headline'), color: theme.text, paddingHorizontal: space[0.5] },
  tag: {
    ...labelOf('caption', 'medium'),
    color: theme.text,
    backgroundColor: theme.surfaceSelected,
    borderRadius: radius.inner,
    overflow: 'hidden',
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  option: {
    minHeight: metrics.pill.regular,
    justifyContent: 'center',
    paddingHorizontal: space[4],
    borderRadius: radius.option,
    borderCurve: 'continuous',
    backgroundColor: theme.surfaceSelected,
  },
  pick: { backgroundColor: theme.accentMuted, paddingVertical: space[2] },
  pickText: { ...labelOf('body', 'medium'), color: theme.text },
  pickNote: { ...labelOf('caption'), color: theme.accent },
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
    backgroundColor: theme.surfaceSelected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { ...labelOf('caption', 'medium'), color: theme.secondary },
  sentText: { ...textOf('body'), flex: 1, color: theme.text },
  quiet: { color: theme.secondary },
});
