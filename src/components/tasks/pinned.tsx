import { Column, Icon, Row, Spacer, Text } from '@expo/ui';
import {
  accessibilityLabel,
  animation,
  background,
  clipShape,
  contentShape,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
  textSelection,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { Linking } from 'react-native';

import { Choices } from '@/components/tasks/ask-card';
import { GAP, INSET, MARK, Mark, SectionHead, ios } from '@/components/tasks/parts';
import type { Ask, AskOption } from '@/live/asks';
import { pinSections, type PinLine, type PinMark, type PinSection } from '@/live/pinned';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';

// The topic's asks, answered right here: each question with what it unblocks under it, then its
// choices as rows. One you answer folds where it sits to what you said, with Undo.
export function YourCall({
  asks,
  answered,
  onAnswer,
  onUndo,
}: {
  asks: Ask[];
  answered: Record<string, string | null>;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
}) {
  if (!asks.length) return null;
  const open = asks.filter((ask) => !answered[ask.id]).length;
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[
        animation(motion.list, rowsKey(asks.map((ask) => `${ask.id}=${answered[ask.id] ?? ''}`))),
      ]}
    >
      <SectionHead title="Your call" count={open} />
      {asks.map((ask, i) => {
        const said = answered[ask.id];
        if (said)
          return (
            <Row
              key={ask.id}
              alignment="center"
              spacing={GAP}
              modifiers={[
                padding({ leading: INSET - 2, trailing: INSET, top: 10, bottom: 14 }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
              ]}
            >
              <Mark state="done" />
              <Column
                alignment="start"
                spacing={1}
                modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
              >
                <Text textStyle={{ fontSize: 15 }} modifiers={[foregroundStyle(theme.secondary)]}>
                  {ask.question}
                </Text>
                <Text textStyle={{ fontSize: 15 }} modifiers={[foregroundStyle(theme.text)]}>
                  {said}
                </Text>
              </Column>
              <Text
                textStyle={{ fontSize: 15, fontWeight: '600' }}
                onPress={() => onUndo(ask)}
                modifiers={[
                  foregroundStyle(theme.accent),
                  ...(ios ? [accessibilityLabel(`Undo ${said}`)] : []),
                ]}
              >
                Undo
              </Text>
            </Row>
          );
        return (
          <Column
            key={ask.id}
            alignment="start"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity })]}
          >
            <Column
              alignment="start"
              spacing={4}
              modifiers={[
                padding({ leading: INSET, trailing: INSET, top: i ? 22 : 2, bottom: 12 }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
              ]}
            >
              <Text
                textStyle={{ fontSize: 17, lineHeight: 22, fontWeight: '600' }}
                modifiers={[foregroundStyle(theme.text)]}
              >
                {ask.question}
              </Text>
              {ask.context ? (
                <Text
                  textStyle={{ fontSize: 15, lineHeight: 20 }}
                  modifiers={[foregroundStyle(theme.secondary)]}
                >
                  {ask.context}
                </Text>
              ) : null}
            </Column>
            <Choices ask={ask} onAnswer={onAnswer} />
          </Column>
        );
      })}
    </Column>
  );
}

// The pinned status post drawn natively: each section with its lines marked as the section says,
// commands set apart to select and copy, links that open, and Done folded to one line.
export function Pinned({ text }: { text: string }) {
  const sections = pinSections(text);
  return (
    <Column alignment="start" spacing={0}>
      {sections.map((section, i) => (
        <Section key={`${section.title} ${i}`} section={section} />
      ))}
    </Column>
  );
}

function Section({ section }: { section: PinSection }) {
  const [open, setOpen] = useState(!section.folded);
  if (!open)
    return (
      <Row
        alignment="center"
        spacing={GAP}
        onPress={() => setOpen(true)}
        modifiers={[
          padding({ leading: INSET - 2, trailing: INSET, top: 12, bottom: 12 }),
          frame({ maxWidth: Infinity }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <Mark state={section.mark} />
        <Text textStyle={{ fontSize: 15 }} modifiers={[foregroundStyle(theme.secondary)]}>
          {`${section.title} · ${section.lines.length}`}
        </Text>
        <Spacer flexible />
        <Icon name="chevron.down" size={13} color={theme.tertiary} />
      </Row>
    );
  return (
    <Column alignment="start" spacing={0}>
      {section.title ? <SectionHead title={section.title} count={section.lines.length} /> : null}
      {section.lines.map((line, i) => (
        <Line key={i} line={line} />
      ))}
    </Column>
  );
}

function Line({ line }: { line: PinLine }) {
  if (line.kind === 'code')
    return (
      <Text
        textStyle={{ fontSize: 14, lineHeight: 20 }}
        modifiers={[
          font({ design: 'monospaced', size: 14 }),
          foregroundStyle(theme.text),
          textSelection(true),
          padding({ leading: 16, trailing: 16, top: 12, bottom: 12 }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          background(theme.surface),
          clipShape('roundedRectangle', 14),
          padding({ leading: INSET - 2 + MARK + GAP, trailing: INSET, top: 4, bottom: 8 }),
        ]}
      >
        {line.text}
      </Text>
    );
  if (line.kind === 'text')
    return (
      <Text
        textStyle={{ fontSize: 15, lineHeight: 20 }}
        modifiers={[
          foregroundStyle(theme.secondary),
          textSelection(true),
          padding({ leading: INSET, trailing: INSET, top: 6, bottom: 6 }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {line.text}
      </Text>
    );
  const url = line.url;
  return (
    <Row
      alignment="start"
      spacing={GAP}
      onPress={url ? () => void Linking.openURL(url) : undefined}
      modifiers={[
        padding({ leading: INSET - 2, trailing: INSET, top: 8, bottom: 8 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
      ]}
    >
      <Mark state={line.mark === 'done' ? 'read' : line.mark} />
      <Text
        textStyle={{ fontSize: 15, lineHeight: 20 }}
        modifiers={[
          foregroundStyle(line.mark === 'done' ? theme.secondary : theme.text),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {line.text}
      </Text>
      {url ? <Icon name="arrow.up.right" size={13} color={theme.tertiary} /> : null}
    </Row>
  );
}
