import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { CallAsk } from '@/components/call-ask';
import type { CallCard } from '@/live/agents';
import type { AskOption } from '@/live/asks';
import type { TranscriptEntry } from '@/live/types';
import { motion } from '@/motion';
import { theme } from '@/theme';

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

export function Transcript({
  entries,
  active,
  cards = [],
  onAnswer,
  onOpenTask,
}: {
  entries: TranscriptEntry[];
  active: boolean;
  cards?: CallCard[];
  onAnswer?: (card: CallCard, option: AskOption) => void;
  onOpenTask?: (task: string) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  const following = useRef(true);
  const touching = useRef(false);
  const visible = entries.filter((entry) => entry.text.trim());
  const moments = interleave(visible, cards);

  useEffect(() => {
    if (!active) return;
    following.current = true;
    scroll.current?.scrollToEnd({ animated: false });
  }, [active]);

  const follow = ({
    nativeEvent: { contentOffset, contentSize, layoutMeasurement },
  }: ScrollEvent) => {
    following.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 40;
  };

  return (
    <ScrollView
      ref={scroll}
      scrollEventThrottle={32}
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={() => {
        touching.current = true;
      }}
      onScrollEndDrag={(event) => {
        touching.current = false;
        follow(event);
      }}
      onMomentumScrollEnd={follow}
      onScroll={(event) => {
        if (touching.current) follow(event);
      }}
      onContentSizeChange={() => {
        if (following.current) scroll.current?.scrollToEnd({ animated: active });
      }}
      contentContainerStyle={styles.content}
    >
      {moments.length ? (
        moments.map((moment) =>
          'ask' in moment ? (
            <CallAsk
              key={`ask ${moment.ask.id}`}
              card={moment}
              onAnswer={(option) => onAnswer?.(moment, option)}
              onOpenTask={() => onOpenTask?.(moment.ask.task)}
            />
          ) : (
            <Line key={moment.id} entry={moment} />
          ),
        )
      ) : (
        <Text style={styles.empty}>Your conversation will appear here.</Text>
      )}
    </ScrollView>
  );
}

// Each card sits where hex brought it up: before the first words said after it.
function interleave(entries: TranscriptEntry[], cards: CallCard[]) {
  const moments: (TranscriptEntry | CallCard)[] = [...entries];
  for (const card of [...cards].sort((a, b) => a.at - b.at)) {
    const after = moments.findIndex((moment) => !('ask' in moment) && moment.startMs > card.at);
    moments.splice(after < 0 ? moments.length : after, 0, card);
  }
  return moments;
}

function Line({ entry }: { entry: TranscriptEntry }) {
  const text = entry.text.trim();
  const [warm, settled] = useSettledLength(text.length);
  const user = entry.role === 'user';
  return (
    <View style={user ? styles.user : styles.assistant}>
      <Text accessibilityLabel={`${user ? 'You' : 'hex'}: ${text}`} selectable style={styles.text}>
        {text.slice(0, settled)}
        <Text style={styles.warm}>{text.slice(settled, warm)}</Text>
        <Text style={styles.fresh}>{text.slice(warm)}</Text>
      </Text>
    </View>
  );
}

function useSettledLength(length: number) {
  const [warm, setWarm] = useState(0);
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    setTimeout(() => setWarm((current) => Math.max(current, length)), motion.caption.warm);
    setTimeout(() => setSettled((current) => Math.max(current, length)), motion.caption.settled);
  }, [length]);
  return [Math.min(warm, length), Math.min(settled, length)] as const;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'flex-end', gap: 24, paddingTop: 36, paddingBottom: 4 },
  user: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    backgroundColor: theme.bubble,
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  assistant: { alignSelf: 'flex-start', maxWidth: '96%' },
  text: { color: theme.text, fontSize: 17, lineHeight: 25 },
  warm: { color: theme.secondary },
  fresh: { color: theme.tertiary },
  empty: {
    color: theme.secondary,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingBottom: 12,
  },
});
