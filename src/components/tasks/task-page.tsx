import { Column, Icon, Row, ScrollView } from "@expo/ui";
import { List } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  animation,
  background,
  clipShape,
  contentShape,
  frame,
  listStyle,
  monospacedDigit,
  padding,
  scrollClipDisabled,
  scrollContentBackground,
  scrollIndicators,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";

import { Reply, ReplyComposer, YourCall, useReplying } from "@/components/tasks/ask-card";
import type { Replying } from "@/components/tasks/ask-card";
import { Header } from "@/components/tasks/bar";
import type { Door } from "@/components/tasks/bar";
import { Lane } from "@/components/tasks/lane";
import { Mark } from "@/components/tasks/mark";
import type { MarkState } from "@/components/tasks/mark";
import { Faded, SectionHead, Sections, StageHead, listRow } from "@/components/tasks/parts";
import { Pinned } from "@/components/tasks/pinned";
import { PlaceTile, Places, TileIcon, hasPlaces } from "@/components/tasks/places";
import { Foot, WriteField } from "@/components/tasks/thread";
import { KIND, Live, Steps, TraceLine } from "@/components/tasks/trace";
import { useNow } from "@/hooks/use-now";
import type { Ask, AskOption } from "@/live/asks";
import {
  PLACES,
  isPart,
  placeOf,
  proofLinks,
  proofSays,
  proofWords,
  titleOf,
  tracksOf,
  waitingOf,
} from "@/live/inbox";
import type { Place, Tile } from "@/live/inbox";
import { STATE_WORDS, agentWords, atWork, clock, lastRun, taskTime } from "@/live/tasks";
import type { Finished, Task, TaskRow, TaskId, TaskState } from "@/live/tasks";
import { motion, rowsKey } from "@/motion";
import { theme } from "@/theme";
import { Text } from "@/ui/text";
import { metrics, radius, space } from "@/ui/tokens";

const PREVIEW = 3;

