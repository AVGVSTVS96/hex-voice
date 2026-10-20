import { Host } from '@expo/ui/swift-ui';
import { useIsFocused, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Composer } from '@/components/chat/composer';
import { Markdown } from '@/components/chat/markdown';
import { ThreadsSheet, isGeneral, titleOf } from '@/components/chat/threads-sheet';
import { WorkCard } from '@/components/chat/work-card';
import { Glyph } from '@/components/glyph';
import { Persona } from '@/components/persona';
import { opalPaletteInput } from '@/components/persona/variants';
import { YourCall } from '@/components/tasks/ask-card';
import { useAsks } from '@/hooks/use-asks';
import { useCallPreferences } from '@/hooks/use-call-preferences';
import { useChat } from '@/hooks/use-chat';
import type { Sending } from '@/live/chat';
import { usePersonaPreference } from '@/hooks/use-persona-preference';
import { useSavedPreference } from '@/hooks/use-saved-preference';
import { useTask, useTaskCounts, useTasks } from '@/hooks/use-tasks';
import type { Ask } from '@/live/asks';
import type { Chat, TaskRow } from '@/live/tasks';
import { theme } from '@/theme';

// Chat holds a column this wide at most, so lines stay readable on iPad.
const COLUMN = 760;

const isThread = (value: unknown): value is string => typeof value === 'string';

// Chat with any of hex's threads, General first: what you and hex said, what it's doing now, what
// it needs you to decide, and what you sent that it hasn't picked up yet.
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { tasks, version } = useTasks(focused);
  const picked = useSavedPreference('chat.thread', '', isThread);
  const [listing, setListing] = useState(false);
  const row =
    tasks?.find((each) => each.id === picked.value) ?? tasks?.find(isGeneral) ?? tasks?.[0];
  return (
    <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {row ? (
        <Thread key={row.id} row={row} version={version} onThreads={() => setListing(true)} />
      ) : (
        <Text style={styles.reaching}>Reaching hex…</Text>
      )}
      <ThreadsSheet
        open={listing}
        rows={tasks ?? []}
        current={row?.id}
        onPick={(next) => {
          picked.setValue(next.id);
          setListing(false);
        }}
        onClose={() => setListing(false)}
      />
    </View>
  );
}

