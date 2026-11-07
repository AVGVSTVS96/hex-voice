import { Column, Icon, Row, Spacer } from '@expo/ui';
import { Button, Mask, ProgressView, Rectangle } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityLabel,
  alignmentGuide,
  background,
  clipShape,
  contentShape,
  foregroundStyle,
  frame,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  monospacedDigit,
  padding,
  shapes,
  tint,
  type ModifierConfig,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Children, isValidElement, type ReactNode } from 'react';

import { Badge, inkOf, type Tint } from '@/components/tasks/mark';
import type { Answered } from '@/hooks/use-watch';
import { NOT_NEEDED, PICK } from '@/live/asks';
import { hairline, theme } from '@/theme';
import { Text } from '@/ui/text';
import { mask, metrics, radius, space } from '@/ui/tokens';

// Counts say what they count, so a stage tab's number and an ask count read as different things.
export const asks = (n: number) => `${n} ask${n === 1 ? '' : 's'}`;

export function feel(haptics: boolean) {
  const on = haptics;
  return {
    tick: () => {
      if (on) void Haptics.selectionAsync();
    },
    tap: () => {
      if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  };
}

export type Feel = ReturnType<typeof feel>;

// No inset, fill or line of its own, so the list's ground shows behind it and rows part by the
// air between them, as Muse's do. Lines part sections, never rows.
export function listRow(width: number): ModifierConfig[] {
  return [
    listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
    listRowBackground('transparent'),
    listRowSeparator('hidden'),
    alignmentGuide('listRowSeparatorLeading', 0),
    alignmentGuide('listRowSeparatorTrailing', width),
  ];
}

// A row's padding, inside the rounded fill that shows it's the one open beside the list.
export function rowFrame(selected: boolean, { top = metrics.list.row.top } = {}) {
  return [
    padding({
      leading: metrics.list.inset - space[2],
      trailing: metrics.list.inset - space[2],
      top,
      bottom: metrics.list.row.bottom,
    }),
    frame({ maxWidth: Infinity, alignment: 'leading' }),
    ...(selected ? [background(theme.card)] : []),
    clipShape('roundedRectangle', radius.control),
    contentShape(shapes.rectangle()),
    padding({ leading: space[2], trailing: space[2] }),
  ];
}

// Muse's button: a gray capsule. hex's pick is tinted mint and says so, so it reads as a
// suggestion, never as already chosen. `grow` shares a row with the others; `small` sits at the
// end of a line of text and marks the pick with a sparkle alone.
export function Pill({
  label,
  onPress,
  pick = false,
  small = false,
  grow = false,
  icon,
  accessibility,
  testID,
}: {
  label: string;
  onPress?: () => void;
  pick?: boolean;
  small?: boolean;
  grow?: boolean;
  icon?: SFSymbol;
  accessibility?: string;
  testID?: string;
}) {
  const ink = onPress ? 'text' : 'tertiary';
  const mark = pick ? 'sparkle' : icon;
  return (
    <Row
      alignment="center"
      spacing={space[2]}
      onPress={onPress}
      testID={testID}
      modifiers={[
        padding({ leading: small ? space[3] : space[4], trailing: small ? space[3] : space[4] }),
        frame({ minHeight: small ? metrics.pill.small : metrics.pill.regular }),
        ...(grow ? [frame({ maxWidth: Infinity })] : []),
        background(pick ? theme.accentMuted : theme.fill),
        clipShape('capsule'),
        contentShape(shapes.capsule()),
        accessibilityElement('combine'),
        accessibilityLabel(accessibility ?? (pick ? `${label}, ${PICK}` : label)),
        accessibilityAddTraits(['isButton']),
      ]}
    >
      {mark ? (
        <Icon name={mark} size={metrics.symbol.small} color={theme[pick ? 'accent' : ink]} />
      ) : null}
      <Column alignment={grow ? 'center' : 'start'} spacing={0}>
        <Text
          numberOfLines={grow ? 2 : 1}
          variant={small ? 'detail' : 'body'}
          weight={pick ? 'medium' : 'regular'}
          tone={ink}
          align={grow ? 'center' : undefined}
        >
          {label}
        </Text>
        {pick && !small ? (
          <Text numberOfLines={1} variant="caption" tone="accent">
            {PICK}
          </Text>
        ) : null}
      </Column>
    </Row>
  );
}

// Puts an ask away without an answer: a row's swipe action at the trailing edge, where iOS puts the
// one that clears a row, so a full swipe left takes it, as it does in Mail.
export function NotNeededButton({ onPress }: { onPress: () => void }) {
  return (
    <Button
      label={NOT_NEEDED}
      systemImage="xmark"
      onPress={onPress}
      modifiers={[tint(theme.secondary)]}
    />
  );
}

// A section's quiet name, like Muse's Connected and Available: gray, at detail size.
export function SectionHead({
  title,
  count,
  opens = false,
}: {
  title: string;
  count?: string | number;
  opens?: boolean;
}) {
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        padding({
          leading: metrics.list.inset,
          trailing: metrics.list.inset,
          top: space[6],
          bottom: space[2],
        }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Text variant="detail" tone="secondary">
        {title}
      </Text>
      <Spacer flexible />
      {count !== undefined ? (
        <Text variant="caption" tone="tertiary" modifiers={[monospacedDigit()]}>
          {String(count)}
        </Text>
      ) : null}
      {opens ? (
        <Icon
          name="chevron.right"
          size={metrics.symbol.small}
          color={theme.tertiary}
          modifiers={[padding({ leading: space[2] })]}
        />
      ) : null}
    </Row>
  );
}

// A section that holds a state: its name in that state's color on a tinted dot, its count beside.
export function StageHead({ tint, title, count }: { tint: Tint; title: string; count?: number }) {
  return (
    <Row
      alignment="center"
      spacing={metrics.list.gap}
      modifiers={[
        padding({
          leading: metrics.list.inset,
          trailing: metrics.list.inset,
          top: space[5],
          bottom: space[3],
        }),
        frame({ maxWidth: Infinity }),
        accessibilityElement('combine'),
        accessibilityAddTraits(['isHeader']),
      ]}
    >
      <Badge tint={tint} />
      <Text variant="headline" tone={inkOf(tint)}>
        {title}
      </Text>
      <Spacer flexible />
      {count !== undefined ? (
        <Text variant="detail" tone="tertiary" modifiers={[monospacedDigit()]}>
          {String(count)}
        </Text>
      ) : null}
    </Row>
  );
}

// iOS's soft scroll edge: what scrolls under a bar fades out instead of being cut mid-line. The
// scroll view inside rests `metrics.list.rest` in from each edge and draws past its frame
// (`scrollClipDisabled`), so it scrolls on into the fade the way content scrolls under a bar. A
// mask, so it works on any ground and never takes a touch.
export function Faded({
  top = true,
  bottom = true,
  children,
}: {
  top?: boolean;
  bottom?: boolean;
  children: ReactNode;
}) {
  const edge = (from: 'top' | 'bottom') => (
    <Rectangle
      modifiers={[
        frame({ height: metrics.list.fade }),
        frame({ maxWidth: Infinity }),
        foregroundStyle({
          type: 'linearGradient',
          colors: [mask.hidden, mask.shown],
          startPoint: { x: 0.5, y: from === 'top' ? 0 : 1 },
          endPoint: { x: 0.5, y: from === 'top' ? 1 : 0 },
        }),
      ]}
    />
  );
  return (
    <Mask
      alignment="top"
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      <Column
        alignment="center"
        spacing={0}
        modifiers={[
          padding({ top: top ? metrics.list.rest : 0, bottom: bottom ? metrics.list.rest : 0 }),
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
        ]}
      >
        {children}
      </Column>
      <Mask.Content>
        <Column
          alignment="center"
          spacing={0}
          modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}
        >
          {top ? edge('top') : null}
          <Rectangle
            modifiers={[
              frame({ maxWidth: Infinity, maxHeight: Infinity }),
              foregroundStyle(mask.shown),
            ]}
          />
          {bottom ? edge('bottom') : null}
        </Column>
      </Mask.Content>
    </Mask>
  );
}

