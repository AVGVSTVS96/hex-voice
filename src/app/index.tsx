import { useLocalSearchParams } from "expo-router";

import LiveScreen from "@/call/call-screen";
import { TABS } from "@/live/inbox";
import { TaskId } from "@/live/tasks";
import { SplitView } from "@/screens/split-view";

const Index = () => {
  const { tasks, stage, open, report, split, share, size, update } = useLocalSearchParams<{
    tasks?: string;
    stage?: string;
    open?: string;
    report?: string;
    split?: string;
    share?: string;
    size?: string;
    update?: string;
  }>();

  const screen = (
    <LiveScreen
      opening={{
        tasks:
          tasks === undefined
            ? undefined
            : {
                task: tasks ? TaskId.parse(tasks) : undefined,
                stage: TABS.find(({ key }) => key === stage)?.key,
              },
        open: open === "settings" || open === "calls" ? open : undefined,
        reportPose: report === "pose",
        compact: (split === "first" || split === "second") && size !== "regular",
        update: update === "demo" ? DEMO_UPDATE : undefined,
      }}
    />
  );

  return split === "first" || split === "second" ? (
    <SplitView side={split} share={shareOf(share)}>
      {screen}
    </SplitView>
  ) : (
    screen
  );
};

const shareOf = (share?: string) => {
  const part = Number(share);

  return part > 0 && part < 1 ? part : 0.5;
};

const DEMO_UPDATE = { version: 0, runtime: "demo", install: "hexvoice:///" };

export default Index;
