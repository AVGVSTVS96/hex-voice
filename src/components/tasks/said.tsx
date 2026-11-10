import { Column, RNHostView, Row, Spacer } from "@expo/ui";
import { Text } from "@expo/ui/swift-ui";
import {
  background,
  clipShape,
  frame,
  lineLimit,
  onTapGesture,
  padding,
  textSelection,
} from "@expo/ui/swift-ui/modifiers";
import { createContext, useContext } from "react";

import { Markdown } from "@/components/markdown";
import { Album } from "@/components/media/thumb";
import { said } from "@/live/chat";
import type { Sending } from "@/live/chat";
import type { Shown } from "@/live/media";
import type { ChatTurn } from "@/live/tasks";
import { theme } from "@/theme";
import { textLook } from "@/ui/text";
import { metrics, radius, space } from "@/ui/tokens";

export const Selectable = createContext(true);

export const Said = ({ turn }: { turn: ChatTurn }) => {
  const one = said(turn);
  const selectable = useContext(Selectable);

  if (one.kind === "me") {
    return <Mine text={one.text} media={turn.media ?? []} />;
  }

  if (one.kind === "event") {
    return <Event text={one.text ? `${one.label} · ${one.text}` : one.label} />;
  }

  const media = turn.media ?? [];

  return (
    <Column
      alignment="start"
      spacing={space[2]}
      modifiers={[
        padding({ leading: metrics.list.inset, trailing: metrics.list.inset }),
        frame({ maxWidth: Infinity, alignment: "leading" }),
      ]}
    >
      {media.length ? (
        <RNHostView matchContents>
          <Album media={media} width={metrics.media.turn} side="start" />
        </RNHostView>
      ) : null}
      {one.text ? (
        <Markdown selectable={selectable} modifiers={[frame({ maxWidth: Infinity })]}>
          {one.text}
        </Markdown>
      ) : null}
    </Column>
  );
};

export const Sent = ({ sent, onRetry }: { sent: Sending; onRetry: () => void }) => (
  <Column alignment="end" spacing={space[1]} modifiers={[frame({ maxWidth: Infinity })]}>
    <Mine text={sent.text} media={sent.media} dim={!sent.failed} />
    <Row alignment="center" spacing={0} modifiers={[padding({ trailing: metrics.list.inset })]}>
      <Spacer flexible />
      <Text
        modifiers={[
          ...(sent.failed?.again === true ? [onTapGesture(onRetry)] : []),
          ...textLook({
            variant: "caption",
            weight: sent.failed ? "medium" : "regular",
            tone: sent.failed ? "danger" : "tertiary",
          }),
        ]}
      >
        {sentNote(sent)}
      </Text>
    </Row>
  </Column>
);

const sentNote = ({ failed }: Sending) => {
  if (!failed) {
    return "Sending";
  }

  return failed.again ? "Not sent · Tap to try again" : failed.why;
};

export const SaidLine = ({
  turn,
  named,
  lines,
}: {
  turn: ChatTurn;
  named: boolean;
  lines: number;
}) => {
  const one = said(turn);
  const who = one.kind === "hex" ? "hex" : "You";

  const media = turn.media ?? [];
  const text = lineOf(one);

  return (
    <Row
      alignment="start"
      spacing={space[3]}
      modifiers={[
        padding({
          leading: metrics.list.inset,
          trailing: metrics.list.inset,
          top: space[1],
          bottom: space[1],
        }),
      ]}
    >
      <Text
        modifiers={[
          ...textLook({ variant: "caption", weight: "medium", tone: "secondary" }),
          frame({ width: 30, alignment: "leading" }),
        ]}
      >
        {named ? who : ""}
      </Text>
      <Column
        alignment="start"
        spacing={space[1]}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        {media.length ? (
          <RNHostView matchContents>
            <Album media={media} width={metrics.media.line} side="start" />
          </RNHostView>
        ) : null}
        {text ? (
          <Markdown
            inline
            lines={lines}
            variant="detail"
            tone={one.kind === "event" ? "secondary" : "text"}
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            {text}
          </Markdown>
        ) : null}
      </Column>
    </Row>
  );
};

const lineOf = (one: ReturnType<typeof said>) => {
  if (one.kind === "event") {
    return one.text ? `${one.label} · ${one.text}` : one.label;
  }

  return one.text;
};

const Mine = ({ text, media, dim = false }: { text: string; media: Shown[]; dim?: boolean }) => {
  const selectable = useContext(Selectable);

  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        padding({ leading: metrics.bubbleRoom, trailing: metrics.list.inset - space[1] }),
      ]}
    >
      <Spacer flexible />
      <Column alignment="end" spacing={space[1]}>
        {media.length ? (
          <RNHostView matchContents>
            <Album media={media} width={metrics.media.turn} dim={dim} />
          </RNHostView>
        ) : null}
        {text ? (
          <Text
            modifiers={[
              ...textLook({ tone: dim ? "secondary" : "text", paragraph: true }),
              textSelection(selectable),
              padding({
                leading: metrics.bubbleX,
                trailing: metrics.bubbleX,
                top: metrics.bubbleY,
                bottom: metrics.bubbleY,
              }),
              background(theme.bubble),
              clipShape("roundedRectangle", radius.bubble),
            ]}
          >
            {text}
          </Text>
        ) : null}
      </Column>
    </Row>
  );
};

const Event = ({ text }: { text: string }) => (
  <Row
    alignment="center"
    spacing={0}
    modifiers={[padding({ leading: metrics.bubbleRoom, trailing: metrics.list.inset })]}
  >
    <Spacer flexible />
    <Text modifiers={[...textLook({ variant: "caption", tone: "secondary" }), lineLimit(3)]}>
      {text}
    </Text>
  </Row>
);
