import { Column, Icon, Row, Text } from '@expo/ui';
import { Button, Label, Menu, ShareLink } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  clipShape,
  contentShape,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { Platform } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Hairline, INSET, Lane, SectionHead, ios } from '@/components/tasks/parts';
import { PLACES, placeOf, type Place } from '@/live/inbox';
import { clock, type TaskRow } from '@/live/tasks';
import { theme } from '@/theme';

// Each app's own mark: its symbol on its own color, so a row says where it lives at a glance.
const GLYPH: Record<Place, SFSymbol> = {
  telegram: 'paperplane.fill',
  t3: 'chevron.left.forwardslash.chevron.right',
  buzz: 'bolt.fill',
  discord: 'bubble.left.and.bubble.right.fill',
  server: 'terminal.fill',
};
export const PLACE_COLOR: Record<Place, string> = {
  telegram: '#2AABEE',
  t3: '#3A3A3C',
  buzz: '#E9A23B',
  discord: '#5865F2',
  server: '#636366',
};
const SHOWN = 5;
const DEVICE = Platform.OS === 'ios' && Platform.isPad ? 'iPad' : 'iPhone';

export function PlaceTile({ place, size = 28 }: { place: Place; size?: number }) {
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        frame({ width: size, height: size }),
        background(PLACE_COLOR[place]),
        clipShape('roundedRectangle', size * 0.27),
      ]}
    >
      <Icon name={GLYPH[place]} size={size * 0.5} color="#FFFFFF" />
    </Row>
  );
}

// The topic's threads, each a door into its own app with its own lane: the open thread first, then
// those with a link, newest first. One without a link opens its page here instead. An app missing
// from this device says so in its row.
export function Places({
  task,
  threads,
  missing,
  lane,
  onOpen,
  onOpenTask,
}: {
  task: TaskRow;
  threads: TaskRow[];
  missing: Set<Place>;
  lane: number;
  onOpen: (thread: TaskRow) => void;
  onOpenTask: (id: string) => void;
}) {
  const others = threads
    .filter((thread) => thread.id !== task.id)
    .sort((a, b) => Number(!!b.link) - Number(!!a.link) || Date.parse(b.at) - Date.parse(a.at));
  const all = [task, ...others];
  if (all.length < 2 && !task.link) return null;
  const rest = all.length - SHOWN;
  return (
    <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <SectionHead title="Places" count={all.length} />
      {all.slice(0, SHOWN).map((thread) => {
        const place = placeOf(thread.app);
        const gone = missing.has(place);
        const note = gone
          ? `${PLACES[place]} isn’t on this ${DEVICE}`
          : `${PLACES[place]} · ${clock(new Date(thread.at))}${thread.link ? '' : ' · no link'}`;
        return (
          <Column
            key={thread.id}
            alignment="start"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity })]}
          >
            <Row
              alignment="center"
              spacing={12}
              onPress={() =>
                thread.link ? onOpen(thread) : thread.id !== task.id && onOpenTask(thread.id)
              }
              modifiers={[
                padding({ leading: INSET, trailing: INSET - 4, top: 11, bottom: 11 }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
                contentShape(shapes.rectangle()),
                ...(ios ? [accessibilityLabel(`${thread.place}, ${note}`)] : []),
              ]}
            >
              <PlaceTile place={place} />
              <Column
                alignment="start"
                spacing={1}
                modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
              >
                <Text
                  numberOfLines={1}
                  textStyle={{ fontSize: 15, fontWeight: '500' }}
                  modifiers={[foregroundStyle(theme.text)]}
                >
                  {thread.place}
                </Text>
                <Text
                  numberOfLines={1}
                  textStyle={{ fontSize: 13 }}
                  modifiers={[foregroundStyle(gone ? theme.danger : theme.secondary)]}
                >
                  {note}
                </Text>
              </Column>
              {thread.track.length ? <Lane tracks={[thread.track]} width={lane} /> : null}
              <Icon
                name={thread.link ? 'arrow.up.right' : 'chevron.right'}
                size={12}
                color={theme.tertiary}
              />
            </Row>
            <Hairline />
          </Column>
        );
      })}
      {rest > 0 ? (
        <Text
          textStyle={{ fontSize: 13 }}
          modifiers={[
            foregroundStyle(theme.tertiary),
            padding({ leading: INSET + 40, top: 10, bottom: 4 }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        >
          {`${rest} more thread${rest === 1 ? '' : 's'} in ${task.name}`}
        </Text>
      ) : null}
    </Column>
  );
}

// The split button: its app's mark and name open the thread where it lives, and its arrow lists
// every place the topic has a link, each in its own app's mark, and sharing the link.
export function OpenIn({
  task,
  threads,
  onOpen,
}: {
  task: TaskRow;
  threads: TaskRow[];
  onOpen: (thread: TaskRow) => void;
}) {
  const linked = [task, ...threads.filter((one) => one.id !== task.id)].filter((one) => one.link);
  const [first] = linked;
  if (!first) return null;
  const place = placeOf(first.app);
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        frame({ height: 50 }),
        frame({ maxWidth: Infinity }),
        background(theme.surface),
        clipShape('capsule'),
        ...(ios ? [accessibilityLabel(`Open in ${PLACES[place]}`)] : []),
      ]}
    >
      <Row
        alignment="center"
        spacing={8}
        onPress={() => onOpen(first)}
        modifiers={[
          padding({ leading: 14, trailing: 6 }),
          frame({ height: 50 }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <PlaceTile place={place} size={22} />
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 16, fontWeight: '500' }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          {PLACES[place]}
        </Text>
      </Row>
      <Menu
        label={
          <Row
            alignment="center"
            spacing={0}
            modifiers={[
              frame({ width: 40, height: 50 }),
              contentShape(shapes.rectangle()),
              ...(ios ? [accessibilityLabel('Other places')] : []),
            ]}
          >
            <Icon name="chevron.down" size={12} color={theme.secondary} />
          </Row>
        }
      >
        {linked.map((thread) => (
          <Button
            key={thread.id}
            label={`${PLACES[placeOf(thread.app)]} · ${thread.place}`}
            systemImage={GLYPH[placeOf(thread.app)]}
            onPress={() => onOpen(thread)}
          />
        ))}
        <ShareLink item={first.link!} subject={task.name}>
          <Label title="Share link" systemImage="square.and.arrow.up" />
        </ShareLink>
      </Menu>
    </Row>
  );
}
