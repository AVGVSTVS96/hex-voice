import { Host } from '@expo/ui/swift-ui';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TasksView } from '@/components/tasks/tasks-view';
import { useCallPreferences } from '@/hooks/use-call-preferences';
import { useLiveSession } from '@/hooks/use-live-session';
import { useVoicePreference } from '@/hooks/use-voice-preference';
import { asksAPI, tasksAPI } from '@/live/api';
import type { Stage } from '@/live/inbox';
import { theme } from '@/theme';

// Everything hex has going, full screen: what waits on you, what's working, what's done. Talking a
// task through, or going through your asks, happens on a call: on one already, hex brings it up;
// otherwise one starts about it.
export default function Activity() {
  const { stage } = useLocalSearchParams<{ stage?: Stage }>();
  const open = useIsFocused();
  const at = useMemo(() => (stage ? { stage } : {}), [stage]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const session = useLiveSession();
  const { voice, loaded } = useVoicePreference();
  const { haptics } = useCallPreferences();
  const onCall = session.status !== 'idle' && session.status !== 'error';
  const call = (about: string, talk: () => Promise<void>) => {
    if (onCall) void talk().catch(() => {});
    else if (loaded) void session.start(voice, about);
    router.navigate('/call');
  };
  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <Host seedColor={theme.tint} ignoreSafeArea="container" style={styles.fill}>
        <TasksView
          open={open}
          at={at}
          width={width}
          foot={insets.bottom + 12}
          haptics={haptics}
          onTalk={(task) => call(task.id, () => tasksAPI.talk(task.id))}
          onGoThrough={() => call('asks', () => asksAPI.talk())}
          onOpenCall={() => router.navigate('/call')}
        />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.sheet },
  fill: { flex: 1 },
});
