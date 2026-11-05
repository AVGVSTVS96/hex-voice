import { Column, Icon, Row, Spacer } from '@expo/ui';
import {
  background,
  clipShape,
  contentShape,
  frame,
  padding,
  shapes,
  textSelection,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { Markdown } from '@/components/markdown';
import { Mark } from '@/components/tasks/mark';
import { Failure, SectionHead } from '@/components/tasks/parts';
import { openURL, useFailures } from '@/hooks/use-failures';
import { pinSections, type PinLine, type PinSection } from '@/live/pinned';
import { radius, theme } from '@/theme';
import { Text } from '@/ui/text';
import { metrics, space } from '@/ui/tokens';

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
            leading: metrics.list.inset - space[0.5],
            trailing: metrics.list.inset,
            top: space[3],
            bottom: space[3],
          }),
          frame({ maxWidth: Infinity }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <Mark state={section.mark} />
        <Text variant="subheadline" tone="secondary">
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
        variant="code"
        paragraph
        modifiers={[
          textSelection(true),
          padding({ leading: space[4], trailing: space[4], top: space[3], bottom: space[3] }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          background(theme.surface),
          clipShape('roundedRectangle', radius.inner),
          padding({
            leading: metrics.list.inset - space[0.5] + metrics.list.mark + metrics.list.gap,
            trailing: metrics.list.inset,
            top: space[1],
            bottom: space[2],
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
      <Markdown
        inline
        variant="subheadline"
        tone="secondary"
        selectable
        modifiers={[
          padding({
            leading: metrics.list.inset,
            trailing: metrics.list.inset,
            top: space[1.5],
            bottom: space[1.5],
          }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {line.text}
      </Markdown>
    );
  if (line.kind === 'text')
    return (
      <Row
        alignment="start"
        spacing={metrics.list.gap}
        onPress={open}
        modifiers={[
          padding({
            leading: metrics.list.inset,
            trailing: metrics.list.inset,
            top: space[1.5],
            bottom: space[1.5],
          }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <Column
          alignment="start"
          spacing={space[0.5]}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          <Markdown
            inline
            variant="subheadline"
            tone="secondary"
            modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
          >
            {line.text}
          </Markdown>
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
          leading: metrics.list.inset - space[0.5],
          trailing: metrics.list.inset,
          top: space[2],
          bottom: space[2],
        }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
      ]}
    >
      <Mark state={line.mark === 'done' ? 'read' : line.mark} />
      <Column
        alignment="start"
        spacing={space[0.5]}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Markdown
          inline
          variant="subheadline"
          tone={line.mark === 'done' ? 'secondary' : 'text'}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          {line.text}
        </Markdown>
        {url && tries.failed[url] ? <Failure text={tries.failed[url]} /> : null}
      </Column>
      {url ? <Icon name="arrow.up.right" size={13} color={theme.tertiary} /> : null}
    </Row>
  );
}