export const Detail = ({
  task,
  asks,
  answered,
  threads,
  missing,
  onSteps,
  onAnswer,
  onUndo,
  onAgain,
  onDismiss,
  onTalk,
  onOpen,
  onOpenTask,
  messages,
  beside = false,
  answering = false,
  onWrite,
  foot = 0,
}: {
  task: TaskRow | Task;
  asks: Ask[];
  answered: Record<string, string | null>;
  threads: TaskRow[];
  missing: Set<Place>;
  onSteps: (id: TaskId) => void;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onAgain: (ask: Ask) => void;
  onDismiss: (ask: Ask) => void;
  onTalk: () => void;
  onOpen: (thread: TaskRow) => void;
  onOpenTask: (id: TaskId) => void;
  messages?: ReactNode;
  beside?: boolean;
  answering?: boolean;
  onWrite?: (() => void) | undefined;
  foot?: number;
}) => {
  const full = "lately" in task ? task : undefined;
  const own = ownOf(task, threads);
  const under = [task, ...own.filter((one) => one.id !== task.id)];
  const waiting = waitingOf(under, asks).filter((one) => needOf(one) !== "");
  const needs = waiting.includes(task) ? needOf(task) : undefined;
  const lately = (full?.lately ?? []).filter((moment, i) => !(i === 0 && moment.text === needs));
  const working = under.filter((one) => one.state === "working");

  const open = asks.filter((ask) => (answered[ask.id] ?? "") === "").length;
  const tracks = laneOf(task, own);
  const now = useNow(false).getTime();
  const replying = useReplying();

  return (
    <Reply.Provider value={replying}>
      <Column alignment="center" spacing={0} modifiers={readable}>
        <Header
          title={titleOf(task)}
          subtitle={subtitleOf(task, open)}
          door={firstDoor(
            under.filter((one) => one.place === task.place),
            onOpen,
          )}
          call={{ about: titleOf(task), onPress: onTalk }}
        />
        <Faded>
          <List key={task.id} modifiers={pageList(asks, answered)}>
            {asks.length ? (
              <YourCall
                asks={asks}
                answered={answered}
                onAnswer={onAnswer}
                onUndo={onUndo}
                onAgain={onAgain}
                onDismiss={onDismiss}
              />
            ) : null}
            <Column alignment="start" spacing={0} modifiers={rest()}>
              <Sections follows={asks.length > 0}>
                {waiting.length ? (
                  <Column key="needs" alignment="start" spacing={0}>
                    <StageHead tint="needs" title="Needs you" />
                    <Column alignment="start" spacing={space[4]}>
                      {waiting.map((thread) => (
                        <Waiting key={thread.id} thread={thread} page={task} onOpen={onOpenTask} />
                      ))}
                    </Column>
                  </Column>
                ) : null}
                {working.length ? (
                  <Column key="working" alignment="start" spacing={0}>
                    <StageHead tint="working" title="Working" count={working.length} />
                    <AtWork
                      threads={working.map((thread) =>
                        thread.id === task.id && full ? full : thread,
                      )}
                      page={task}
                      onSteps={onSteps}
                    />
                  </Column>
                ) : null}
                {full && lastRun(full) ? (
                  <Column key="run" alignment="start" spacing={0}>
                    <SectionHead title="Last run" opens />
                    <Run
                      thread={full}
                      onPress={() => {
                        onSteps(full.id);
                      }}
                    />
                  </Column>
                ) : null}
                {full?.pin === undefined || full.pin === "" ? null : (
                  <Pinned key="pin" text={full.pin} />
                )}
                {messages}
                {hasPlaces(task, threads) ? (
                  <Places
                    key={`places:${task.id}`}
                    task={task}
                    threads={threads}
                    missing={missing}
                    onOpen={onOpen}
                    onOpenTask={onOpenTask}
                  />
                ) : null}
                {tracks.length ? (
                  <Column key="week" alignment="start" spacing={0}>
                    <SectionHead title="This week" />
                    <Row
                      alignment="center"
                      spacing={0}
                      modifiers={[
                        padding({ leading: metrics.list.inset, trailing: metrics.list.inset }),
                      ]}
                    >
                      <Lane tracks={tracks} now={now} />
                    </Row>
                  </Column>
                ) : null}
                {lately.length ? (
                  <Column key="lately" alignment="start" spacing={0}>
                    <SectionHead title="Lately" />
                    {lately.map((moment, i) => (
                      <TraceLine
                        key={`${moment.at} ${i}`}
                        lead={<Mark state={i === 0 ? moment.state : pastMark(moment.state)} />}
                        text={moment.text}
                        tone={i > 0 ? "secondary" : undefined}
                        time={clock(new Date(moment.at))}
                      />
                    ))}
                  </Column>
                ) : null}
              </Sections>
            </Column>
          </List>
        </Faded>
        <PageFoot
          replying={replying}
          asks={asks}
          answered={answered}
          onAnswer={onAnswer}
          foot={foot}
          write={{ title: titleOf(task), hidden: beside || answering, onWrite }}
        />
      </Column>
    </Reply.Provider>
  );
};

const PageFoot = ({
  replying,
  asks,
  answered,
  onAnswer,
  foot,
  write,
}: {
  replying: Replying;
  asks: Ask[];
  answered: Record<string, string | null>;
  onAnswer: (ask: Ask, option: AskOption) => void;
  foot: number;
  write?: { title: string; hidden: boolean; onWrite?: (() => void) | undefined };
}) => {
  const to = asks.find((one) => one.id === replying.ask?.id && (answered[one.id] ?? "") === "");

  if (to) {
    return (
      <Foot foot={foot}>
        <ReplyComposer
          key={to.id}
          ask={to}
          onAnswer={onAnswer}
          onClose={replying.close}
          onNoted={replying.note}
        />
      </Foot>
    );
  }

  return write?.onWrite && !write.hidden ? (
    <Foot foot={foot}>
      <WriteField title={write.title} onPress={write.onWrite} />
    </Foot>
  ) : null;
};

export const Asked = ({
  topic,
  asks,
  answered,
  door,
  rows,
  onAnswer,
  onUndo,
  onAgain,
  onDismiss,
}: {
  topic: string;
  asks: Ask[];
  answered: Record<string, string | null>;
  door?: Door | undefined;
  rows?: ReactNode[];
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onAgain: (ask: Ask) => void;
  onDismiss: (ask: Ask) => void;
}) => {
  const open = asks.filter((ask) => (answered[ask.id] ?? "") === "").length;
  const others = rows?.length ?? 0;
  const replying = useReplying();

  return (
    <Reply.Provider value={replying}>
      <Column alignment="center" spacing={0} modifiers={readable}>
        <Header
          title={topic}
          subtitle={open ? `${open} need${open === 1 ? "s" : ""} you` : `${others} here`}
          door={door}
        />
        <Faded>
          <List key={topic} modifiers={pageList(asks, answered)}>
            {asks.length ? (
              <YourCall
                asks={asks}
                answered={answered}
                onAnswer={onAnswer}
                onUndo={onUndo}
                onAgain={onAgain}
                onDismiss={onDismiss}
              />
            ) : null}
            {rows}
            <Column alignment="start" spacing={0} modifiers={rest()} />
          </List>
        </Faded>
        <PageFoot
          replying={replying}
          asks={asks}
          answered={answered}
          onAnswer={onAnswer}
          foot={0}
        />
      </Column>
    </Reply.Provider>
  );
};

