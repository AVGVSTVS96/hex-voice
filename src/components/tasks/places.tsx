import { Column, Icon, Row, Spacer, Text } from '@expo/ui';
import { ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  clipShape,
  contentShape,
  foregroundStyle,
  frame,
  opacity,
  padding,
  shapes,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';
import { Platform } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Lane } from '@/components/tasks/lane';
import { Hairline, INSET, SectionHead, ios } from '@/components/tasks/parts';
import { PLACES, placeOf, type Place, type Tile } from '@/live/inbox';
import { clock, type TaskRow } from '@/live/tasks';
import { theme } from '@/theme';

const GLYPH: Record<Place, SFSymbol> = {
  telegram: 'paperplane.fill',
  t3: 'chevron.left.forwardslash.chevron.right',
  buzz: 'bolt.fill',
  discord: 'bubble.left.and.bubble.right.fill',
  server: 'terminal.fill',
};
const PLACE_COLOR: Record<Place, string> = {
  telegram: '#2AABEE',
  t3: '#3A3A3C',
  buzz: '#E9A23B',
  discord: '#5865F2',
  server: '#636366',
};
// Too dark to show as a ring and a symbol on the sheet, so a ghost of theirs is drawn quieter.
const DARK: Place[] = ['t3', 'server'];
const SHOWN = 5;
const DEVICE = Platform.OS === 'ios' && Platform.isPad ? 'iPad' : 'iPhone';

function look(tile: Tile): { color: string; glyph: SFSymbol; ink: string } {
  switch (tile.kind) {
    case 'app':
      return { color: PLACE_COLOR[tile.place], glyph: GLYPH[tile.place], ink: '#FFFFFF' };
    case 'call':
      return { color: '#1B3534', glyph: 'waveform', ink: '#C4F3E5' };
    case 'link':
      return { color: '#8E8E93', glyph: 'arrow.up.right', ink: '#FFFFFF' };
  }
}

export function swipeLook(tile: Tile) {
  const { color, glyph } = look(tile);
  return { color: tile.kind === 'call' ? theme.accentSolid : color, glyph };
}

// A thread without a link is a ghost: we know it's from there, but there's no door.
export function TileIcon({ tile, size }: { tile: Tile; size: number }) {
  if (tile.kind === 'app' && !tile.link) return <Ghost place={tile.place} size={size} />;
  return <Solid {...look(tile)} size={size} />;
}

export function PlaceTile({ place, size = 28 }: { place: Place; size?: number }) {
  return <Solid color={PLACE_COLOR[place]} glyph={GLYPH[place]} ink="#FFFFFF" size={size} />;
}

function Solid({
  color,
  glyph,
  ink,
  size,
}: {
  color: string;
  glyph: SFSymbol;
  ink: string;
  size: number;
}) {
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        frame({ width: size, height: size }),
        background(color),
        clipShape('roundedRectangle', size * 0.27),
      ]}
    >
      <Icon name={glyph} size={size * 0.5} color={ink} />
    </Row>
  );
}

function Ghost({ place, size }: { place: Place; size: number }) {
  const ink = DARK.includes(place) ? theme.secondary : PLACE_COLOR[place];
  return (
    <ZStack alignment="center" modifiers={[frame({ width: size, height: size })]}>
      <Spacer
        modifiers={[
          frame({ width: size, height: size }),
          strokeBorder({
            content: ink,
            style: { lineWidth: 1 },
            shape: 'roundedRectangle',
            cornerRadius: size * 0.27,
          }),
          opacity(0.35),
        ]}
      />
      <Icon name={GLYPH[place]} size={size * 0.5} color={ink} />
    </ZStack>
  );
}

export const hasPlaces = (task: TaskRow, threads: TaskRow[]) =>
  !!task.link || threads.some((thread) => thread.id !== task.id);

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
