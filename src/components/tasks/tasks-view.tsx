import { Column, Row, Spacer, Text } from "@expo/ui";
import { ProgressView, ZStack } from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  animation,
  background,
  clipped,
  foregroundStyle,
  frame,
  offset,
  scrollDismissesKeyboard,
} from "@expo/ui/swift-ui/modifiers";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Linking } from "react-native";

import { TASKS } from "@/call/stage";
import { PageChrome } from "@/components/tasks/bar";
import type { Back, Chrome, Door } from "@/components/tasks/bar";
import { LastCheck } from "@/components/tasks/last-check";
import { ListPage } from "@/components/tasks/list";
import { levelsOf, shapeOf, spotOf, usePages, Showing, Typing } from "@/components/tasks/pages";
import type { Level, Move, Pages, Room, Spot, Stack } from "@/components/tasks/pages";
import { feel } from "@/components/tasks/parts";
import { PickPage, PicksPage, usePickChoices } from "@/components/tasks/picks";
import { EntryRow } from "@/components/tasks/rows";
import { Selectable } from "@/components/tasks/said";
import { Asked, Detail, DonePage } from "@/components/tasks/task-page";
import { Messages, ThreadPage } from "@/components/tasks/thread";
import { StepsLoading, Trace } from "@/components/tasks/trace";
import { useToolbarBack } from "@/components/toolbar-back";
import { useAsks, useCheck } from "@/hooks/use-asks";
import { useChat } from "@/hooks/use-chat";
import { useTask, useTasks } from "@/hooks/use-tasks";
import type { Counts } from "@/hooks/use-tasks";
import type { Ask, AskOption } from "@/live/asks";
import {
  asksOf,
  homeOf,
  inboxEntries,
  openingStage,
  pageOf,
  picksOf,
  placeOf,
  doneIn,
  stageCounts,
  stageTopics,
  taskIn,
  titleOf,
  topicIn,
} from "@/live/inbox";
import type { Entry, PageId, Place, Tab, Tile } from "@/live/inbox";
import type { Task, TaskId, TaskRow } from "@/live/tasks";
import { motion, rowsKey } from "@/motion";
import { theme } from "@/theme";

import { PagesView } from "../../../modules/pages";

export interface TasksProps {
  open: boolean;
  stack: Stack;
  onMove: (move: Move) => void;
  haptics: boolean;
  onTalk: (task: TaskRow) => void;
  onGoThrough: () => void;
  onOpenCall: (id: string) => void;
  onCounts: (counts: Counts | undefined) => void;
}

export const TasksView = ({
  width,
  foot = 0,
  ...view
}: TasksProps & { width: number; foot?: number }) => {
  const room = { width, foot, paged: false };
  const pages = usePages({ stack: view.stack, onMove: view.onMove, shape: shapeOf(room) });

  return <Tasks {...view} pages={pages} room={room} />;
};

