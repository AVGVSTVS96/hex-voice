import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';

import { errorOf, footerOf } from '@/call/call';
import type { Call } from '@/call/call';
import { WrapUp } from '@/components/wrap-up';
import type { CallSummary } from '@/live/calls';
import { motion } from '@/motion';
import { theme } from '@/theme';
import { metrics, space, textOf } from '@/ui/tokens';

interface Props {
  call: Call;
  // A past call on screen, which hides how the last one ended.
  viewing: boolean;
  // hex's calls, where the one that just ended finds its wrap-up.
  calls: CallSummary[] | undefined;
  // What an action on this call couldn't do.
  trouble: string | undefined;
  // Words that start at the leading edge, where the call shares the screen.
  leading: boolean;
  style: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  onLayout: (event: LayoutChangeEvent) => void;
  onOpen: (call: string) => void;
  onMore: () => void;
  children?: ReactNode;
}

// Under the call: hex's wrap-up and how the last call ended, where a call held elsewhere is, that
// iOS paused the microphone, what didn't go through, and on the phone the call buttons.
export const CallFooter = ({
  call,
  viewing,
  calls,
  trouble,
  leading,
  style,
  onLayout,
  onOpen,
  onMore,
  children,
}: Props) => {
  const footing = footerOf(call, viewing);
  const ended = footing?.kind === 'ended' ? footing : undefined;
  const wrapUp = ended && calls?.find(({ id }) => id === ended.id);
  const error = trouble ?? errorOf(call) ?? '';

  return (
    <Animated.View pointerEvents="box-none" onLayout={onLayout} style={[styles.footer, style]}>
      {wrapUp && hasWrapUp(wrapUp) ? (
        <Animated.View
          entering={FadeIn.duration(motion.toolbar)}
          style={[styles.wrapUp, leading && styles.leading]}
        >
          {(wrapUp.title ?? '') === '' ? null : (
            <Text numberOfLines={1} style={styles.wrapTitle}>
              {wrapUp.title}
            </Text>
          )}
          <WrapUp
            center={!leading}
            onOpen={() => {
              onOpen(wrapUp.id);
            }}
            summary={wrapUp.summary}
            waiting={wrapUp.waiting}
            onMore={onMore}
          />
        </Animated.View>
      ) : null}
      {footing ? (
        <Text
          accessibilityRole={footing.kind === 'elsewhere' ? undefined : 'alert'}
          style={[styles.ended, leading && styles.leadingText, ended?.bad === true && styles.bad]}
        >
          {footing.text}
        </Text>
      ) : null}
      {error === '' ? null : (
        <Text accessibilityRole="alert" style={[styles.error, leading && styles.leadingText]}>
          {error}
        </Text>
      )}
      {children}
    </Animated.View>
  );
};

const hasWrapUp = ({ title, summary, waiting }: CallSummary) =>
  (title ?? '') !== '' || (summary ?? '') !== '' || (waiting ?? []).length > 0;

const styles = StyleSheet.create({
  footer: { position: 'absolute', bottom: 0, gap: metrics.footerGap },
  wrapUp: { gap: space[3], alignItems: 'center' },
  leading: { alignItems: 'flex-start' },
  leadingText: { textAlign: 'left', paddingHorizontal: 0 },
  wrapTitle: { ...textOf('headline'), color: theme.text },
  ended: { ...textOf('detail'), color: theme.secondary, textAlign: 'center' },
  bad: { color: theme.danger },
  error: {
    ...textOf('detail'),
    color: theme.danger,
    textAlign: 'center',
    paddingHorizontal: space[3],
  },
});
