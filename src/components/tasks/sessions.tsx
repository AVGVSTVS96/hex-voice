import { Column, Row, ScrollView, Spacer } from "@expo/ui";
import { HStack } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  animation,
  clipped,
  frame,
  layoutPriority,
  padding,
  scrollClipDisabled,
} from "@expo/ui/swift-ui/modifiers";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Linking } from "react-native";

import { Header, PageChrome } from "@/components/tasks/bar";
import type { Back, Chrome } from "@/components/tasks/bar";
import { Mark } from "@/components/tasks/mark";
import { PAGED, PageAt, STACKED, upTo } from "@/components/tasks/page-at";
import { levelsOf, spotOf, Showing } from "@/components/tasks/pages";
import type { Level, Pages, Room, Spot } from "@/components/tasks/pages";
import {
  Empty,
  Faded,
  Loading,
  SectionHead,
  Sections,
  UNREACHED,
  rowFrame,
} from "@/components/tasks/parts";
import { Count, Meta } from "@/components/tasks/rows";
import { StepsLoading, Trace } from "@/components/tasks/trace";
import { useToolbarBack } from "@/components/toolbar-back";
import { useNow } from "@/hooks/use-now";
import { useTask, useTasks } from "@/hooks/use-tasks";
import type { Counts } from "@/hooks/use-tasks";
import { taskIn, titleOf } from "@/live/inbox";
import { STATE_WORDS, agentWords, atWork, taskTime } from "@/live/tasks";
import type { TaskId, TaskRow } from "@/live/tasks";
import { motion, rowsKey } from "@/motion";
import { theme } from "@/theme";
import { Text } from "@/ui/text";
import { metrics, space } from "@/ui/tokens";

import { PagesView } from "../../../modules/pages";

export const SessionTasks = ({
  open,
  onCounts,
  pages,
  room,
}: {
  open: boolean;
  onCounts: (counts: Counts | undefined) => void;
  pages: Pages;
  room: Room;
}) => {
  const { tasks, version, offline } = useTasks(open);
  const { needs, working } = countsOf(tasks ?? []);
  const chosen = chosenOf(pages, tasks ?? []);
  const traced = useTask(chosen, version);

  const spot = (level: Level) => spotOf(level, pages, room);

  useEffect(() => {
    if (!open || !tasks) {
      return;
    }

    onCounts({ needs, working });

    return () => {
      onCounts(undefined);
    };
  }, [open, tasks, needs, working, onCounts]);

  const names: Record<Level | "call", string> = {
    call: "Call",
    list: "Tasks",
    topic: "Steps",
    thread: "",
    steps: "",
    check: "",
    picks: "",
    pick: "",
  };

  const backTo = (back: Level | "call"): Back => ({ to: names[back], onPress: pages.back });

  const shownBack = pages.levels.map(spot).find((at) => at.shown && at.back !== undefined)?.back;

  const inToolbar = useToolbarBack(
    "tasks",
    open && shownBack ? backTo(shownBack) : undefined,
    room.paged,
  );

  const chromeOf = ({ back }: Spot): Chrome => ({
    back: back && !inToolbar ? backTo(back) : undefined,
  });

  const page = (level: Level, children: ReactNode) => {
    const at = spot(level);

    return (
      <PageAt key={level} paged={room.paged}>
        <PageChrome.Provider value={chromeOf(at)}>
          <Showing.Provider value={open && at.shown}>{children}</Showing.Provider>
        </PageChrome.Provider>
      </PageAt>
    );
  };

  return (
    <PagesView
      pages={["list", "topic"]}
      one={levelsOf(pages, "one")}
      two={levelsOf(pages, "panes")}
      columns={levelsOf(pages, "columns")}
      {...(room.paged ? PAGED : STACKED)}
      meet={room.meet ?? 0}
      edge={theme.edge}
      onShape={pages.placed}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: "top" }),
        upTo(),
        clipped(),
        animation(motion.page, rowsKey([...pages.path, chosen ?? ""])),
      ]}
    >
      {[
        page(
          "list",
          <SessionList
            tasks={tasks}
            failed={offline && !tasks}
            selected={pages.shape === "one" ? null : chosen}
            onOpen={(id) => {
              pages.go({ to: "topic", id });
            }}
          />,
        ),
        page(
          "topic",
          traced.task ? (
            <Trace
              task={traced.task}
              focus={pages.agent}
              onOpen={(link) => {
                void Linking.openURL(link).catch(() => null);
              }}
            />
          ) : (
            <StepsLoading {...traced} />
          ),
        ),
      ]}
    </PagesView>
  );
};