function Thread({
  row,
  version,
  onThreads,
}: {
  row: TaskRow;
  version: number | undefined;
  onThreads: () => void;
}) {
  const { chat, offline, pending, send, retry, stop } = useChat(row.id);
  const working = row.state === 'working';
  const task = useTask(working ? row.id : null, version);
  const yours = useAsks(true);
  const mine = yours.shown.filter((ask) => ask.task === row.id);
  const open = mine.filter((ask) => !yours.answered[ask.id]);
  // The chat shows what you just answered and the next couple of asks; the rest wait in Activity.
  const asks = mine.filter((ask) => yours.answered[ask.id] || open.indexOf(ask) < ASKS);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const column = Math.min(width, COLUMN) - 2 * GUTTER;
  const title = titleOf(row);
  const scroll = useRef<ScrollViewInstance>(null);
  const atEnd = useRef(true);

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.fill}>
      <Header
        title={title}
        status={statusOf(row, open, chat)}
        working={working}
        offline={offline}
        onThreads={onThreads}
      />
      <ScrollView
        ref={scroll}
        style={styles.fill}
        contentContainerStyle={styles.turns}
        keyboardDismissMode="interactive"
        onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
          atEnd.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
        }}
        scrollEventThrottle={64}
        onContentSizeChange={() => {
          if (atEnd.current) scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        <View style={[styles.column, { width: column }]}>
          {!chat ? null : chat.turns.length || pending.length ? (
            chat.turns.map((turn, i) =>
              turn.from === 'me' ? (
                <Mine key={i} text={turn.text} />
              ) : (
                <View key={i} style={styles.hex}>
                  <Markdown text={turn.text} />
                </View>
              ),
            )
          ) : (
            <Text style={styles.empty}>{`Nothing said in ${title} yet.`}</Text>
          )}
          {pending.map((sent) => (
            <Mine key={sent.key} text={sent.text} sending={sent} onRetry={() => retry(sent)} />
          ))}
          {working && <WorkCard line={row.line} plan={task?.plan ?? []} />}
          {asks.length > 0 && (
            <Host
              matchContents={{ vertical: true }}
              seedColor={theme.tint}
              style={[styles.asks, { width: column + 2 * GUTTER }]}
            >
              <YourCall
                asks={asks}
                answered={yours.answered}
                width={column + 2 * GUTTER}
                onAnswer={yours.answer}
                onUndo={(ask) => yours.undo(ask.id)}
              />
            </Host>
          )}
          {open.length > ASKS && (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate({ pathname: '/activity', params: { stage: 'needs' } })}
            >
              <Text
                style={styles.more}
              >{`${open.length - ASKS} more waiting on you · Activity`}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
      {!!chat?.waiting.length && (
        <View style={[styles.column, styles.next, { width: column }]}>
          <Text style={styles.nextHead}>Up next</Text>
          {chat.waiting.map((sent) => (
            <Text key={sent.key} numberOfLines={2} style={styles.nextText}>
              {sent.text}
            </Text>
          ))}
        </View>
      )}
      <View style={[styles.column, { width: Math.min(width, COLUMN) }]}>
        <Composer
          title={title}
          sends={chat?.sends ?? true}
          working={working}
          link={row.link}
          onSend={(text) => {
            atEnd.current = true;
            send(text);
          }}
          onStop={stop}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// The thread, hex's orb, and one line on how it's doing, the way OpenMuse heads its agent: what
// needs you, the step it's on, the next thing you sent, or that it's here. ☰ lists every thread;
// the bell opens what waits on you.
function Header({
  title,
  status,
  working,
  offline,
  onThreads,
}: {
  title: string;
  status: string;
  working: boolean;
  offline: boolean;
  onThreads: () => void;
}) {
  const router = useRouter();
  const { needs } = useTaskCounts();
  const { variant } = usePersonaPreference();
  const preferences = useCallPreferences();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Threads"
        testID="threads-button"
        onPress={onThreads}
        style={styles.tool}
      >
        <View pointerEvents="none">
          <Glyph name="line.3.horizontal" size={18} color={theme.text} />
        </View>
      </Pressable>
      <View pointerEvents="none" style={styles.orb}>
        <Persona
          variant={variant}
          state={working ? 'thinking' : 'idle'}
          size={ORB}
          color={preferences.personaColor}
          palette={opalPaletteInput(preferences.opalPalette)}
        />
      </View>
      <View style={styles.who}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.status}>
          {offline ? 'Can’t reach hex right now' : status}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={needs ? `${needs} waiting on you` : 'Nothing waits on you'}
        testID="bell-button"
        onPress={() => router.navigate({ pathname: '/activity', params: { stage: 'needs' } })}
        style={styles.tool}
      >
        <View pointerEvents="none">
          <Glyph name="bell" size={18} color={theme.text} />
          {needs > 0 && <View style={styles.bellDot} />}
        </View>
      </Pressable>
    </View>
  );
}

// What you said: in a bubble on the trailing side. One still on its way is faint, and one that
// didn't reach hex says so and sends again on a tap.
function Mine({
  text,
  sending,
  onRetry,
}: {
  text: string;
  sending?: Sending;
  onRetry?: () => void;
}) {
  return (
    <Pressable
      disabled={!sending?.failed}
      onPress={onRetry}
      style={styles.mine}
      accessibilityHint={sending?.failed ? 'Sends it again' : undefined}
    >
      <View style={[styles.bubble, sending && !sending.failed && styles.faint]}>
        <Text selectable style={styles.mineText}>
          {text}
        </Text>
      </View>
      {sending?.failed && <Text style={styles.failed}>Not sent · Tap to try again</Text>}
    </Pressable>
  );
}

// OpenMuse's status rules, in hex's terms.
function statusOf(row: TaskRow, open: Ask[], chat: Chat | undefined) {
  if (open.length) return `Needs your input · ${open[0]!.question}`;
  if (row.state === 'needs') return `Needs your input · ${row.line}`;
  if (row.state === 'working') return row.line || 'Working';
  if (chat?.waiting.length) return 'Picking up your next task…';
  if (row.state === 'done' && row.line) return `Ready to review · ${row.line}`;
  return 'Here when you need me';
}

const GUTTER = 16;
const ASKS = 2;
const ORB = 34;
const TOOL = 40;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.background },
  fill: { flex: 1 },
  reaching: { color: theme.secondary, fontSize: 15, textAlign: 'center', marginTop: 120 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tool: { width: TOOL, height: TOOL, alignItems: 'center', justifyContent: 'center' },
  orb: { width: ORB, height: ORB },
  who: { flex: 1, gap: 1 },
  title: { color: theme.text, fontSize: 17, fontWeight: '600' },
  status: { color: theme.secondary, fontSize: 13 },
  bellDot: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accent,
  },
  turns: { paddingTop: 8, paddingBottom: 16 },
  column: { alignSelf: 'center', gap: 18 },
  hex: { alignSelf: 'stretch' },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '85%', gap: 4 },
  bubble: {
    backgroundColor: theme.bubble,
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  faint: { opacity: 0.55 },
  mineText: { color: theme.text, fontSize: 17, lineHeight: 23 },
  failed: { color: theme.danger, fontSize: 13 },
  empty: { color: theme.secondary, fontSize: 15, textAlign: 'center', marginTop: 80 },
  asks: { marginHorizontal: -GUTTER },
  more: { color: theme.accent, fontSize: 15, fontWeight: '500' },
  next: { gap: 4, paddingBottom: 8 },
  nextHead: { color: theme.secondary, fontSize: 13, fontWeight: '600' },
  nextText: { color: theme.secondary, fontSize: 15 },
});
