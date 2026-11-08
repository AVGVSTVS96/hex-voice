import { Column, Icon, Row, Spacer } from '@expo/ui';
import { Button, Mask, ProgressView, Rectangle } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityLabel,
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
} from '@expo/ui/swift-ui/modifiers';
import type { ModifierConfig } from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import type { SFSymbol } from 'sf-symbols-typescript';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';

import { Badge, inkOf } from '@/components/tasks/mark';
import type { Tint } from '@/components/tasks/mark';
import type { Answered } from '@/hooks/use-watch';
import { NOT_NEEDED, PICK } from '@/live/asks';
import { hairline, theme } from '@/theme';
import { Text } from '@/ui/text';
import { mask, metrics, radius, space } from '@/ui/tokens';

export const questions = (n: number) => `${n} question${n === 1 ? '' : 's'}`;

export const feel = (haptics: boolean) => {
  const on = haptics;

  return {
    tick: () => {
      if (on) {
        void Haptics.selectionAsync();
      }
    },
    tap: () => {
      if (on) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
  };
};

export type Feel = ReturnType<typeof feel>;

export const listRow = (): ModifierConfig[] => [
  listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
  listRowBackground('transparent'),
  listRowSeparator('hidden'),
];

export const rowFrame = (selected: boolean, { top = metrics.list.row.top } = {}) => [
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

export const Pill = ({
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
}) => {
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
      <PillLabel label={label} pick={pick} small={small} grow={grow} ink={ink} />
    </Row>
  );
};

const PillLabel = ({
  label,
  pick,
  small,
  grow,
  ink,
}: {
  label: string;
  pick: boolean;
  small: boolean;
  grow: boolean;
  ink: 'text' | 'tertiary';
}) => (
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
);

export const NotNeededButton = ({ onPress }: { onPress: () => void }) => (
  <Button
    label={NOT_NEEDED}
    systemImage="xmark"
    onPress={onPress}
    modifiers={[tint(theme.secondary)]}
  />
);

export const SectionHead = ({
  title,
  count,
  opens = false,
}: {
  title: string;
  count?: string | number;
  opens?: boolean;
}) => (
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
    {count === undefined ? null : (
      <Text variant="caption" tone="tertiary" modifiers={[monospacedDigit()]}>
        {String(count)}
      </Text>
    )}
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

export const StageHead = ({
  tint: stage,
  title,
  count,
}: {
  tint: Tint;
  title: string;
  count?: number;
}) => (
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
    <Badge tint={stage} />
    <Text variant="headline" tone={inkOf(stage)}>
      {title}
    </Text>
    <Spacer flexible />
    {count === undefined ? null : (
      <Text variant="detail" tone="tertiary" modifiers={[monospacedDigit()]}>
        {String(count)}
      </Text>
    )}
  </Row>
);

export const Faded = ({
  top = true,
  bottom = true,
  children,
}: {
  top?: boolean;
  bottom?: boolean;
  children: ReactNode;
}) => (
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
        {top ? <FadeEdge from="top" /> : null}
        <Rectangle
          modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
            foregroundStyle(mask.shown),
          ]}
        />
        {bottom ? <FadeEdge from="bottom" /> : null}
      </Column>
    </Mask.Content>
  </Mask>
);

const FadeEdge = ({ from }: { from: 'top' | 'bottom' }) => (
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

export const Sections = ({
  follows = false,
  children,
}: {
  follows?: boolean;
  children: ReactNode[];
}) => {
  const sections = children.flatMap((section, at) =>
    isValidElement(section) ? [{ key: section.key ?? at, section }] : [],
  );

  return (
    <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      {sections.map(({ key, section }, i) => (
        <Column key={key} alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
          {i > 0 || follows ? (
            <Column alignment="start" spacing={0} modifiers={[padding({ top: space[5] })]}>
              <Hairline />
            </Column>
          ) : null}
          {section}
        </Column>
      ))}
    </Column>
  );
};

export const Hairline = () => (
  <Rectangle
    modifiers={[
      frame({ height: hairline }),
      frame({ maxWidth: Infinity }),
      foregroundStyle(theme.edge),
    ]}
  />
);

export const Empty = ({ text }: { text: string }) => (
  <Text
    variant="detail"
    tone="tertiary"
    modifiers={[
      padding({ top: space[12], bottom: space[12] }),
      frame({ maxWidth: Infinity }),
      ...listRow(),
    ]}
  >
    {text}
  </Text>
);

export const Loading = () => (
  <Row
    alignment="center"
    spacing={0}
    modifiers={[
      padding({ top: space[12], bottom: space[12] }),
      frame({ maxWidth: Infinity }),
      ...listRow(),
      accessibilityLabel('Loading'),
    ]}
  >
    <ProgressView />
  </Row>
);

export const Waiting = ({ gone, ...answered }: Answered & { gone: string }) => {
  const why = whyNot(answered, gone);

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
      {why === null || why === '' ? (
        <ProgressView modifiers={[accessibilityLabel('Loading')]} />
      ) : (
        <Text variant="detail" tone="tertiary">
          {why}
        </Text>
      )}
    </Row>
  );
};

export const UNREACHED = 'Can’t reach hex. Trying again…';

const whyNot = ({ failed, refused }: Answered, gone: string) => {
  if (refused) {
    return refused.status === 404 ? gone : refused.message;
  }

  return failed ? UNREACHED : null;
};

export const Failure = ({
  text,
  modifiers,
}: {
  text: string | undefined;
  modifiers?: ModifierConfig[];
}) =>
  text === undefined || text === '' ? null : (
    <Text
      variant="caption"
      tone="danger"
      paragraph
      modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' }), ...(modifiers ?? [])]}
    >
      {text}
    </Text>
  );
