import { NativeTabs } from 'expo-router/native-tabs';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CallBar } from '@/components/call-bar';
import { useAppUpdates } from '@/hooks/use-app-updates';
import { LiveSessionProvider, useLiveSession } from '@/hooks/use-live-session';
import { useTaskCounts } from '@/hooks/use-tasks';
import { theme } from '@/theme';

export default function RootLayout() {
  const system = useColorScheme() === 'light' ? DefaultTheme : DarkTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <ThemeProvider
        value={{
          ...system,
          colors: {
            ...system.colors,
            background: theme.background,
            card: theme.surface,
            primary: theme.accent,
          },
        }}
      >
        <StatusBar style="auto" />
        <LiveSessionProvider>
          <Tabs />
        </LiveSessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// hex in one place, as OpenMuse lays out its agent: Chat to talk to any thread, Activity for
// everything running and waiting on you, and Call. A call goes on while you're in the others, held
// in a bar over the tabs.
function Tabs() {
  const { status } = useLiveSession();
  const onCall = status === 'connecting' || status === 'connected' || status === 'disconnecting';
  const { needs } = useTaskCounts();
  useAppUpdates(onCall);
  return (
    <NativeTabs tintColor={theme.text} minimizeBehavior="never">
      {onCall && (
        <NativeTabs.BottomAccessory>
          <CallBar />
        </NativeTabs.BottomAccessory>
      )}
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Chat</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble', selected: 'bubble.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" />
        {needs > 0 && <NativeTabs.Trigger.Badge>{String(needs)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="call" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label>Call</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="waveform" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