export const Tasks = ({
  open,
  haptics,
  onTalk,
  onGoThrough,
  onOpenCall,
  onCounts,
  pages,
  room,
}: TasksProps & { pages: Pages; room: Room }) => {
  const { tasks, finished, version, offline, current } = useTasks(open);
  const yours = useAsks(open);
  const [missing, setMissing] = useState<Set<Place>>(new Set());
  const [typing, setTyping] = useState<Level | null>(null);
  const choices = usePickChoices();
  const traced = useTask(pages.stepsOf, version);
  const checked = useCheck(pages.path.includes("check") ? yours.list?.check?.at : undefined);
  const touch = feel(haptics);
  const { tick, tap } = touch;

  const entries = useMemo(
    () => inboxEntries(tasks ?? [], finished, yours.list, yours.shown),
    [tasks, finished, yours.list, yours.shown],
  );

  const loaded = !!(yours.list && tasks);

  const stage =
    pages.stage ?? (loaded ? openingStage(stageCounts(entries, yours.answered)) : "needs");

  useEffect(() => {
    if (open && loaded && !pages.stage) {
      pages.go({ to: "stage", stage });
    }
  }, [open, loaded, pages.stage, stage]);

  const showing = showingOf(pages, entries, stage, tasks);
  const { task } = useTask(taskIn(showing), version);
  const asked = yours.shown.find((ask) => ask.task === showing);
  const opened = openedOf(task, tasks, showing, asked);
  const did = finished.find((one) => one.id === doneIn(showing));
  const topic = topicOf(opened, asked, showing);
  const threads = threadsOf(opened, tasks);
  const topicAsks = asksIn(yours.shown, opened, topic, pages.row);

  const said = useChat(opened ? opened.id : null, open);

  const answer = (ask: Ask, option: AskOption) => {
    tap();
    yours.answer(ask, option);
  };

  const undo = (ask: Ask) => {
    tick();
    yours.undo(ask.id);
  };

  const again = (ask: Ask) => {
    tap();
    yours.again(ask);
  };

  const dismiss = (ask: Ask) => {
    tap();
    yours.dismiss(ask);
  };

  const openLink = async (link: string, place: Place) => {
    tap();

    try {
      await Linking.openURL(link);
    } catch {
      setMissing(new Set([...missing, place]));

      return;
    }

    if (missing.has(place)) {
      setMissing(new Set([...missing].filter((one) => one !== place)));
    }
  };

  const doorTo = (link: string, place: Place): Door => ({
    place,
    onPress: () => {
      void openLink(link, place);
    },
  });

  const openThread = ({ link, app }: TaskRow) => {
    if (link !== undefined) {
      void openLink(link, placeOf(app));
    }
  };

  const doorOf = (ask: Ask) => {
    const where = ask.places.find((one) => (one.link ?? "") !== "");

    return where?.link === undefined ? undefined : doorTo(where.link, placeOf(where.app));
  };

  const openTile = (tile: Tile) => {
    if (tile.kind === "app") {
      if (tile.link !== undefined && tile.link !== "") {
        void openLink(tile.link, tile.place);
      }

      return;
    }

    tap();

    if (tile.kind === "call") {
      onOpenCall(tile.call);
    } else {
      void Linking.openURL(tile.url).catch(() => null);
    }
  };

  const openSteps = (id: TaskId) => {
    tick();
    pages.go({ to: "steps", id });
  };

  const write = (typed: boolean) => {
    tick();
    pages.go({ to: "thread", write: typed });
  };

  const talk = (thread: TaskRow) => {
    tick();
    onTalk(thread);
  };

  const spot = (level: Level) => spotOf(level, pages, room);

  const names = namesOf(opened);

  const backTo = (back: Level | "call"): Back => ({
    to: names[back],
    onPress:
      back === "call"
        ? pages.back
        : () => {
            tick();
            pages.back();
          },
  });

  const shownBack = pages.levels.map(spot).find((at) => at.shown && at.back !== undefined)?.back;

  const inToolbar = useToolbarBack(
    "tasks",
    open && shownBack ? backTo(shownBack) : undefined,
    room.paged,
  );

  const chromeOf = ({ back }: Spot): Chrome => ({
    back: back && !inToolbar ? backTo(back) : undefined,
  });

  const typingOn = (level: Level) => (on: boolean) => {
    setTyping((was) => {
      if (on) {
        return level;
      }

      return was === level ? null : was;
    });

    if (on) {
      pages.go({ to: "composerFocused" });
    }
  };

  const moved = rowsKey([...pages.path, pages.stepsOf ?? "", pages.pick ?? ""]);

  const page = (level: Level, children: ReactNode) => {
    const at = spot(level);

    return (
      <PageAt key={level} spot={at} paged={room.paged} moved={moved}>
        <PageChrome.Provider value={chromeOf(at)}>
          <Showing.Provider value={open && at.shown}>
            <Typing.Provider value={typingOn(level)}>
              <Selectable.Provider value={typing !== level}>{children}</Selectable.Provider>
            </Typing.Provider>
          </Showing.Provider>
        </PageChrome.Provider>
      </PageAt>
    );
  };

  const picks = picksOf(entries, yours.answered);

  const list = (
    <ListPage
      open={open}
      stage={stage}
      pages={pages}
      spot={spot("list")}
      tasks={tasks}
      entries={entries}
      offline={offline}
      current={current}
      yours={yours}
      feel={touch}
      onAnswer={answer}
      onUndo={undo}
      onOpenTile={openTile}
      onGoThrough={onGoThrough}
      onCounts={onCounts}
    />
  );

  const paired = spot("topic").shown && spot("thread").shown;

  const topicPage = () => {
    if (opened) {
      return (
        <Detail
          task={opened}
          asks={topicAsks}
          answered={yours.answered}
          threads={threads}
          missing={missing}
          onSteps={openSteps}
          onAnswer={answer}
          onUndo={undo}
          onAgain={again}
          onDismiss={dismiss}
          onTalk={() => {
            talk(opened);
          }}
          onOpen={openThread}
          onOpenTask={(id) => {
            tick();
            pages.go({ to: "topic", id });
          }}
          messages={
            !paired && said.chat && (said.chat.total || said.chat.sends) ? (
              <Messages
                key="messages"
                thread={opened}
                chat={said.chat}
                onOpen={() => {
                  write(false);
                }}
              />
            ) : undefined
          }
          beside={paired}
          answering={typing === "topic"}
          onWrite={
            !paired && said.sends
              ? () => {
                  write(true);
                }
              : undefined
          }
          foot={spot("topic").foot}
        />
      );
    }

    if (did) {
      const { run } = did;

      return (
        <DonePage
          finished={did}
          door={
            did.link === undefined || did.link === ""
              ? undefined
              : doorTo(did.link, placeOf(did.app))
          }
          onOpenLink={openTile}
          onOpenProject={
            run !== undefined && run !== "" && tasks?.some((row) => row.id === run) === true
              ? () => {
                  tick();
                  pages.go({ to: "topic", id: run });
                }
              : undefined
          }
        />
      );
    }

    if (topic !== undefined && topic !== "") {
      return (
        <Asked
          topic={topic}
          asks={topicAsks}
          answered={yours.answered}
          door={asked && doorOf(asked)}
          rows={entries
            .filter((entry) => entry.topic === topic && entry.kind !== "ask")
            .map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                answered={yours.answered}
                onOpen={(id) => {
                  pages.go({ to: "topic", id });
                }}
                onOpenTile={openTile}
                onAnswer={answer}
                onUndo={undo}
                onDismiss={dismiss}
                onAgain={again}
                onAct={(id) => {
                  tap();
                  void yours.act(id);
                }}
                onRead={(id) => {
                  tick();
                  void yours.read(id);
                }}
              />
            ))}
          onAnswer={answer}
          onUndo={undo}
          onAgain={again}
          onDismiss={dismiss}
        />
      );
    }

    return <Nothing loaded={!!tasks} />;
  };

  const content = {
    topic: topicPage(),
    thread: opened ? (
      <ThreadPage
        thread={opened}
        beside={paired}
        chat={said.chat}
        pending={said.pending}
        failed={said.failed}
        focus={pages.focusComposer}
        foot={spot("thread").foot}
        onOpen={openThread}
        onSteps={() => {
          openSteps(opened.id);
        }}
        onSend={said.send}
        onRetry={said.retry}
        onStop={() => {
          tap();
          void said.stop();
        }}
        onTalk={() => {
          talk(opened);
        }}
      />
    ) : (
      <Spacer />
    ),
    steps: traced.task ? (
      <Trace
        task={traced.task}
        onOpen={(link) => {
          void openLink(link, "t3");
        }}
      />
    ) : (
      <StepsLoading {...traced} />
    ),
    check: <LastCheck {...checked} />,
    picks: (
      <PicksPage
        picks={picks}
        choices={choices}
        open={pages.path.at(-1) === "pick" ? pages.pick : null}
        foot={spot("picks").foot}
        onOpen={(id) => {
          tick();
          pages.go({ to: "pick", id });
        }}
        onTake={(taken) => {
          tap();

          for (const { ask, option } of taken) {
            yours.answer(ask, option);
          }

          choices.clear();
          pages.go({ to: "back" });
        }}
      />
    ),
    pick: <PickPage picked={picks.find(({ ask }) => ask.id === pages.pick)} choices={choices} />,
  };

  const levels = PUSHED.map((level) => page(level, content[level]));

  const fill = [
    frame({ maxWidth: Infinity, alignment: "top" }),
    upTo(),
    clipped(),
    scrollDismissesKeyboard("immediately"),
  ];

  if (pages.shape === "columns") {
    return (
      <Row alignment="start" spacing={0} modifiers={fill}>
        <Column
          alignment="start"
          spacing={0}
          modifiers={[frame({ width: spot("list").width, alignment: "top" }), upTo()]}
        >
          {list}
        </Column>
        <Column
          alignment="start"
          spacing={0}
          modifiers={[frame({ width: 1 }), upTo(), background(theme.edge)]}
        >
          <Spacer />
        </Column>
        <ZStack alignment="top" modifiers={fill}>
          {levels}
        </ZStack>
      </Row>
    );
  }

  if (room.paged) {
    const children = [page("list", list), ...levels];

    return (
      <PagesView
        pages={["list", ...PUSHED]}
        one={levelsOf(pages, "one")}
        two={levelsOf(pages, "panes")}
        page={TASKS}
        meet={room.meet ?? 0}
        onPaired={pages.placed}
        modifiers={[...fill, animation(motion.page, moved)]}
      >
        {children}
      </PagesView>
    );
  }

  return (
    <ZStack alignment="top" modifiers={fill}>
      {page("list", list)}
      {levels}
    </ZStack>
  );
};

