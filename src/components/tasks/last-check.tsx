import { Column, Row, ScrollView, Text } from '@expo/ui';
import {
  background,
  clipShape,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { GroupHead, Header, INSET, Mark } from '@/components/tasks/parts';
import type { Check, CheckNote } from '@/live/asks';
import { timeOfDay } from '@/live/calls';
import { theme } from '@/theme';

// What hex's last check read, what it fixed on its own, and what it wants you to look at.
export function LastCheck({ check, onBack }: { check?: Check; onBack: () => void }) {
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      <Header
        title="Last check"
        subtitle={check ? `${timeOfDay(check.at)} · ${check.why}` : ' '}
        onBack={onBack}
      />
      <ScrollView
        showsIndicators={false}
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
      >
        {check ? (
          <Column alignment="start" spacing={8} modifiers={[padding({ top: 14, bottom: 40 })]}>
            <Read read={check.read} />
            {check.fixed.length ? (
              <Column alignment="start" spacing={0}>
                <GroupHead title="Fixed on its own" count={check.fixed.length} />
                {check.fixed.map((note, i) => (
                  <NoteRow key={i} note={note} fixed />
                ))}
              </Column>
            ) : null}
            {check.flagged.length ? (
              <Column alignment="start" spacing={0}>
                <GroupHead title="For you to look at" count={check.flagged.length} />
                {check.flagged.map((note, i) => (
                  <NoteRow key={i} note={note} />
                ))}
              </Column>
            ) : null}
          </Column>
        ) : null}
      </ScrollView>
    </Column>
  );
}

// How much it read, as a row of numbers.
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
      spacing={12}
      modifiers={[
        padding({ leading: INSET, trailing: INSET, top: 10, bottom: 10 }),
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
          textStyle={{ fontSize: 17, lineHeight: 21, fontWeight: '500' }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          {note.title}
        </Text>
        <Text
          textStyle={{ fontSize: 15, lineHeight: 19 }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {note.text}
        </Text>
        {note.did ? (
          <Text
            textStyle={{ fontSize: 15, lineHeight: 19, fontWeight: '500' }}
            modifiers={[foregroundStyle(theme.accent)]}
          >
            {note.did}
          </Text>
        ) : null}
      </Column>
    </Row>
  );
}
