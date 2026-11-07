import { useLocalSearchParams } from 'expo-router';

import LiveScreen from '@/call/call-screen';
import { STAGES } from '@/live/inbox';
import { TaskId } from '@/live/tasks';
import { SplitView } from '@/screens/split-view';

// A link opens the app at a place (scripts/duo-states): ?tasks for Tasks' list, &stage=<stage> on
// one of its tabs, ?tasks=<topic> for a topic, ?open=settings or ?open=calls for those sheets, ?report=pose to write the pose where
// checks read it, ?split=first or second to stand in for Split View. ?demo=call, a pretend call, is
// read where the call lives (src/app/_layout.tsx).
export default function Index() {
  const { tasks, stage, open, report, split } = useLocalSearchParams<{
    tasks?: string;
    stage?: string;
    open?: string;
    report?: string;
    split?: string;
  }>();
  const screen = (
    <LiveScreen
      opening={{
        tasks:
          tasks === undefined
            ? undefined
            : {
                task: tasks ? TaskId.parse(tasks) : undefined,
                stage: STAGES.find(({ key }) => key === stage)?.key,
              },
        open: open === 'settings' || open === 'calls' ? open : undefined,
        reportPose: report === 'pose',
        split: split === 'first' || split === 'second',
      }}
    />
  );
  return split === 'first' || split === 'second' ? (
    <SplitView side={split}>{screen}</SplitView>
  ) : (
    screen
  );
}
