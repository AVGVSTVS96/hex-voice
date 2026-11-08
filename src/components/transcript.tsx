import { useEffect, useRef, useState } from 'react';
import {
  type ScrollViewInstance,
  StyleSheet,
  Text,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { CallAsk } from '@/components/call-ask';
import { SentMedia } from '@/components/media/sent';
import type { CallCard } from '@/live/agents';
import type { AskOption } from '@/live/asks';
import type { TaskId } from '@/live/tasks';
import type { TranscriptEntry } from '@/live/types';
import { motion } from '@/motion';
import { theme } from '@/theme';
import { ScrollView } from '@/ui/scroll';
import { Turn } from '@/ui/turn';
import { metrics, space, textOf } from '@/ui/tokens';

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

// The call's words, newest at the foot. Where they have a page of their own (iPad), they read a
// size up, and before any are said the hint sits in the page's middle, level with the orb.
export const Transcript = ({
  entries,
  active,
  size = 'regular',
  emptyAt = 'end',
  cards = [],
  onAnswer,
  onOpenTask,
}: {
  entries: TranscriptEntry[];
  active: boolean;
  size?: 'regular' | 'large';
  emptyAt?: 'end' | 'center';
  cards?: CallCard[];
  onAnswer?: (card: CallCard, option: AskOption) => Promise<unknown>;
  onOpenTask?: (task: TaskId) => void;
}) => {
  const scroll = useRef<ScrollViewInstance>(null);
  const following = useRef(true);
  const touching = useRef(false);
  const visible = entries.filter((entry) => entry.media || entry.text.trim());
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
      contentContainerStyle={[
        styles.content,
        !moments.length && emptyAt === 'center' && styles.centered,
      ]}
    >
      {moments.length ? (
        moments.map((moment) =>
          'ask' in moment ? (
            <CallAsk
              key={`ask ${moment.ask.id}`}
              card={moment}
              onAnswer={(option) => onAnswer?.(moment, option) ?? Promise.resolve()}
              onOpenTask={() => onOpenTask?.(moment.ask.task)}
            />
          ) : moment.media ? (
            <SentMedia
              key={moment.id}
              id={moment.id}
              media={moment.media}
              sending={moment.sending}
              failed={moment.failed}
            />
          ) : (
            <Line key={moment.id} entry={moment} size={size} />
          ),
        )
      ) : (
        <Text style={styles.empty}>Your conversation will appear here.</Text>
      )}
    </ScrollView>
  );
};

// Each card sits where hex brought it up: before the first words said after it.
const interleave = (entries: TranscriptEntry[], cards: CallCard[]) => {
  const moments: (TranscriptEntry | CallCard)[] = [...entries];
  for (const card of [...cards].sort((a, b) => a.at - b.at)) {
    const after = moments.findIndex((moment) => !('ask' in moment) && moment.startMs > card.at);
    moments.splice(after < 0 ? moments.length : after, 0, card);
  }
  return moments;
};

const Line = ({ entry, size }: { entry: TranscriptEntry; size: 'regular' | 'large' }) => {
  const text = entry.text.trim();
  const [warm, settled] = useSettledLength(text.length);
  const user = entry.role === 'user';
  return (
    <Turn you={user}>
      <Text accessibilityLabel={`${user ? 'You' : 'hex'}: ${text}`} selectable style={styles[size]}>
        {text.slice(0, settled)}
        <Text style={styles.warm}>{text.slice(settled, warm)}</Text>
        <Text style={styles.fresh}>{text.slice(warm)}</Text>
      </Text>
    </Turn>
  );
};

const useSettledLength = (length: number) => {
  const [warm, setWarm] = useState(0);
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    setTimeout(() => setWarm((current) => Math.max(current, length)), motion.caption.warm);
    setTimeout(() => setSettled((current) => Math.max(current, length)), motion.caption.settled);
  }, [length]);
  return [Math.min(warm, length), Math.min(settled, length)] as const;
};

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    gap: space[6],
    paddingTop: metrics.fade,
    paddingBottom: metrics.fade,
  },
  centered: { justifyContent: 'center' },
  regular: { ...textOf('words'), color: theme.text },
  large: { ...textOf('words'), color: theme.text },
  warm: { color: theme.secondary },
  fresh: { color: theme.tertiary },
  empty: {
    ...textOf('body'),
    color: theme.secondary,
    textAlign: 'center',
    paddingBottom: space[3],
  },
});
