import { Column, Icon, Row, Spacer, Text } from '@expo/ui';
import { Mask, Rectangle } from '@expo/ui/swift-ui';
import {
  alignmentGuide,
  foregroundStyle,
  frame,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listRowSeparatorTint,
  padding,
  type ModifierConfig,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { Children, isValidElement, type ReactNode } from 'react';
import { PixelRatio } from 'react-native';

import { theme } from '@/theme';

export const ios = process.env.EXPO_OS === 'ios';
export const INSET = 20;
export const MARK = 16;
export const GAP = 10;
const HAIRLINE = 1 / PixelRatio.get();
// How far scrolled content fades out as it meets a bar, and how far in from that edge it rests:
// together with a row's own top padding, nothing at rest sits in the fade.
const FADE = 32;
const REST = 20;

export function feel(haptics: boolean) {
  const on = ios && haptics;
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
    listRowBackground(selected ? theme.surfaceSelected : 'transparent'),
    listRowSeparatorTint(theme.edge),
    alignmentGuide('listRowSeparatorLeading', 0),
    alignmentGuide('listRowSeparatorTrailing', width),
    ...(top ? [] : [listRowSeparator('hidden', 'top')]),
    ...(bottom ? [] : [listRowSeparator('hidden', 'bottom')]),
  ];
}

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
        padding({ leading: INSET, trailing: INSET, top: 22, bottom: 6 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Text
        textStyle={{ fontSize: 13, fontWeight: '600' }}
        modifiers={[foregroundStyle(theme.secondary)]}
      >
        {title}
      </Text>
      <Spacer flexible />
      {count !== undefined ? (
        <Text textStyle={{ fontSize: 13 }} modifiers={[foregroundStyle(theme.tertiary)]}>
          {String(count)}
        </Text>
      ) : null}
      {opens ? (
        <Icon
          name="chevron.right"
          size={11}
          color={theme.tertiary}
          modifiers={[padding({ leading: 8 })]}
        />
      ) : null}
    </Row>
  );
}

// iOS's soft scroll edge: what scrolls under a bar fades out instead of being cut mid-line. The
// scroll view inside rests `REST` in from each edge and draws past its frame
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
        frame({ height: FADE }),
        frame({ maxWidth: Infinity }),
        foregroundStyle({
          type: 'linearGradient',
          // Clear for its first half, so a line scrolled up to the bar is gone before it meets it.
          colors: ['#00000000', '#00000000', '#000000'],
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
          padding({ top: top ? REST : 0, bottom: bottom ? REST : 0 }),
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
              foregroundStyle('#000000'),
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
            <Column alignment="start" spacing={0} modifiers={[padding({ top: 20 })]}>
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
        frame({ height: HAIRLINE }),
        frame({ maxWidth: Infinity }),
        foregroundStyle(theme.edge),
      ]}
    />
  );
}

export function Empty({ text, width }: { text: string; width: number }) {
  return (
    <Text
      textStyle={{ fontSize: 15 }}
      modifiers={[
        foregroundStyle(theme.tertiary),
        padding({ top: 48, bottom: 48 }),
        frame({ maxWidth: Infinity }),
        ...listRow(width, { top: false, bottom: false }),
      ]}
    >
      {text}
    </Text>
  );
}
