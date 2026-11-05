import { Column, Row, Spacer } from '@expo/ui';
import { ScrollView, Text } from '@expo/ui/swift-ui';
import {
  background,
  clipShape,
  frame,
  lineLimit,
  onTapGesture,
  padding,
  textSelection,
} from '@expo/ui/swift-ui/modifiers';

import { said, type Sending } from '@/live/chat';
import { blocksOf, plainOf, type Block } from '@/live/markdown';
import type { ChatTurn } from '@/live/tasks';
import { theme } from '@/theme';
import { textLook } from '@/ui/text';
import { metrics, radius, space, type Tone } from '@/ui/tokens';

// Drawn as the call transcript draws a turn.
export function Said({ turn }: { turn: ChatTurn }) {
  const one = said(turn);
  if (one.kind === 'me') return <Mine text={one.text} />;
  if (one.kind === 'event')
    return <Event text={one.text ? `${one.label} · ${one.text}` : one.label} />;
  return (
    <Column
      alignment="start"
      spacing={space[3]}
      modifiers={[
        padding({ leading: metrics.list.inset, trailing: metrics.list.inset }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      {blocksOf(one.text).map((block, i) => (
        <Piece key={i} block={block} />
      ))}
    </Column>
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
              variant: 'footnote',
              weight: sent.failed ? 'medium' : 'regular',
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
      spacing={space[2.5]}
      modifiers={[
        padding({
          leading: metrics.list.inset,
          trailing: metrics.list.inset,
          top: space[1.25],
          bottom: space[1.25],
        }),
      ]}
    >
      <Text
        modifiers={[
          ...textLook({ variant: 'footnote', weight: 'semibold', tone: 'secondary' }),
          frame({ width: 30, alignment: 'leading' }),
        ]}
      >
        {named ? who : ''}
      </Text>
      <Text
        markdownEnabled
        modifiers={[
          ...textLook({
            variant: 'preview',
            tone: one.kind === 'event' ? 'secondary' : 'text',
            paragraph: true,
          }),
          lineLimit(lines),
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
          textSelection(true),
          padding({
            leading: metrics.bubbleX,
            trailing: metrics.bubbleX,
            top: metrics.bubbleY,
            bottom: metrics.bubbleY,
          }),
          background(theme.bubble),
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
      <Text modifiers={[...textLook({ variant: 'footnote', tone: 'secondary' }), lineLimit(3)]}>
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
            clipShape('roundedRectangle', radius.inner),
          ]}
        >
          <Text
            modifiers={[
              ...textLook({ variant: 'snippet', paragraph: true }),
              textSelection(true),
              padding({
                leading: space[3.5],
                trailing: space[3.5],
                top: space[3],
                bottom: space[3],
              }),
            ]}
          >
            {block.text}
          </Text>
        </ScrollView>
      );
    case 'heading':
      return <Words text={block.text} weight="semibold" />;
    case 'small':
      return <Words text={block.text} variant="footnote" tone="secondary" />;
    case 'quote':
      return (
        <Row alignment="start" spacing={space[3]} modifiers={[frame({ maxWidth: Infinity })]}>
          <Spacer
            modifiers={[
              frame({ width: 3 }),
              frame({ maxHeight: Infinity }),
              background(theme.edge),
            ]}
          />
          <Words text={block.text} tone="secondary" />
        </Row>
      );
    case 'list':
      return (
        <Column alignment="start" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
          {block.items.map((item, i) => (
            <Row key={i} alignment="start" spacing={space[2]}>
              <Text
                modifiers={[
                  ...textLook({ tone: 'secondary' }),
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
  variant = 'body',
  weight = 'regular',
  tone = 'text',
}: {
  text: string;
  variant?: 'body' | 'footnote';
  weight?: 'regular' | 'semibold';
  tone?: Tone;
}) {
  return (
    <Text
      markdownEnabled
      modifiers={[
        ...textLook({ variant, weight, tone, paragraph: true }),
        textSelection(true),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
      ]}
    >
      {text}
    </Text>
  );
}