// A page's sections, a hairline between each and the next so it's clear where one ends. Pass each
// section only when it shows, so none is drawn above the first.
// Sections that follow others on the page, like its asks, open on the line that parts them too.
export function Sections({
  follows = false,
  children,
}: {
  follows?: boolean;
  children: ReactNode;
}) {
  return (
    <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      {Children.toArray(children).map((section, i) => (
        <Column
          key={isValidElement(section) ? section.key : i}
          alignment="start"
          spacing={0}
          modifiers={[frame({ maxWidth: Infinity })]}
        >
          {i || follows ? (
            <Column alignment="start" spacing={0} modifiers={[padding({ top: space[5] })]}>
              <Hairline />
            </Column>
          ) : null}
          {section}
        </Column>
      ))}
    </Column>
  );
}

export function Hairline() {
  return (
    <Rectangle
      modifiers={[
        frame({ height: hairline }),
        frame({ maxWidth: Infinity }),
        foregroundStyle(theme.edge),
      ]}
    />
  );
}

export function Empty({ text, width }: { text: string; width: number }) {
  return (
    <Text
      variant="detail"
      tone="tertiary"
      modifiers={[
        padding({ top: space[12], bottom: space[12] }),
        frame({ maxWidth: Infinity }),
        ...listRow(width),
      ]}
    >
      {text}
    </Text>
  );
}

// Until hex first answers: the system's spinner where the rows will be.
export function Loading({ width }: { width: number }) {
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        padding({ top: space[12], bottom: space[12] }),
        frame({ maxWidth: Infinity }),
        ...listRow(width),
        accessibilityLabel('Loading'),
      ]}
    >
      <ProgressView />
    </Row>
  );
}

// A page's body until hex answers it: the system's spinner; while hex can't be reached, that it's
// trying again, which it does on its own; and once hex says no, why, `gone` when there's no such thing.
export function Waiting({ failed, refused, gone }: Answered & { gone: string }) {
  const why = refused
    ? refused.status === 404
      ? gone
      : refused.message
    : failed
      ? UNREACHED
      : null;
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        padding({
          top: space[12],
          bottom: space[12],
          leading: metrics.list.inset,
          trailing: metrics.list.inset,
        }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      {why ? (
        <Text variant="detail" tone="tertiary">
          {why}
        </Text>
      ) : (
        <ProgressView modifiers={[accessibilityLabel('Loading')]} />
      )}
    </Row>
  );
}

export const UNREACHED = 'Can’t reach hex. Trying again…';

// What you did here that didn't go through, and why, quietly where you did it.
export function Failure({ text, modifiers = [] }: { text: string; modifiers?: ModifierConfig[] }) {
  return (
    <Text
      variant="caption"
      tone="danger"
      paragraph
      modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), ...modifiers]}
    >
      {text}
    </Text>
  );
}
