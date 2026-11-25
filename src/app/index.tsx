import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import LiveScreen from "@/call/call-screen";
import type { Opening } from "@/call/call-screen";
import type { Asking } from "@/components/tasks/pages";
import { AskId } from "@/live/asks";
import { TABS } from "@/live/inbox";
import { TaskId } from "@/live/tasks";
import { SplitView } from "@/screens/split-view";

type Params = Partial<Record<string, string | string[]>>;

const Index = () => {
  const params = useLocalSearchParams<Params>();
  const split = one(params.split);
  const link = useLink();
  const screen = <LiveScreen opening={openingOf(params)} link={link} />;

  return split === "first" || split === "second" ? (
    <SplitView side={split} share={shareOf(one(params.share))}>
      {screen}
    </SplitView>
  ) : (
    screen
  );
};

const useLink = () => {
  const [link, setLink] = useState<Opening>();

  useEffect(() => {
    const heard = Linking.addEventListener("url", ({ url }) => {
      setLink(openingOf(Linking.parse(url).queryParams ?? {}));
    });

    return () => {
      heard.remove();
    };
  }, []);

  return link;
};

const one = (value: string | string[] | undefined) => [value].flat()[0];

const openingOf = (params: Params): Opening => {
  const tasks = one(params.tasks);
  const ask = one(params.ask);
  const open = one(params.open);
  const split = one(params.split);

  const asking: Asking | undefined =
    ask === undefined || ask === ""
      ? undefined
      : { id: AskId.parse(ask), open: open === "reply" || open === "camera" ? open : undefined };

  return {
    tasks:
      tasks === undefined && !asking
        ? undefined
        : {
            task: tasks === undefined || tasks === "" ? undefined : TaskId.parse(tasks),
            stage: TABS.find(({ key }) => key === one(params.stage))?.key,
            ask: asking,
          },
    open: open === "settings" || open === "calls" ? open : undefined,
    reportPose: one(params.report) === "pose",
    compact: (split === "first" || split === "second") && one(params.size) !== "regular",
    update: one(params.update) === "demo" ? DEMO_UPDATE : undefined,
  };
};

const shareOf = (share?: string) => {
  const part = Number(share);

  return part > 0 && part < 1 ? part : 0.5;
};

const DEMO_UPDATE = { version: 0, runtime: "demo", install: "" };

export default Index;
