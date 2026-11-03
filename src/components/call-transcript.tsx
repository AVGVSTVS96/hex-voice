import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ColorValue,
} from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Glyph } from '@/components/glyph';
import { WrapUp } from '@/components/wrap-up';
import {
  ENDINGS,
  SOURCES,
  clock,
  timeOfDay,
  timeline,
  type CallRecord,
  type CallSummary,
  type CallTask,
  type ShownMark,
} from '@/live/calls';
import { circle, theme } from '@/theme';
import { Turn } from '@/ui/turn';
import { metrics, space, textOf } from '@/ui/tokens';

const MARKS: Record<ShownMark['kind'], SFSymbol> = {
  paused: 'pause.circle',
  resumed: 'play.circle',
  warned: 'timer',
};

const MARKERS: Record<
  CallTask['state'],
  { symbol: SFSymbol; color: ColorValue; fill: ColorValue }
> = {
  running: { symbol: 'circle.dotted', color: theme.accent, fill: theme.accentMuted },
  done: { symbol: 'checkmark', color: theme.accent, fill: theme.accentMuted },
  failed: { symbol: 'exclamationmark', color: theme.danger, fill: theme.dangerMuted },
};

type Props = { summary: CallSummary; call?: CallRecord; failed: boolean; live: boolean };

export function CallTranscript({ summary, call, failed, live }: Props) {
  const ending = summary.end && !live ? ENDINGS[summary.end] : undefined;
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Line symbol={SOURCES[summary.from].symbol}>
        {`${SOURCES[summary.from].started} · ${timeOfDay(summary.started)}`}
      </Line>
      <WrapUp
        why={summary.why ?? call?.why}
        summary={summary.summary ?? call?.summary}
        waiting={summary.waiting ?? call?.waiting}
      />
      {call ? (
        timeline(call).map((moment) =>
          moment.kind === 'task' ? (
            <Marker key={moment.key} task={moment.task} />
          ) : moment.kind === 'mark' ? (
            <Line key={moment.key} symbol={MARKS[moment.mark.kind]}>
              {`${moment.mark.text} · ${clock(moment.at)}`}
            </Line>
          ) : (
            <Turn key={moment.key} you={moment.turn.who === 'you'}>
              <Text selectable style={styles.text}>
                {moment.turn.text}
              </Text>
            </Turn>
          ),
        )
      ) : failed ? (
        <Text style={styles.note}>hex didn’t answer, so this call can’t open yet.</Text>
      ) : (
        <ActivityIndicator color={theme.secondary} style={styles.loading} />
      )}
      {call && ending && (
        <Line symbol="phone.down" bad={ending.bad}>
          {`${ending.line} · ${clock(summary.seconds * 1000)}`}
        </Line>
      )}
    </ScrollView>
  );
}

function Line({ symbol, bad, children }: { symbol: SFSymbol; bad?: boolean; children: string }) {
  const color = bad ? theme.danger : theme.secondary;
  return (
    <View style={styles.line}>
      <Glyph name={symbol} size={13} color={color} />
      <Text style={[styles.lineText, { color }]}>{children}</Text>
    </View>
  );
}

function Marker({ task }: { task: CallTask }) {
  const look = MARKERS[task.state];
  return (
    <View style={styles.marker}>
      <View style={[styles.dot, { backgroundColor: look.fill }]}>
        <Glyph name={look.symbol} size={10} color={look.color} />
      </View>
      <Text style={styles.task}>{task.text}</Text>
      <Text style={styles.at}>{clock(task.at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[6], paddingTop: metrics.fade, paddingBottom: metrics.fade },
  line: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
  },
  lineText: textOf('footnote'),
  text: { ...textOf('words'), color: theme.text },
  marker: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2.5] },
  dot: {
    ...circle(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  task: { ...textOf('subheadline', 'medium'), flex: 1, color: theme.text },
  at: { ...textOf('tag'), color: theme.tertiary, fontVariant: ['tabular-nums'] },
  note: { ...textOf('callout'), color: theme.secondary, textAlign: 'center' },
  loading: { marginTop: space[10] },
});
