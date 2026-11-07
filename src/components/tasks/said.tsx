import { Column, Row, Spacer } from '@expo/ui';
import { Text } from '@expo/ui/swift-ui';
import {
  background,
  clipShape,
  frame,
  lineLimit,
  onTapGesture,
  padding,
  textSelection,
} from '@expo/ui/swift-ui/modifiers';
import { createContext, useContext } from 'react';

import { Markdown } from '@/components/markdown';
import { said, type Sending } from '@/live/chat';
import type { ChatTurn } from '@/live/tasks';
import { theme } from '@/theme';
import { textLook } from '@/ui/text';
import { metrics, radius, space } from '@/ui/tokens';

// Selectable text takes a tap for itself, so while you type on a page what was said there isn't
// selectable, and a tap on it ends the typing instead.
export const Selectable = createContext(true);

// Drawn as the call transcript draws a turn.
export function Said({ turn }: { turn: ChatTurn }) {
  const one = said(turn);
  const selectable = useContext(Selectable);
  if (one.kind === 'me') return <Mine text={one.text} />;
  if (one.kind === 'event')
    return <Event text={one.text ? `${one.label} · ${one.text}` : one.label} />;
  return (
    <Markdown
      selectable={selectable}
      modifiers={[
        padding({ leading: metrics.list.inset, trailing: metrics.list.inset }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      {one.text}
    </Markdown>
  );
}

export function Sent({ sent, onRetry }: { sent: Sending; onRetry: () => void }) {
  return (
    <Column alignment="end" spacing={space[1]} modifiers={[frame({ maxWidth: Infinity })]}>
      <Mine text={sent.text} dim={!sent.failed} />
      <Row alignment="center" spacing={0} modifiers={[padding({ trailing: metrics.list.inset })]}>
        <Spacer flexible />
        <Text
          modifiers={[
            ...(sent.failed?.again ? [onTapGesture(onRetry)] : []),
            ...textLook({
              variant: 'caption',
              weight: sent.failed ? 'semibold' : 'regular',
              tone: sent.failed ? 'danger' : 'tertiary',
            }),
          ]}
        >
          {!sent.failed
            ? 'Sending'
            : sent.failed.again
              ? 'Not sent · Tap to try again'
              : sent.failed.why}
        </Text>
      </Row>
    </Column>
  );
}

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
      spacing={space[3]}
      modifiers={[
        padding({
          leading: metrics.list.inset,
          trailing: metrics.list.inset,
          top: space[1],
          bottom: space[1],
        }),
      ]}
    >
      <Text
        modifiers={[
          ...textLook({ variant: 'caption', weight: 'semibold', tone: 'secondary' }),
          frame({ width: 30, alignment: 'leading' }),
        ]}
      >
        {named ? who : ''}
      </Text>
      <Markdown
        inline
        lines={lines}
        variant="detail"
        tone={one.kind === 'event' ? 'secondary' : 'text'}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        {text}
      </Markdown>
    </Row>
  );
}

function Mine({ text, dim = false }: { text: string; dim?: boolean }) {
  const selectable = useContext(Selectable);
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        padding({ leading: metrics.bubbleRoom, trailing: metrics.list.inset - space[1] }),
      ]}
    >
      <Spacer flexible />
      <Text
        modifiers={[
          ...textLook({ tone: dim ? 'secondary' : 'text', paragraph: true }),
          textSelection(selectable),
          padding({
            leading: metrics.bubbleX,
            trailing: metrics.bubbleX,
            top: metrics.bubbleY,
            bottom: metrics.bubbleY,
          }),
          background(theme.fill),
          clipShape('roundedRectangle', radius.bubble),
        ]}
      >
        {text}
      </Text>
    </Row>
  );
}

function Event({ text }: { text: string }) {
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[padding({ leading: metrics.bubbleRoom, trailing: metrics.list.inset })]}
    >
      <Spacer flexible />
      <Text modifiers={[...textLook({ variant: 'caption', tone: 'secondary' }), lineLimit(3)]}>
        {text}
      </Text>
    </Row>
  );
}
