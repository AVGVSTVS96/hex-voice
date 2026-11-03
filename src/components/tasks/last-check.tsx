import { Column, Row, ScrollView, Text } from '@expo/ui';
import {
  background,
  clipShape,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { Header } from '@/components/tasks/bar';
import { Mark } from '@/components/tasks/mark';
import { Faded, GAP, INSET, SectionHead, Sections } from '@/components/tasks/parts';
import type { Check, CheckNote } from '@/live/asks';
import { timeOfDay } from '@/live/calls';
import { theme } from '@/theme';

export function LastCheck({ check }: { check?: Check }) {
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      <Header title="Last check" subtitle={check ? `${timeOfDay(check.at)} · ${check.why}` : ' '} />
      <Faded>
        <ScrollView
          showsIndicators={false}
          modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
        >
          {check ? (
            <Column alignment="start" spacing={0} modifiers={[padding({ top: 20, bottom: 40 })]}>
              <Sections>
                <Read key="read" read={check.read} />
                {check.fixed.length ? (
                  <Column key="fixed" alignment="start" spacing={0}>
                    <SectionHead title="Fixed on its own" count={check.fixed.length} />
                    {check.fixed.map((note, i) => (
                      <NoteRow key={i} note={note} fixed />
                    ))}
                  </Column>
                ) : null}
                {check.flagged.length ? (
                  <Column key="flagged" alignment="start" spacing={0}>
                    <SectionHead title="For you to look at" count={check.flagged.length} />
                    {check.flagged.map((note, i) => (
                      <NoteRow key={i} note={note} />
                    ))}
                  </Column>
                ) : null}
              </Sections>
            </Column>
          ) : null}
        </ScrollView>
      </Faded>
    </Column>
  );
}

function Read({ read }: { read: Record<string, number> }) {
  return (
    <Row
      alignment="start"
      spacing={0}
      modifiers={[
        padding({ top: 16, bottom: 16, leading: 8, trailing: 8 }),
        frame({ maxWidth: Infinity }),
        background(theme.group),
        clipShape('roundedRectangle', 22),
        padding({ leading: INSET, trailing: INSET }),
      ]}
    >
      {Object.entries(read).map(([what, count]) => (
        <Column
          key={what}
          alignment="center"
          spacing={2}
          modifiers={[frame({ maxWidth: Infinity })]}
        >
          <Text
            textStyle={{ fontSize: 26, fontWeight: '600' }}
            modifiers={[foregroundStyle(theme.text)]}
          >
            {String(count)}
          </Text>
          <Text
            textStyle={{ fontSize: 13, lineHeight: 16 }}
            modifiers={[foregroundStyle(theme.secondary)]}
          >
            {what}
          </Text>
        </Column>
      ))}
    </Row>
  );
}

function NoteRow({ note, fixed = false }: { note: CheckNote; fixed?: boolean }) {
  return (
    <Row
      alignment="start"
      spacing={GAP}
      modifiers={[
        padding({ leading: INSET - 2, trailing: INSET, top: 10, bottom: 10 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
      ]}
    >
      <Mark state={fixed ? 'done' : 'needs'} />
      <Column
        alignment="start"
        spacing={3}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text
          textStyle={{ fontSize: 15, lineHeight: 20, fontWeight: '500' }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          {note.title}
        </Text>
        <Text
          textStyle={{ fontSize: 15, lineHeight: 20 }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {note.text}
        </Text>
        {note.did ? (
          <Text
            textStyle={{ fontSize: 15, lineHeight: 20, fontWeight: '500' }}
            modifiers={[foregroundStyle(theme.accent)]}
          >
            {note.did}
          </Text>
        ) : null}
      </Column>
    </Row>
  );
}
