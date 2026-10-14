import { Column, Icon, Row, ScrollView, Spacer, Text } from '@expo/ui';
import {
  accessibilityLabel,
  animation,
  background,
  clipShape,
  contentShape,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { AskCard, FoldedAsk } from '@/components/tasks/ask-card';
import { GroupHead, INSET, Mark, ios } from '@/components/tasks/parts';
import {
  FILTERS,
  checkLine,
  type Ask,
  type AskFilter,
  type AskOption,
  type CheckSummary,
  type Fresh,
  type Stuck,
} from '@/live/asks';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';

// "Checked 6:31pm · fixed 4 · flagged 3", opening what the check read, fixed and flagged.
export function CheckStrip({ check, onPress }: { check: CheckSummary; onPress: () => void }) {
  const { title, did } = checkLine(check);
  return (
    <Row
      alignment="center"
      spacing={12}
      onPress={onPress}
      modifiers={[
        padding({ leading: 14, trailing: 16 }),
        frame({ height: 52 }),
        frame({ maxWidth: Infinity }),
        background(theme.group),
        clipShape('roundedRectangle', 18),
        contentShape(shapes.rectangle()),
        ...(ios
          ? [accessibilityLabel(`${title}${did ? `, ${did}` : ''}. Opens the last check`)]
          : []),
      ]}
    >
      <Mark state="done" />
      <Text
        textStyle={{ fontSize: 16, fontWeight: '500' }}
        modifiers={[foregroundStyle(theme.text)]}
      >
        {title}
      </Text>
      <Text
        numberOfLines={1}
        textStyle={{ fontSize: 15 }}
        modifiers={[foregroundStyle(theme.secondary)]}
      >
        {did}
      </Text>
      <Spacer flexible />
      <Icon name="chevron.right" size={13} color={theme.tertiary} />
    </Row>
  );
}

// Starts a call that walks the asks with hex, one at a time.
export function GoThrough({ onPress }: { onPress: () => void }) {
  return (
    <Row
      alignment="center"
      spacing={10}
      onPress={onPress}
      modifiers={[
        frame({ height: 56 }),
        frame({ maxWidth: Infinity }),
        background(theme.prominent),
        clipShape('capsule'),
        contentShape(shapes.capsule()),
        ...(ios ? [accessibilityLabel('Go through them with hex, on a call')] : []),
      ]}
    >
      <Spacer flexible />
      <Icon name="waveform" size={17} color={theme.onProminent} />
      <Text
        textStyle={{ fontSize: 18, fontWeight: '600' }}
        modifiers={[foregroundStyle(theme.onProminent)]}
      >
        Go through them with hex
      </Text>
      <Spacer flexible />
    </Row>
  );
}

export function Filters({
  filter,
  counts,
  onChange,
}: {
  filter: AskFilter;
  counts: Record<AskFilter, number>;
  onChange: (filter: AskFilter) => void;
}) {
  return (
    <ScrollView
      direction="horizontal"
      showsIndicators={false}
      modifiers={[frame({ maxWidth: Infinity })]}
    >
      <Row
        alignment="center"
        spacing={8}
        modifiers={[padding({ leading: INSET, trailing: INSET })]}
      >
        {FILTERS.filter(({ key }) => key === 'all' || counts[key]).map(({ key, title }) => {
          const on = key === filter;
          return (
            <Row
              key={key}
              alignment="center"
              spacing={6}
              onPress={() => onChange(key)}
              modifiers={[
                padding({ leading: 16, trailing: 16 }),
                frame({ height: 38 }),
                background(on ? theme.prominent : theme.surface),
                clipShape('capsule'),
                contentShape(shapes.capsule()),
                ...(ios
                  ? [accessibilityLabel(`${title}, ${counts[key]}${on ? ', shown' : ''}`)]
                  : []),
              ]}
            >
              <Text
                textStyle={{ fontSize: 16, fontWeight: '600' }}
                modifiers={[foregroundStyle(on ? theme.onProminent : theme.text)]}
              >
                {title}
              </Text>
              <Text
                textStyle={{ fontSize: 16 }}
                modifiers={[foregroundStyle(on ? theme.onProminent : theme.secondary)]}
              >
                {String(counts[key])}
              </Text>
            </Row>
          );
        })}
      </Row>
    </ScrollView>
  );
}

// The asks as cards. One you answer folds where it sits to what you said, with Undo, and the cards
// under it close up; Undo opens it again in the same place.
export function AskList({
  asks,
  answered,
  onAnswer,
  onUndo,
  onOpenTask,
}: {
  asks: Ask[];
  answered: Record<string, string | null>;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onOpenTask: (task: string) => void;
}) {
  const label = (ask: Ask) => answered[ask.id];
  return (
    <Column
      alignment="start"
      spacing={12}
      modifiers={[
        padding({ leading: 16, trailing: 16, top: 8, bottom: 8 }),
        frame({ maxWidth: Infinity }),
        animation(motion.list, rowsKey(asks.map((ask) => `${ask.id}=${label(ask) ?? ''}`))),
      ]}
    >
      {asks.map((ask) => {
        const said = label(ask);
        return said ? (
          <FoldedAsk key={ask.id} ask={ask} label={said} onUndo={() => onUndo(ask)} />
        ) : (
          <AskCard key={ask.id} ask={ask} onAnswer={onAnswer} onOpenTask={onOpenTask} />
        );
      })}
    </Column>
  );
}

// A row with its mark, a title and one line under it, and one action at its end.
function ActionRow({
  mark,
  title,
  text,
  action,
  strong = true,
  onAction,
}: {
  mark: 'paused' | 'failed' | 'done';
  title: string;
  text: string;
  action?: string;
  strong?: boolean;
  onAction?: () => void;
}) {
  return (
    <Row
      alignment="start"
      spacing={12}
      modifiers={[
        padding({ leading: INSET, trailing: INSET, top: 10, bottom: 10 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
      ]}
    >
      <Mark state={mark} />
      <Column
        alignment="start"
        spacing={3}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text
          textStyle={{ fontSize: 17, lineHeight: 21, fontWeight: strong ? '600' : '400' }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          {title}
        </Text>
        {text ? (
          <Text
            textStyle={{ fontSize: 15, lineHeight: 19 }}
            modifiers={[foregroundStyle(theme.secondary)]}
          >
            {text}
          </Text>
        ) : null}
      </Column>
      {action ? (
        <Text
          onPress={onAction}
          textStyle={{ fontSize: 15, fontWeight: '600' }}
          modifiers={[
            foregroundStyle(onAction ? theme.text : theme.tertiary),
            padding({ leading: 14, trailing: 14, top: 9, bottom: 9 }),
            background(theme.surface),
            clipShape('capsule'),
            ...(ios ? [accessibilityLabel(`${action}: ${title}`)] : []),
          ]}
        >
          {action}
        </Text>
      ) : null}
    </Row>
  );
}

// What stopped with nobody moving it, each with its one action. Once its request is with hex,
// the action says so until the thing itself changes.
export function StuckList({ stuck, onAct }: { stuck: Stuck[]; onAct: (item: Stuck) => void }) {
  if (!stuck.length) return null;
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[
        animation(motion.list, rowsKey(stuck.map((item) => `${item.id}${item.sent ? '>' : ''}`))),
      ]}
    >
      <GroupHead title="Stuck" count={stuck.length} />
      {stuck.map((item) => (
        <ActionRow
          key={item.id}
          mark={item.mark}
          title={item.title}
          text={item.why}
          action={item.sent ? 'Sent to hex' : item.action}
          onAction={item.sent ? undefined : () => onAct(item)}
        />
      ))}
    </Column>
  );
}

// What finished since you last looked, in its own last words; unread ones are bold until Read.
export function FreshList({ fresh, onRead }: { fresh: Fresh[]; onRead: (item: Fresh) => void }) {
  if (!fresh.length) return null;
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[
        animation(motion.list, rowsKey(fresh.map((item) => `${item.id}${item.read ? '.' : ''}`))),
      ]}
    >
      <GroupHead title="New since you looked" count={fresh.filter((item) => !item.read).length} />
      {fresh.map((item) => (
        <ActionRow
          key={item.id}
          mark="done"
          strong={!item.read}
          title={item.title}
          text={`${item.line} · ${item.where}`}
          action={item.read ? undefined : 'Read'}
          onAction={() => onRead(item)}
        />
      ))}
    </Column>
  );
}
