import { Column, Icon, Row, Spacer, Text } from '@expo/ui';
import {
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

import { GAP, INSET, MARK, Mark, SectionHead } from '@/components/tasks/parts';
import { pinSections, type PinLine, type PinSection } from '@/live/pinned';
import { theme } from '@/theme';

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
