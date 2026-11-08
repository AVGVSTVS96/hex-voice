import { Column, Row, ScrollView } from "@expo/ui";
import {
  background,
  clipShape,
  frame,
  padding,
  scrollClipDisabled,
} from "@expo/ui/swift-ui/modifiers";

import { Header } from "@/components/tasks/bar";
import { Mark } from "@/components/tasks/mark";
import { Faded, SectionHead, Sections, Waiting } from "@/components/tasks/parts";
import type { Answered } from "@/hooks/use-watch";
import type { Check, CheckNote } from "@/live/asks";
import { timeOfDay } from "@/live/calls";
import { theme } from "@/theme";
import { Text } from "@/ui/text";
import { metrics, radius, space } from "@/ui/tokens";

export const LastCheck = ({ check, ...answered }: Answered & { check?: Check }) => (
  <Column
    alignment="center"
    spacing={0}
    modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" })]}
  >
    <Header title="Last check" subtitle={check ? `${timeOfDay(check.at)} · ${check.why}` : " "} />
    <Faded>
      <ScrollView
        showsIndicators={false}
        modifiers={[
          scrollClipDisabled(),
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" }),
        ]}
      >
        {check ? (
          <Column
            alignment="start"
            spacing={0}
            modifiers={[padding({ top: space[5], bottom: space[10] })]}
          >
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
        ) : (
          <Waiting {...answered} gone="This check isn’t there any more." />
        )}
      </ScrollView>
    </Faded>
  </Column>
);

const Read = ({ read }: { read: Record<string, number> }) => (
  <Row
    alignment="start"
    spacing={0}
    modifiers={[
      padding({ top: space[4], bottom: space[4], leading: space[2], trailing: space[2] }),
      frame({ maxWidth: Infinity }),
      background(theme.card),
      clipShape("roundedRectangle", radius.group),
      padding({ leading: metrics.list.inset, trailing: metrics.list.inset }),
    ]}
  >
    {Object.entries(read).map(([what, count]) => (
      <Column
        key={what}
        alignment="center"
        spacing={space[0.5]}
        modifiers={[frame({ maxWidth: Infinity })]}
      >
        <Text variant="title">{String(count)}</Text>
        <Text variant="caption" tone="secondary">
          {what}
        </Text>
      </Column>
    ))}
  </Row>
);

const NoteRow = ({ note, fixed = false }: { note: CheckNote; fixed?: boolean }) => (
  <Row
    alignment="start"
    spacing={metrics.list.gap}
    modifiers={[
      padding({
        leading: metrics.list.inset - space[0.5],
        trailing: metrics.list.inset,
        top: space[3],
        bottom: space[3],
      }),
      frame({ maxWidth: Infinity, alignment: "leading" }),
    ]}
  >
    <Mark state={fixed ? "done" : "needs"} />
    <Column
      alignment="start"
      spacing={space[1]}
      modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
    >
      <Text variant="detail" weight="medium" paragraph>
        {note.title}
      </Text>
      <Text variant="detail" tone="secondary" paragraph>
        {note.text}
      </Text>
      {note.did === undefined || note.did === "" ? null : (
        <Text variant="detail" weight="medium" paragraph>
          {note.did}
        </Text>
      )}
    </Column>
  </Row>
);
