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

import { Mark } from '@/components/tasks/mark';
import { Failure, SectionHead } from '@/components/tasks/parts';
import { openURL, useFailures } from '@/hooks/use-failures';
import { pinSections, type PinLine, type PinSection } from '@/live/pinned';
import { radius, theme } from '@/theme';
import { metrics } from '@/ui/tokens';

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
        spacing={metrics.list.gap}
        onPress={() => setOpen(true)}
        modifiers={[
          padding({
            leading: metrics.list.inset - 2,
            trailing: metrics.list.inset,
            top: 12,
            bottom: 12,
          }),
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
  const tries = useFailures();
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
          clipShape('roundedRectangle', radius.inner),
          padding({
            leading: metrics.list.inset - 2 + metrics.list.mark + metrics.list.gap,
            trailing: metrics.list.inset,
            top: 4,
            bottom: 8,
          }),
        ]}
      >
        {line.text}
      </Text>
    );
  const url = line.url;
  const open = url ? () => void tries.attempt(url, 'Not opened', () => openURL(url)) : undefined;
  if (line.kind === 'text' && !url)
    return (
      <Text
        textStyle={{ fontSize: 15, lineHeight: 20 }}
        modifiers={[
          foregroundStyle(theme.secondary),
          textSelection(true),
          padding({ leading: metrics.list.inset, trailing: metrics.list.inset, top: 6, bottom: 6 }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {line.text}
      </Text>
    );
  if (line.kind === 'text')
    return (
      <Row
        alignment="start"
        spacing={metrics.list.gap}
        onPress={open}
        modifiers={[
          padding({ leading: metrics.list.inset, trailing: metrics.list.inset, top: 6, bottom: 6 }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <Column
          alignment="start"
          spacing={2}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          <Text
            textStyle={{ fontSize: 15, lineHeight: 20 }}
            modifiers={[
              foregroundStyle(theme.secondary),
              frame({ maxWidth: Infinity, alignment: 'leading' }),
            ]}
          >
            {line.text}
          </Text>
          {url && tries.failed[url] ? <Failure text={tries.failed[url]} /> : null}
        </Column>
        <Icon name="arrow.up.right" size={13} color={theme.tertiary} />
      </Row>
    );
  return (
    <Row
      alignment="start"
      spacing={metrics.list.gap}
      onPress={open}
      modifiers={[
        padding({
          leading: metrics.list.inset - 2,
          trailing: metrics.list.inset,
          top: 8,
          bottom: 8,
        }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
      ]}
    >
      <Mark state={line.mark === 'done' ? 'read' : line.mark} />
      <Column
        alignment="start"
        spacing={2}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text
          textStyle={{ fontSize: 15, lineHeight: 20 }}
          modifiers={[
            foregroundStyle(line.mark === 'done' ? theme.secondary : theme.text),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        >
          {line.text}
        </Text>
        {url && tries.failed[url] ? <Failure text={tries.failed[url]} /> : null}
      </Column>
      {url ? <Icon name="arrow.up.right" size={13} color={theme.tertiary} /> : null}
    </Row>
  );
}