const PUSHED = ["topic", "thread", "steps", "check", "picks", "pick"] as const satisfies Level[];

const showingOf = (pages: Pages, entries: Entry[], stage: Tab, tasks: TaskRow[] = []) => {
  const leading = (
    pages.shape !== "one" && (pages.task ?? "") === "" ? stageTopics(entries, stage) : []
  ).at(0);

  return pages.task ?? (leading ? homeOf(pageOf(leading), tasks) : null);
};

const openedOf = (
  task: Task | undefined,
  tasks: TaskRow[] | undefined,
  showing: PageId | null,
  asked: Ask | undefined,
) =>
  task ??
  tasks?.find((row) => row.id === showing) ??
  (asked ? newestOf((tasks ?? []).filter((row) => row.name === asked.topic)) : undefined);

const topicOf = (
  opened: TaskRow | Task | undefined,
  asked: Ask | undefined,
  showing: PageId | null,
) => {
  const alone = opened || asked ? undefined : topicIn(showing);

  return opened?.name ?? asked?.topic ?? alone;
};

const threadsOf = (opened: TaskRow | Task | undefined, tasks: TaskRow[] | undefined) =>
  opened ? (tasks ?? []).filter((row) => row.name === opened.name) : [];

const asksIn = (
  shown: Ask[],
  opened: TaskRow | Task | undefined,
  topic: string | undefined,
  row: string | null,
) =>
  topic === undefined || topic === ""
    ? []
    : (opened ? asksOf(opened, shown) : shown.filter((ask) => ask.topic === topic)).sort(
        (a, b) => Number(b.id === row) - Number(a.id === row),
      );