export const DonePage = ({
  finished,
  door,
  onOpenLink,
  onOpenProject,
}: {
  finished: Finished;
  door?: Door | undefined;
  onOpenLink: (tile: Tile) => void;
  onOpenProject?: (() => void) | undefined;
}) => {
  const says = proofSays(finished.proof);
  const links = proofLinks(finished.proof);
  const at = clock(new Date(finished.at));

  return (
    <Column alignment="center" spacing={0} modifiers={readable}>
      <Header title={finished.topic} subtitle={`Done · ${at}`} door={door} />
      <Faded>
        <List modifiers={pageList([], {})}>
          <Column alignment="start" spacing={0} modifiers={rest()}>
            <Row
              alignment="start"
              spacing={metrics.list.gap}
              modifiers={[
                padding({
                  leading: metrics.list.inset,
                  trailing: metrics.list.inset,
                  top: space[4],
                }),
                frame({ maxWidth: Infinity, alignment: "leading" }),
                accessibilityLabel(`Done at ${at}: ${finished.title}`),
              ]}
            >
              <Mark state="done" />
              <Text
                paragraph
                variant="body"
                modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
              >
                {finished.title}
              </Text>
            </Row>
            {says || links.length ? (
              <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
                <SectionHead title="Proof" />
                {says ? (
                  <Text
                    paragraph
                    variant="detail"
                    tone="secondary"
                    modifiers={[
                      padding({
                        leading: metrics.list.inset,
                        trailing: metrics.list.inset,
                        bottom: space[2],
                      }),
                      frame({ maxWidth: Infinity, alignment: "leading" }),
                    ]}
                  >
                    {proofWords(finished.proof)}
                  </Text>
                ) : null}
                {links.map((link) => {
                  const url = tileUrl(link);

                  return (
                    <Way
                      key={url}
                      lead={<TileIcon tile={link} size={metrics.list.tile} />}
                      title={link.label}
                      note={url?.replace(/^https?:\/\//u, "") ?? ""}
                      out
                      onPress={() => {
                        onOpenLink(link);
                      }}
                    />
                  );
                })}
              </Column>
            ) : null}
            {onOpenProject ? (
              <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
                <SectionHead title="Project" />
                <Way
                  title={finished.topic}
                  note="Everything else it has going"
                  onPress={onOpenProject}
                />
              </Column>
            ) : null}
          </Column>
        </List>
      </Faded>
    </Column>
  );
};

const Way = ({
  lead,
  title,
  note,
  out = false,
  onPress,
}: {
  lead?: ReactNode;
  title: string;
  note: string;
  out?: boolean;
  onPress: () => void;
}) => (
  <Row
    alignment="center"
    spacing={space[3]}
    onPress={onPress}
    modifiers={[
      padding({
        leading: metrics.list.inset,
        trailing: metrics.list.inset - space[1],
        top: metrics.list.place,
        bottom: metrics.list.place,
      }),
      frame({ maxWidth: Infinity, alignment: "leading" }),
      contentShape(shapes.rectangle()),
      accessibilityLabel(`${title}, ${note}`),
    ]}
  >
    {lead}
    <Column
      alignment="start"
      spacing={space[0.5]}
      modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
    >
      <Text numberOfLines={1} variant="detail" weight="medium">
        {title}
      </Text>
      <Text numberOfLines={1} variant="caption" tone="secondary">
        {note}
      </Text>
    </Column>
    <Icon
      name={out ? "arrow.up.right" : "chevron.right"}
      size={metrics.symbol.small}
      color={theme.tertiary}
    />
  </Row>
);

const pageList = (asks: Ask[], answered: Record<string, string | null>) => [
  listStyle("plain"),
  scrollContentBackground("hidden"),
  scrollIndicators("hidden"),
  scrollClipDisabled(),
  frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" }),
  animation(motion.list, rowsKey(asks.map((ask) => `${ask.id}=${answered[ask.id] ?? ""}`))),
];

const Waiting = ({
  thread,
  page,
  onOpen,
}: {
  thread: TaskRow | Task;
  page: TaskRow | Task;
  onOpen: (id: TaskId) => void;
}) => {
  const other = thread.id !== page.id;
  const since = `on you since ${clock(new Date(thread.since))}`;

  return (
    <Column
      alignment="start"
      spacing={space[1]}
      {...(other && {
        onPress: () => {
          onOpen(thread.id);
        },
      })}
      modifiers={[
        padding({ leading: metrics.list.inset, trailing: metrics.list.inset }),
        frame({ maxWidth: Infinity, alignment: "leading" }),
        contentShape(shapes.rectangle()),
      ]}
    >
      <Text paragraph modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}>
        {needOf(thread)}
      </Text>
      <Text variant="detail" tone="secondary">
        {other ? `${fromOf(thread, page)} · waiting ${since}` : `Waiting ${since}`}
      </Text>
    </Column>
  );
};

const Run = ({ thread, onPress }: { thread: Task; onPress: () => void }) => {
  const agents = agentWords(thread.agents, false);

  return (
    <Column
      alignment="start"
      spacing={0}
      onPress={onPress}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: "leading" }),
        contentShape(shapes.rectangle()),
        accessibilityLabel(`${thread.place}, ${STATE_WORDS[thread.state]}. Shows its steps`),
      ]}
    >
      <Steps steps={thread.steps.slice(0, PREVIEW)} agents={thread.agents} opens={false} />
      {agents === undefined ? null : (
        <TraceLine
          lead={<Icon name={KIND.agent} size={metrics.symbol.small} color={theme.secondary} />}
          text={agents}
          tone="secondary"
        />
      )}
    </Column>
  );
};

