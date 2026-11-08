import { Column, Icon, Row, Spacer } from '@expo/ui';
import {
  accessibilityElement,
  accessibilityLabel,
  background,
  clipShape,
  contentShape,
  frame,
  layoutPriority,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { Mark } from '@/components/tasks/mark';
import { Pill, questions, listRow } from '@/components/tasks/parts';
import { checkLine, type CheckSummary } from '@/live/asks';
import type { Topic } from '@/live/inbox';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { metrics, radius, space } from '@/ui/tokens';

export function TopicHead({ topic, onPress }: { topic: Topic; onPress?: () => void }) {
  return (
    <Row
      alignment="center"
      spacing={space[2]}
      onPress={onPress}
      modifiers={[
        padding({
          leading: metrics.list.inset,
          trailing: metrics.list.inset,
          top: space[5],
          bottom: space[1],
        }),
        frame({ maxWidth: Infinity }),
        contentShape(shapes.rectangle()),
        ...listRow(),
        ...(onPress ? [accessibilityLabel(`${topic.name}. Opens it`)] : []),
      ]}
    >
      <Text numberOfLines={1} variant="headline" modifiers={[layoutPriority(1)]}>
        {topic.name}
      </Text>
      <Spacer flexible />
      {onPress ? (
        <Icon name="chevron.right" size={metrics.symbol.small} color={theme.tertiary} />
      ) : null}
    </Row>
  );
}

// Something about the whole list, apart from its projects: a card on the ground with its one
// action as a pill.
function Strip({
  mark,
  title,
  detail,
  action,
  label,
  testID,
  selected = false,
  onPress,
}: {
  mark: 'pick' | 'read';
  title: string;
  detail?: string;
  action?: string;
  label: string;
  testID?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={metrics.list.gap}
      onPress={onPress}
      testID={testID}
      modifiers={[
        padding({
          leading: space[3],
          trailing: action ? space[2] : space[4],
          top: space[2],
          bottom: space[2],
        }),
        frame({ minHeight: metrics.pill.regular + space[4] }),
        frame({ maxWidth: Infinity }),
        background(selected ? theme.fill : theme.card),
        clipShape('roundedRectangle', radius.group),
        contentShape(shapes.rectangle()),
        padding({
          leading: metrics.list.inset - space[3],
          trailing: metrics.list.inset - space[3],
          top: space[1],
          bottom: space[2],
        }),
        ...listRow(),
        accessibilityElement('combine'),
        accessibilityLabel(label),
      ]}
    >
      <Mark state={mark} />
      <Column
        alignment="start"
        spacing={0}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text numberOfLines={2} variant="body">
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={2} variant="detail" tone="secondary">
            {detail}
          </Text>
        ) : null}
      </Column>
      {action ? (
        <Pill label={action} onPress={onPress} small />
      ) : (
        <Icon name="chevron.right" size={metrics.symbol.small} color={theme.tertiary} />
      )}
    </Row>
  );
}

export function CheckRow({
  check,
  selected,
  onPress,
}: {
  check: CheckSummary;
  selected: boolean;
  onPress: () => void;
}) {
  const { title, did } = checkLine(check);
  return (
    <Strip
      mark="read"
      selected={selected}
      title={title}
      detail={did}
      label={`${title}${did ? `, ${did}` : ''}. Opens the last check`}
      onPress={onPress}
    />
  );
}

// Opens hex's picks on a page of their own, to look over before taking them.
export function PicksRow({
  n,
  selected,
  onOpen,
}: {
  n: number;
  selected: boolean;
  onOpen: () => void;
}) {
  return (
    <Strip
      selected={selected}
      mark="pick"
      title={`hex picked for ${questions(n)}`}
      label={`hex picked for ${questions(n)}. Opens them`}
      testID="picks-open"
      onPress={onOpen}
    />
  );
}