const countsOf = (tasks: TaskRow[]): Counts => ({
  needs: tasks.filter((row) => row.state === "needs").length,
  working: tasks.filter((row) => row.state === "working").length,
});

const chosenOf = (pages: Pages, tasks: TaskRow[]) => {
  const holder = tasks.find((row) => row.agents.some((agent) => agent.id === pages.agent));
  const first = pages.shape === "one" ? undefined : tasks[0];

  return taskIn(pages.task) ?? holder?.id ?? first?.id ?? null;
};

const SECTIONS = [
  { title: "Needs you", has: (row: TaskRow) => row.state === "needs" },
  { title: "Working", has: (row: TaskRow) => row.state === "working" },
  { title: "Earlier", has: (row: TaskRow) => row.state !== "needs" && row.state !== "working" },
];

const SessionList = ({
  tasks,
  failed,
  selected,
  onOpen,
}: {
  tasks: TaskRow[] | undefined;
  failed: boolean;
  selected: TaskId | null;
  onOpen: (id: TaskId) => void;
}) => {
  const { working } = countsOf(tasks ?? []);
  const now = useNow(working > 0);

  const sections = SECTIONS.flatMap(({ title, has }) => {
    const rows = (tasks ?? []).filter(has);

    return rows.length ? [{ title, rows }] : [];
  });

  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" })]}
    >
      <Header title="Tasks" subtitle={working ? `${working} working` : " "} />
      {tasks ? (
        <Faded>
          <ScrollView
            showsIndicators={false}
            modifiers={[
              scrollClipDisabled(),
              frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" }),
            ]}
          >
            <Column alignment="start" spacing={0} modifiers={[padding({ bottom: space[10] })]}>
              {sections.length ? (
                <Sections>
                  {sections.map(({ title, rows }) => (
                    <Column key={title} alignment="start" spacing={0}>
                      <SectionHead title={title} count={rows.length} />
                      {rows.map((row) => (
                        <SessionRow
                          key={row.id}
                          row={row}
                          now={now}
                          selected={row.id === selected}
                          onOpen={() => {
                            onOpen(row.id);
                          }}
                        />
                      ))}
                    </Column>
                  ))}
                </Sections>
              ) : (
                <Empty text="Nothing yet" />
              )}
            </Column>
          </ScrollView>
        </Faded>
      ) : (
        <Unloaded failed={failed} />
      )}
    </Column>
  );
};

const Unloaded = ({ failed }: { failed: boolean }) =>
  failed ? <Empty text={UNREACHED} /> : <Loading />;

const SessionRow = ({
  row,
  now,
  selected,
  onOpen,
}: {
  row: TaskRow;
  now: Date;
  selected: boolean;
  onOpen: () => void;
}) => {
  const working = row.state === "working";
  const agents = atWork(row.agents).length;
  const lines = [row.line, agentWords(row.agents, working) ?? ""].filter(Boolean);

  return (
    <Row
      alignment="start"
      spacing={metrics.list.gap}
      onPress={onOpen}
      modifiers={[
        ...rowFrame(selected),
        accessibilityLabel(`${titleOf(row)}, ${STATE_WORDS[row.state]}. Shows its steps`),
      ]}
    >
      <Mark state={row.state} />
      <Column
        alignment="start"
        spacing={metrics.list.lines}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <HStack
          alignment="firstTextBaseline"
          spacing={space[2]}
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          <Text numberOfLines={1} variant="headline" modifiers={[layoutPriority(1)]}>
            {titleOf(row)}
          </Text>
          {working && agents ? <Count count={agents} mark="working" /> : null}
          <Spacer flexible />
          <Meta text={taskTime(row, now)} />
        </HStack>
        {lines.map((line, i) => (
          <Row key={line} alignment="start" spacing={0}>
            <Text
              numberOfLines={i === 0 ? 2 : 1}
              variant="detail"
              tone={i === 0 ? "secondary" : "tertiary"}
              paragraph
              modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
            >
              {line}
            </Text>
          </Row>
        ))}
      </Column>
    </Row>
  );
};
