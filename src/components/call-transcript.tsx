import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Glyph } from '@/components/glyph';
import {
  ENDINGS,
  SOURCES,
  clock,
  timeOfDay,
  timeline,
  type CallRecord,
  type CallSummary,
  type CallTask,
} from '@/live/calls';
import { theme } from '@/theme';

const MARKERS: Record<CallTask['state'], { symbol: SFSymbol; color: string; fill: string }> = {
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
      {call ? (
        timeline(call).map((moment) =>
          moment.kind === 'task' ? (
            <Marker key={moment.key} task={moment.task} />
          ) : moment.turn.who === 'you' ? (
            <View key={moment.key} style={styles.you}>
              <Text selectable style={styles.text}>
                {moment.turn.text}
              </Text>
            </View>
          ) : (
            <Text key={moment.key} selectable style={[styles.text, styles.voice]}>
              {moment.turn.text}
            </Text>
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
  content: { gap: 22, paddingTop: 36, paddingBottom: 24 },
  line: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lineText: { fontSize: 13, lineHeight: 18 },
  you: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    backgroundColor: theme.bubble,
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  voice: { alignSelf: 'flex-start', maxWidth: '96%' },
  text: { color: theme.text, fontSize: 17, lineHeight: 25 },
  marker: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  task: { flex: 1, color: theme.text, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  at: { color: theme.tertiary, fontSize: 13, lineHeight: 22, fontVariant: ['tabular-nums'] },
  note: { color: theme.secondary, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  loading: { marginTop: 40 },
});
