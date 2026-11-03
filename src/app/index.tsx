import { useLocalSearchParams } from 'expo-router';

import LiveScreen from '@/call/call-screen';
import { TaskId } from '@/live/tasks';

// A link opens the app at a place (scripts/duo-states): ?tasks for Tasks' list, ?tasks=<topic>
// for a topic, ?open=settings or ?open=calls for those sheets, ?report=pose to write the pose where
// checks read it. ?demo=call, a pretend call, is read where the call lives (src/app/_layout.tsx).
export default function Index() {
  const { tasks, open, report } = useLocalSearchParams<{
    tasks?: string;
    open?: string;
    report?: string;
  }>();
  return (
    <LiveScreen
      opening={{
        tasks: tasks === undefined ? undefined : { task: tasks ? TaskId.parse(tasks) : undefined },
        open: open === 'settings' || open === 'calls' ? open : undefined,
        reportPose: report === 'pose',
      }}
    />
  );
}