const namesOf = (opened: TaskRow | Task | undefined): Record<Level | "call", string> => ({
  call: "Call",
  list: "Tasks",
  topic: opened ? titleOf(opened) : "Topic",
  thread: opened ? titleOf(opened) : "Thread",
  steps: "Steps",
  check: "Last check",
  picks: "hex’s picks",
  pick: "Question",
});

const newestOf = (rows: TaskRow[]) => {
  let newest: TaskRow | undefined;

  for (const row of rows) {
    if (!newest || Date.parse(row.at) > Date.parse(newest.at)) {
      newest = row;
    }
  }

  return newest;
};

const Nothing = ({ loaded }: { loaded: boolean }) => (
  <Column
    alignment="center"
    spacing={0}
    modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}
  >
    {loaded ? (
      <Text textStyle={{ fontSize: 15 }} modifiers={[foregroundStyle(theme.tertiary)]}>
        Pick a project
      </Text>
    ) : (
      <ProgressView />
    )}
  </Column>
);

const PageAt = ({
  spot,
  paged,
  moved,
  children,
}: {
  spot: Spot;
  paged: boolean;
  moved: number;
  children: ReactNode;
}) => {
  const fills = [frame({ maxWidth: Infinity, alignment: "top" }), upTo()];

  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={
        paged
          ? fills
          : [
              ...fills,
              background(theme.sheet),
              offset(spot.offset),
              animation(motion.page, moved),
              accessibilityHidden(!spot.shown),
            ]
      }
    >
      {children}
    </Column>
  );
};

const upTo = () => frame({ minHeight: 0, maxHeight: Infinity, alignment: "top" });
