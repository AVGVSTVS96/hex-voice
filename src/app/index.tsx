import { useLocalSearchParams } from 'expo-router';

import LiveScreen from '@/call/call-screen';
import { TABS } from '@/live/inbox';
import { TaskId } from '@/live/tasks';
import { SplitView } from '@/screens/split-view';

const Index = () => {
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
                stage: TABS.find(({ key }) => key === stage)?.key,
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
};

export default Index;