const AtWork = ({
  threads,
  page,
  onSteps,
}: {
  threads: (TaskRow | Task)[];
  page: TaskRow | Task;
  onSteps: (id: TaskId) => void;
}) => {
  const lead = threads.find((one) => one.id === page.id) ?? threads[0];

  if (!lead) {
    return null;
  }

  const others = threads.filter((one) => one !== lead);

  const agents = threads.flatMap((owner) =>
    atWork(owner.agents).map((agent) => ({ agent, owner })),
  );

  const now = [lead.id === page.id ? "" : lead.place, nowOf(lead)].filter(Boolean).join(": ");

  return (
    <Column alignment="start" spacing={0}>
      <Row
        alignment="center"
        spacing={metrics.list.gap}
        onPress={() => {
          onSteps(lead.id);
        }}
        modifiers={[
          padding({
            leading: metrics.list.inset - space[0.5],
            trailing: metrics.list.inset - space[0.5],
            top: space[1],
            bottom: space[3],
          }),
          frame({ maxWidth: Infinity, alignment: "leading" }),
          contentShape(shapes.rectangle()),
          accessibilityLabel(`Now: ${now}, for ${taskTime(lead)}. Shows its steps`),
        ]}
      >
        <Row alignment="center" spacing={0} modifiers={[frame({ width: metrics.list.mark })]}>
          <Live />
        </Row>
        <Text numberOfLines={1} modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}>
          {now}
        </Text>
        <Text variant="caption" tone="tertiary" modifiers={[monospacedDigit()]}>
          {taskTime(lead)}
        </Text>
        <Icon name="chevron.right" size={metrics.symbol.small} color={theme.tertiary} />
      </Row>
      {others.length || agents.length ? (
        <ScrollView direction="horizontal" showsIndicators={false}>
          <Row
            alignment="start"
            spacing={space[2]}
            modifiers={[
              padding({
                leading: metrics.list.inset,
                trailing: metrics.list.inset,
                bottom: space[2],
              }),
            ]}
          >
            {others.map((thread) => (
              <Card
                key={thread.id}
                lead={<PlaceTile place={placeOf(thread.app)} size={metrics.list.mark} />}
                name={thread.place}
                time={taskTime(thread)}
                text={nowOf(thread)}
                onPress={() => {
                  onSteps(thread.id);
                }}
              />
            ))}
            {agents.map(({ agent, owner }) => (
              <Card
                key={agent.id}
                lead={
                  <Row
                    alignment="center"
                    spacing={0}
                    modifiers={[
                      frame({ width: metrics.list.mark, height: metrics.list.mark }),
                      background(theme.fill),
                      clipShape("roundedRectangle", radius.mark),
                    ]}
                  >
                    <Icon name={KIND.agent} size={metrics.symbol.mark} color={theme.secondary} />
                  </Row>
                }
                name={agent.label.replace(/^.*\//u, "")}
                time=""
                text={agent.line ?? `In ${owner.place}`}
                onPress={() => {
                  onSteps(owner.id);
                }}
              />
            ))}
          </Row>
        </ScrollView>
      ) : null}
    </Column>
  );
};

const nowOf = (thread: TaskRow | Task) => {
  const running =
    "steps" in thread ? thread.steps.find((step) => step.state === "running") : undefined;

  return running?.text ?? (thread.line || "Starting");
};

const Card = ({
  lead,
  name,
  time,
  text,
  onPress,
}: {
  lead: ReactNode;
  name: string;
  time: string;
  text: string;
  onPress: () => void;
}) => (
  <Column
    alignment="start"
    spacing={space[1]}
    onPress={onPress}
    modifiers={[
      padding({ leading: space[3], trailing: space[3], top: space[3], bottom: space[3] }),
      frame({ width: metrics.list.card, alignment: "topLeading" }),
      background(theme.card),
      clipShape("roundedRectangle", radius.bubble),
      contentShape(shapes.rectangle()),
      accessibilityLabel(`${name}${time ? `, ${time}` : ""}: ${text}. Shows its steps`),
    ]}
  >
    <Row alignment="center" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
      {lead}
      <Text
        numberOfLines={1}
        variant="detail"
        weight="medium"
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        {name}
      </Text>
      {time ? (
        <Text variant="caption" tone="tertiary" modifiers={[monospacedDigit()]}>
          {time}
        </Text>
      ) : null}
    </Row>
    <Text
      numberOfLines={2}
      variant="caption"
      tone="secondary"
      paragraph
      modifiers={[
        frame({ maxWidth: Infinity, minHeight: metrics.list.line * 2, alignment: "topLeading" }),
      ]}
    >
      {text}
    </Text>
  </Column>
);

const firstDoor = (threads: (TaskRow | Task)[], onOpen: (thread: TaskRow) => void) => {
  const door = threads.find((one) => (one.link ?? "") !== "");

  return (
    door && {
      place: placeOf(door.app),
      onPress: () => {
        onOpen(door);
      },
    }
  );
};

const laneOf = (task: TaskRow | Task, threads: TaskRow[]) =>
  tracksOf(task.name, threads.length > 0 ? threads : [task]);

const needOf = (thread: TaskRow | Task) =>
  ("needs" in thread ? thread.needs : undefined) ?? thread.line;

const fromOf = (thread: TaskRow | Task, page: TaskRow | Task) =>
  thread.place === page.place ? PLACES[placeOf(thread.app)] : thread.place;

const pastMark = (state: TaskState): MarkState => (state === "failed" ? "failed" : "read");

const tileUrl = (tile: Tile) => {
  if (tile.kind === "link") {
    return tile.url;
  }

  return tile.kind === "app" ? tile.link : "";
};

const ownOf = (task: TaskRow | Task, threads: TaskRow[]) => (isPart(task) ? [] : threads);

const subtitleOf = (task: TaskRow | Task, open: number) =>
  [...(isPart(task) ? [task.name] : []), standingOf(task, open)].join(" · ");

const standingOf = (task: TaskRow | Task, open: number) => {
  const time = taskTime(task);
  const asks = open ? `${open} need${open === 1 ? "s" : ""} you` : "";

  if (task.state === "working") {
    return [asks, `working for ${time}`].filter(Boolean).join(" · ");
  }

  if (task.state === "needs") {
    return `${asks || STATE_WORDS.needs} since ${time}`;
  }

  return [asks, `${STATE_WORDS[task.state]} ${time}`].filter(Boolean).join(" · ");
};

const readable = [
  frame({ maxWidth: metrics.readable, maxHeight: Infinity, alignment: "top" }),
  frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" }),
];

const rest = () => [padding({ bottom: space[10] }), frame({ maxWidth: Infinity }), ...listRow()];
