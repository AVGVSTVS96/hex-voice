import { Column, Icon, Row, Spacer } from "@expo/ui";
import { ZStack } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  background,
  clipShape,
  contentShape,
  frame,
  opacity,
  padding,
  shapes,
  strokeBorder,
} from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import { Platform } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import { Hairline, SectionHead } from "@/components/tasks/parts";
import { PLACES, placeOf } from "@/live/inbox";
import type { Place, Tile } from "@/live/inbox";
import { clock } from "@/live/tasks";
import type { TaskId, TaskRow } from "@/live/tasks";
import { theme } from "@/theme";
import { Text } from "@/ui/text";
import { brand, metrics, space } from "@/ui/tokens";

const GLYPH: Record<Place, SFSymbol> = {
  telegram: "paperplane.fill",
  t3: "chevron.left.forwardslash.chevron.right",
  buzz: "bolt.fill",
  discord: "bubble.left.and.bubble.right.fill",
  server: "terminal.fill",
};

const QUIET_GHOSTS = new Set<Place>(["t3", "server"]);
const SHOWN = 5;
const DEVICE = Platform.OS === "ios" && Platform.isPad ? "iPad" : "iPhone";

interface TileLook {
  color: string;
  glyph: SFSymbol;
  ink: string;
}

const look = (tile: Tile): TileLook => {
  switch (tile.kind) {
    case "app": {
      return { color: brand[tile.place], glyph: GLYPH[tile.place], ink: brand.ink };
    }

    case "call": {
      return { color: brand.t3, glyph: "waveform", ink: brand.ink };
    }

    case "link": {
      return { color: brand.link, glyph: "arrow.up.right", ink: brand.ink };
    }

    default: {
      return tile satisfies never;
    }
  }
};

const hasLink = ({ link }: { link?: string | undefined }) => link !== undefined && link !== "";

export const swipeLook = (tile: Tile) => {
  const { color, glyph } = look(tile);

  return { color: tile.kind === "call" ? theme.accentSolid : color, glyph };
};

export const TileIcon = ({ tile, size }: { tile: Tile; size: number }) => {
  if (tile.kind === "app" && !hasLink(tile)) {
    return <Ghost place={tile.place} size={size} />;
  }

  return <Solid {...look(tile)} size={size} />;
};

export const PlaceTile = ({ place, size = metrics.list.tile }: { place: Place; size?: number }) => (
  <Solid color={brand[place]} glyph={GLYPH[place]} ink={brand.ink} size={size} />
);

const Solid = ({
  color,
  glyph,
  ink,
  size,
}: {
  color: string;
  glyph: SFSymbol;
  ink: string;
  size: number;
}) => (
  <Row
    alignment="center"
    spacing={0}
    modifiers={[
      frame({ width: size, height: size }),
      background(color),
      clipShape("roundedRectangle", size * metrics.tileCorner),
    ]}
  >
    <Icon name={glyph} size={size * 0.5} color={ink} />
  </Row>
);

const Ghost = ({ place, size }: { place: Place; size: number }) => {
  const ink = QUIET_GHOSTS.has(place) ? theme.secondary : brand[place];

  return (
    <ZStack alignment="center" modifiers={[frame({ width: size, height: size })]}>
      <Spacer
        modifiers={[
          frame({ width: size, height: size }),
          strokeBorder({
            content: ink,
            style: { lineWidth: 1 },
            shape: "roundedRectangle",
            cornerRadius: size * metrics.tileCorner,
          }),
          opacity(0.35),
        ]}
      />
      <Icon name={GLYPH[place]} size={size * 0.5} color={ink} />
    </ZStack>
  );
};

export const hasPlaces = (task: TaskRow, threads: TaskRow[]) =>
  threads.some((thread) => thread.id !== task.id);

export const Places = ({
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
  onOpenTask: (id: TaskId) => void;
}) => {
  const others = threads
    .filter((thread) => thread.id !== task.id)
    .sort((a, b) => Number(hasLink(b)) - Number(hasLink(a)) || Date.parse(b.at) - Date.parse(a.at));

  const all = [task, ...others];
  const [every, setEvery] = useState(false);
  const shown = every ? all : all.slice(0, SHOWN);
  const rest = all.length - shown.length;

  return (
    <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <SectionHead title="Places" count={all.length} />
      {shown.map((thread) => {
        const place = placeOf(thread.app);
        const gone = missing.has(place);
        const linked = hasLink(thread);
        const another = thread.id !== task.id;
        const opens = linked || another;
        const out = linked && !(another && thread.place !== task.place);

        const note = gone
          ? `${PLACES[place]} isn’t on this ${DEVICE}`
          : `${PLACES[place]} · ${clock(new Date(thread.at))}${linked ? "" : " · no link"}`;

        return (
          <Column
            key={thread.id}
            alignment="start"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity })]}
          >
            <Row
              alignment="center"
              spacing={space[3]}
              {...(opens && {
                onPress: () => {
                  if (out) {
                    onOpen(thread);
                  } else {
                    onOpenTask(thread.id);
                  }
                },
              })}
              modifiers={[
                padding({
                  leading: metrics.list.inset,
                  trailing: metrics.list.inset - space[1],
                  top: metrics.list.place,
                  bottom: metrics.list.place,
                }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
                contentShape(shapes.rectangle()),
                accessibilityLabel(`${thread.place}, ${note}`),
              ]}
            >
              <PlaceTile place={place} />
              <Column
                alignment="start"
                spacing={space[0.5]}
                modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
              >
                <Text numberOfLines={1} variant="detail" weight="medium">
                  {thread.place}
                </Text>
                <Text numberOfLines={1} variant="caption" tone={gone ? "danger" : "secondary"}>
                  {note}
                </Text>
              </Column>
              {opens ? (
                <Icon
                  name={out ? "arrow.up.right" : "chevron.right"}
                  size={12}
                  color={theme.tertiary}
                />
              ) : null}
            </Row>
            <Hairline />
          </Column>
        );
      })}
      {rest > 0 ? (
        <Text
          onPress={() => {
            setEvery(true);
          }}
          variant="detail"
          tone="secondary"
          modifiers={[
            padding({ leading: metrics.list.inset + space[10], top: space[3], bottom: space[1] }),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
          {`Show ${rest} more thread${rest === 1 ? "" : "s"}`}
        </Text>
      ) : null}
    </Column>
  );
};
