import { useLocalSearchParams } from 'expo-router';

import LiveScreen from '@/screens/live-screen';

// A link opens the app at a place (scripts/duo-states): ?tasks for Tasks' list, ?tasks=<topic>
// for a topic, ?open=settings or ?open=calls for those sheets, ?demo=call for a pretend call,
// ?report=pose to write the pose where checks read it.
export default function Index() {
  const { tasks, open, demo, report } = useLocalSearchParams<{
    tasks?: string;
    open?: string;
    demo?: string;
    report?: string;
  }>();
  return (
    <LiveScreen
      opening={{
        tasks: tasks === undefined ? undefined : { task: tasks || undefined },
        open: open === 'settings' || open === 'calls' ? open : undefined,
        demoCall: demo === 'call',
        reportPose: report === 'pose',
      }}
    />
  );
}
