import { Column, Icon, Row, Spacer, Text } from '@expo/ui';
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
import type { SFSymbol } from 'sf-symbols-typescript';

import { GroupHead, Inset, ios } from '@/components/tasks/parts';
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
const SHOWN = 5;
const TILE: Record<Place, string> = {
  telegram: '#2AABEE',
  t3: '#2C2C2E',
  buzz: '#E9A23B',
  discord: '#5865F2',
  server: '#636366',
};

// "◂ Telegram" after a row's name.
export function PlaceTag({ place }: { place: Place }) {
  return (
    <Row alignment="center" spacing={4}>
      <Icon name={GLYPH[place]} size={10} color={theme.tertiary} />
      <Text
        numberOfLines={1}
        textStyle={{ fontSize: 13 }}
        modifiers={[foregroundStyle(theme.tertiary)]}
      >
        {PLACES[place]}
      </Text>
    </Row>
  );
}

export function PlaceTile({ place, size = 28 }: { place: Place; size?: number }) {
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        frame({ width: size, height: size }),
        background(TILE[place]),
        clipShape('roundedRectangle', size * 0.27),
      ]}
    >
      <Icon name={GLYPH[place]} size={size * 0.46} color="#FFFFFF" />
    </Row>
  );
}

// What a thread is called where it lives: a Telegram topic by its name, a T3 thread by what it
// did last, since hex knows it by its project.
function placeTitle(task: TaskRow) {
  if (task.app === 'telegram') return task.where === 'Telegram' ? `${task.name} topic` : task.where;
  if (task.app === 't3') return task.line || 'T3 Code thread';
  return task.name;
}

// The topic's threads, each a door into its own app: the open thread first, then those with a
// link, newest first. One without a link opens its page here instead.
export function Places({
  task,
  threads,
  missing,
  onOpen,
  onOpenTask,
}: {
  task: TaskRow;
  threads: TaskRow[];
  missing: Set<Place>;
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
      <GroupHead title="Places" count={all.length} />
      <Inset>
        <Column
          alignment="start"
          spacing={0}
          modifiers={[
            padding({ top: 6 }),
            frame({ maxWidth: Infinity }),
            background(theme.group),
            clipShape('roundedRectangle', 18),
          ]}
        >
          {all.slice(0, SHOWN).map((thread) => {
            const place = placeOf(thread.app);
            const note = missing.has(place)
              ? `${PLACES[place]} isn’t on this iPhone`
              : `${PLACES[place]} · ${clock(new Date(thread.at))}${thread.link ? '' : ' · no link'}`;
            return (
              <Row
                key={thread.id}
                alignment="center"
                spacing={12}
                onPress={() =>
                  thread.link ? onOpen(thread) : thread.id !== task.id && onOpenTask(thread.id)
                }
                modifiers={[
                  padding({ leading: 14, trailing: 16, top: 9, bottom: 9 }),
                  frame({ maxWidth: Infinity, alignment: 'leading' }),
                  contentShape(shapes.rectangle()),
                  ...(ios ? [accessibilityLabel(`${placeTitle(thread)}, ${note}`)] : []),
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
                    {placeTitle(thread)}
                  </Text>
                  <Text
                    numberOfLines={1}
                    textStyle={{ fontSize: 13 }}
                    modifiers={[
                      foregroundStyle(missing.has(place) ? theme.danger : theme.tertiary),
                    ]}
                  >
                    {note}
                  </Text>
                </Column>
                <Icon
                  name={thread.link ? 'arrow.up.right' : 'chevron.right'}
                  size={12}
                  color={theme.tertiary}
                />
              </Row>
            );
          })}
          {rest > 0 ? (
            <Text
              textStyle={{ fontSize: 13 }}
              modifiers={[
                foregroundStyle(theme.tertiary),
                padding({ leading: 54, top: 4, bottom: 12 }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
              ]}
            >
              {`${rest} more thread${rest === 1 ? '' : 's'} in ${task.name}`}
            </Text>
          ) : (
            <Spacer style={{ height: 6 }} />
          )}
        </Column>
      </Inset>
    </Column>
  );
}

// The split button: its app's mark and name open the thread where it lives, and its arrow lists
// every other place the topic has a link, and sharing the link.
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
        frame({ height: 52 }),
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
          frame({ height: 52 }),
          contentShape(shapes.rectangle()),
        ]}
      >
        <PlaceTile place={place} size={24} />
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 17, fontWeight: '500' }}
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
              frame({ width: 40, height: 52 }),
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
            label={`${PLACES[placeOf(thread.app)]} · ${placeTitle(thread)}`}
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
