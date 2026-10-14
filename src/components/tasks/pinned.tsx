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
import { GroupHead, INSET, Mark, ios } from '@/components/tasks/parts';
import type { Ask, AskOption } from '@/live/asks';
import { pinSections, type PinLine, type PinMark, type PinSection } from '@/live/pinned';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';

const MARKS: Record<PinMark, 'needs' | 'working' | 'done' | 'failed' | 'idle'> = {
  needs: 'needs',
  working: 'working',
  done: 'done',
  failed: 'failed',
  idle: 'idle',
};

// The thread's own asks, answered right here: its question and its choices under it. One you
// answer folds where it sits to what you said, with Undo.
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
      <GroupHead title="Your call" count={open} />
      {asks.map((ask) => {
        const said = answered[ask.id];
        return (
          <Row
            key={ask.id}
            alignment="start"
            spacing={12}
            modifiers={[
              padding({ leading: INSET, trailing: INSET, top: 10, bottom: 12 }),
              frame({ maxWidth: Infinity, alignment: 'leading' }),
            ]}
          >
            <Mark state={said ? 'done' : 'needs'} />
            <Column
              alignment="start"
              spacing={said ? 3 : 10}
              modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
            >
              <Text
                textStyle={{
                  fontSize: said ? 15 : 17,
                  lineHeight: said ? 19 : 21,
                  fontWeight: said ? '400' : '600',
                }}
                modifiers={[foregroundStyle(said ? theme.secondary : theme.text)]}
              >
                {ask.question}
              </Text>
              {said ? (
                <Text
                  textStyle={{ fontSize: 17, fontWeight: '600' }}
                  modifiers={[foregroundStyle(theme.text)]}
                >
                  {said}
                </Text>
              ) : (
                <Choices ask={ask} onAnswer={onAnswer} />
              )}
            </Column>
            {said ? (
              <Text
                textStyle={{ fontSize: 17, fontWeight: '600' }}
                onPress={() => onUndo(ask)}
                modifiers={[
                  foregroundStyle(theme.accent),
                  ...(ios ? [accessibilityLabel(`Undo ${said}`)] : []),
                ]}
              >
                Undo
              </Text>
            ) : null}
          </Row>
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
        spacing={12}
        onPress={() => setOpen(true)}
        modifiers={[
          padding({ leading: INSET, trailing: INSET, top: 12, bottom: 12 }),
          frame({ maxWidth: Infinity }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <Mark state={MARKS[section.mark]} />
        <Text
          textStyle={{ fontSize: 17, fontWeight: '500' }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {`${section.title} · ${section.lines.length}`}
        </Text>
        <Spacer flexible />
        <Icon name="chevron.down" size={13} color={theme.tertiary} />
      </Row>
    );
  return (
    <Column alignment="start" spacing={0}>
      {section.title ? <GroupHead title={section.title} count={section.lines.length} /> : null}
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
          padding({ leading: INSET + 34, trailing: INSET, top: 4, bottom: 8 }),
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
      spacing={12}
      onPress={url ? () => void Linking.openURL(url) : undefined}
      modifiers={[
        padding({ leading: INSET, trailing: INSET, top: 8, bottom: 8 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
      ]}
    >
      <Mark state={MARKS[line.mark]} quiet={line.mark === 'done'} />
      <Text
        textStyle={{ fontSize: 16, lineHeight: 21 }}
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
