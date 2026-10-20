import { Column, Row, Spacer } from '@expo/ui';
import { ScrollView, Text } from '@expo/ui/swift-ui';
import {
  background,
  clipShape,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  lineSpacing,
  onTapGesture,
  padding,
  textSelection,
} from '@expo/ui/swift-ui/modifiers';
import type { ColorValue } from 'react-native';

import { INSET } from '@/components/tasks/parts';
import { said, type Sending } from '@/live/chat';
import { blocksOf, plainOf, type Block } from '@/live/markdown';
import type { ChatTurn } from '@/live/tasks';
import { theme } from '@/theme';

const BODY = 17;
const LEADING = 5;

// One turn of a thread, drawn as the call transcript draws one: your words in a bubble on the
// right, hex's as text across the page with their markdown, and what you did there (answered,
// voted, sent a photo) as a quiet line under your side.
export function Said({ turn }: { turn: ChatTurn }) {
  const one = said(turn);
  if (one.kind === 'me') return <Mine text={one.text} />;
  if (one.kind === 'event')
    return <Event text={one.text ? `${one.label} · ${one.text}` : one.label} />;
  return (
    <Column
      alignment="start"
      spacing={12}
      modifiers={[padding({ leading: INSET, trailing: INSET }), frame({ maxWidth: Infinity })]}
    >
      {blocksOf(one.text).map((block, i) => (
        <Piece key={i} block={block} />
      ))}
    </Column>
  );
}

// What you sent from here before hex has it: dimmed while it goes, and if it didn't, a tap sends
// it again.
export function Sent({ sent, onRetry }: { sent: Sending; onRetry: () => void }) {
  return (
    <Column alignment="end" spacing={4} modifiers={[frame({ maxWidth: Infinity })]}>
      <Mine text={sent.text} dim={!sent.failed} />
      <Row alignment="center" spacing={0} modifiers={[padding({ trailing: INSET })]}>
        <Spacer flexible />
        <Text
          modifiers={[
            ...(sent.failed ? [onTapGesture(onRetry)] : []),
            font({ size: 13, weight: sent.failed ? 'medium' : 'regular' }),
            foregroundStyle(sent.failed ? theme.danger : theme.tertiary),
          ]}
        >
          {sent.failed ? 'Not sent · Tap to try again' : 'Sending'}
        </Text>
      </Row>
    </Column>
  );
}

// A turn in a line or a few, for a topic's page: who said it, unless the line above did, then
// what, without its code.
export function SaidLine({
  turn,
  named,
  lines,
}: {
  turn: ChatTurn;
  named: boolean;
  lines: number;
}) {
  const one = said(turn);
  const who = one.kind === 'hex' ? 'hex' : 'You';
  const text =
    one.kind === 'event' ? (one.text ? `${one.label} · ${one.text}` : one.label) : one.text;
  return (
    <Row
      alignment="start"
      spacing={10}
      modifiers={[padding({ leading: INSET, trailing: INSET, top: 5, bottom: 5 })]}
    >
      <Text
        modifiers={[
          font({ size: 13, weight: 'semibold' }),
          foregroundStyle(theme.secondary),
          frame({ width: 30, alignment: 'leading' }),
        ]}
      >
        {named ? who : ''}
      </Text>
      <Text
        markdownEnabled
        modifiers={[
          font({ size: 15 }),
          foregroundStyle(one.kind === 'event' ? theme.secondary : theme.text),
          lineLimit(lines),
          lineSpacing(2),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {one.kind === 'hex' ? plainOf(text) : text}
      </Text>
    </Row>
  );
}

function Mine({ text, dim = false }: { text: string; dim?: boolean }) {
  return (
    <Row alignment="center" spacing={0} modifiers={[padding({ leading: 52, trailing: INSET - 4 })]}>
      <Spacer flexible />
      <Text
        modifiers={[
          font({ size: BODY }),
          lineSpacing(LEADING),
          foregroundStyle(dim ? theme.secondary : theme.text),
          textSelection(true),
          padding({ leading: 15, trailing: 15, top: 11, bottom: 11 }),
          background(theme.bubble),
          clipShape('roundedRectangle', 20),
        ]}
      >
        {text}
      </Text>
    </Row>
  );
}

function Event({ text }: { text: string }) {
  return (
    <Row alignment="center" spacing={0} modifiers={[padding({ leading: 52, trailing: INSET })]}>
      <Spacer flexible />
      <Text modifiers={[font({ size: 13 }), foregroundStyle(theme.secondary), lineLimit(3)]}>
        {text}
      </Text>
    </Row>
  );
}

function Piece({ block }: { block: Block }) {
  switch (block.kind) {
    case 'code':
      return (
        <ScrollView
          axes="horizontal"
          showsIndicators={false}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: 'leading' }),
            background(theme.surface),
            clipShape('roundedRectangle', 12),
          ]}
        >
          <Text
            modifiers={[
              font({ size: 13, design: 'monospaced' }),
              lineSpacing(3),
              foregroundStyle(theme.text),
              textSelection(true),
              padding({ leading: 14, trailing: 14, top: 12, bottom: 12 }),
            ]}
          >
            {block.text}
          </Text>
        </ScrollView>
      );
    case 'heading':
      return <Words text={block.text} weight="semibold" />;
    case 'quote':
      return (
        <Row alignment="start" spacing={12} modifiers={[frame({ maxWidth: Infinity })]}>
          <Spacer
            modifiers={[
              frame({ width: 3 }),
              frame({ maxHeight: Infinity }),
              background(theme.edge),
            ]}
          />
          <Words text={block.text} color={theme.secondary} />
        </Row>
      );
    case 'list':
      return (
        <Column alignment="start" spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
          {block.items.map((item, i) => (
            <Row key={i} alignment="start" spacing={8}>
              <Text
                modifiers={[
                  font({ size: BODY }),
                  foregroundStyle(theme.secondary),
                  frame({ minWidth: 14, alignment: 'leading' }),
                ]}
              >
                {item.mark}
              </Text>
              <Words text={item.text} />
            </Row>
          ))}
        </Column>
      );
    case 'text':
      return <Words text={block.text} />;
  }
}

function Words({
  text,
  weight = 'regular',
  color = theme.text,
}: {
  text: string;
  weight?: 'regular' | 'semibold';
  color?: ColorValue;
}) {
  return (
    <Text
      markdownEnabled
      modifiers={[
        font({ size: BODY, weight }),
        lineSpacing(LEADING),
        foregroundStyle(color),
        textSelection(true),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
      ]}
    >
      {text}
    </Text>
  );
}
