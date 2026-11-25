import { Column, ScrollView } from "@expo/ui";
import {
  animation,
  clipped,
  frame,
  padding,
  scrollClipDisabled,
} from "@expo/ui/swift-ui/modifiers";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Linking } from "react-native";

import { Header, PageChrome } from "@/components/tasks/bar";
import type { Back, Chrome } from "@/components/tasks/bar";
import { PAGED, PageAt, STACKED, upTo } from "@/components/tasks/page-at";
import { levelsOf, spotOf, Showing } from "@/components/tasks/pages";
import type { Level, Pages, Room, Spot } from "@/components/tasks/pages";
import { Empty, Faded, Loading, SectionHead, Sections, UNREACHED } from "@/components/tasks/parts";
import { Lead, StepsLoading, Trace, TraceLine, Under } from "@/components/tasks/trace";
import { useToolbarBack } from "@/components/toolbar-back";
import { useAgentSteps, useAgents } from "@/hooks/use-agents";
import { useNow } from "@/hooks/use-now";
import type { Counts } from "@/hooks/use-tasks";
import { agentTask } from "@/live/agents";
import type { Agent } from "@/live/agents";
import { agentMeta } from "@/live/tasks";
import type { TaskId } from "@/live/tasks";
import { motion, rowsKey } from "@/motion";
import { theme } from "@/theme";
import { space } from "@/ui/tokens";

import { PagesView } from "../../../modules/pages";

export const AgentTasks = ({
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
  const { agents, failed } = useAgents(open);
  const working = agents?.filter((agent) => agent.state === "working") ?? [];
  const chosen = pages.task ?? (pages.shape === "one" ? null : (agents?.[0]?.id ?? null));
  const agent = agents?.find((one) => one.id === chosen);
  const steps = useAgentSteps(agent ? agent.id : null);
  const spot = (level: Level) => spotOf(level, pages, room);

  useEffect(() => {
    if (!open || !agents) {
      return;
    }

    onCounts({ needs: 0, working: working.length });

    return () => {
      onCounts(undefined);
    };
  }, [open, agents, working.length, onCounts]);

  const names: Record<Level | "call", string> = {
    call: "Call",
    list: "Tasks",
    topic: agent?.label ?? "Steps",
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

  const trace =
    agent && steps.steps ? (
      <Trace
        task={agentTask(agent, steps.steps)}
        onOpen={(link) => {
          void Linking.openURL(link).catch(() => null);
        }}
      />
    ) : (
      <StepsLoading failed={steps.failed} refused={undefined} />
    );

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
          <AgentList
            agents={agents}
            failed={failed}
            onOpen={(id) => {
              pages.go({ to: "topic", id });
            }}
          />,
        ),
        page("topic", trace),
      ]}
    </PagesView>
  );
};

const AgentList = ({
  agents,
  failed,
  onOpen,
}: {
  agents: Agent[] | undefined;
  failed: boolean;
  onOpen: (id: TaskId) => void;
}) => {
  const working = agents?.filter((agent) => agent.state === "working") ?? [];
  const earlier = agents?.filter((agent) => agent.state !== "working") ?? [];

  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" })]}
    >
      <Header title="Tasks" subtitle={working.length ? `${working.length} working` : " "} />
      {agents ? (
        <Faded>
          <ScrollView
            showsIndicators={false}
            modifiers={[
              scrollClipDisabled(),
              frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" }),
            ]}
          >
            <Column alignment="start" spacing={0} modifiers={[padding({ bottom: space[10] })]}>
              {agents.length ? (
                <Sections>
                  {working.length ? (
                    <Rows key="working" title="Working" agents={working} onOpen={onOpen} />
                  ) : null}
                  {earlier.length ? (
                    <Rows key="earlier" title="Earlier" agents={earlier} onOpen={onOpen} />
                  ) : null}
                </Sections>
              ) : (
                <Empty text="No agents yet" />
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

const Rows = ({
  title,
  agents,
  onOpen,
}: {
  title: string;
  agents: Agent[];
  onOpen: (id: TaskId) => void;
}) => {
  const now = useNow(agents.some((agent) => agent.state === "working"));

  return (
    <Column alignment="start" spacing={0}>
      <SectionHead title={title} count={agents.length} />
      {agents.map((agent) => {
        const meta = agentMeta(agent, now);

        return (
          <TraceLine
            key={agent.id}
            lead={<Lead state={agent.state} />}
            text={agent.label}
            time={meta}
            label={`${agent.label}, ${agent.place}, ${meta || agent.state}. Shows its steps`}
            onPress={() => {
              onOpen(agent.id);
            }}
          >
            <Under text={agent.place} />
          </TraceLine>
        );
      })}
    </Column>
  );
};
