import { Column, Icon, Row, Spacer } from '@expo/ui';
import { Circle, Mask, ProgressView, Rectangle, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  alignmentGuide,
  contentShape,
  foregroundStyle,
  frame,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listRowSeparatorTint,
  padding,
  shapes,
  type ModifierConfig,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { Children, isValidElement, type ReactNode } from 'react';

import type { Answered } from '@/hooks/use-watch';
import { hairline, theme } from '@/theme';
import { Text } from '@/ui/text';
import { mask, metrics, space, type Tone } from '@/ui/tokens';

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

// No inset or fill of its own, so the list's ground shows behind it, unless it's the selected row.
// A row takes the fill set closest to it, so the selection is set here and not on top.
export function listRow(
  width: number,
  { top = true, bottom = true, selected = false } = {},
): ModifierConfig[] {
  return [
    listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
    listRowBackground(selected ? theme.fillStrong : 'transparent'),
    listRowSeparatorTint(theme.edge),
    alignmentGuide('listRowSeparatorLeading', 0),
    alignmentGuide('listRowSeparatorTrailing', width),
    ...(top ? [] : [listRowSeparator('hidden', 'top')]),
    ...(bottom ? [] : [listRowSeparator('hidden', 'bottom')]),
  ];
}

// What a list's section or tab holds, by its color, as Muse colors a section's name and the
// tinted dot beside it: mint what needs you, blue what's under way, red what failed.
export const KINDS = {
  needs: { word: 'accent', dot: 'accentFill' },
  working: { word: 'progress', dot: 'progressFill' },
  failed: { word: 'danger', dot: 'dangerFill' },
  done: { word: 'text', dot: 'fillStrong' },
  quiet: { word: 'secondary', dot: 'fill' },
} as const satisfies Record<string, { word: Tone; dot: Tone }>;

export type Kind = keyof typeof KINDS;

export function Badge({ kind }: { kind: Kind }) {
  const { word, dot } = KINDS[kind];
  return (
    <ZStack alignment="center">
      <Circle
        modifiers={[
          frame({ width: metrics.tabs.badge, height: metrics.tabs.badge }),
          foregroundStyle(theme[dot]),
        ]}
      />
      <Circle
        modifiers={[
          frame({ width: metrics.tabs.dot, height: metrics.tabs.dot }),
          foregroundStyle(theme[word]),
        ]}
      />
    </ZStack>
  );
}

export function SectionHead({
  title,
  kind,
  count,
  opens = false,
  action,
}: {
  title: string;
  kind?: Kind;
  count?: string | number;
  opens?: boolean;
  // Taken across the whole row, so it's never only a footnote's height to hit.
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Row
      alignment="center"
      spacing={0}
      onPress={action?.onPress}
      modifiers={[
        padding({
          leading: metrics.list.inset,
          trailing: metrics.list.inset,
          top: space[6],
          bottom: space[2],
        }),
        frame({ maxWidth: Infinity }),
        ...(action
          ? [
              contentShape(shapes.rectangle()),
              accessibilityLabel(`${title}. ${action.label}`),
              accessibilityAddTraits(['isButton']),
            ]
          : []),
      ]}
    >
      <Row alignment="center" spacing={metrics.tabs.gap}>
        {kind ? <Badge kind={kind} /> : null}
        <Text variant="detail" weight="semibold" tone={kind ? KINDS[kind].word : 'text'}>
          {title}
        </Text>
      </Row>
      <Spacer flexible />
      {count !== undefined ? (
        <Text variant="caption" tone="tertiary">
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
      {action ? (
        <Text variant="caption" weight="semibold" tone="accent">
          {action.label}
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
export function Sections({ children }: { children: ReactNode }) {
  return (
    <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      {Children.toArray(children).map((section, i) => (
        <Column
          key={isValidElement(section) ? section.key : i}
          alignment="start"
          spacing={0}
          modifiers={[frame({ maxWidth: Infinity })]}
        >
          {i ? (
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
        ...listRow(width, { top: false, bottom: false }),
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
        ...listRow(width, { top: false, bottom: false }),
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
