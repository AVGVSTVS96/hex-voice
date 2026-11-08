import { useGlobalSearchParams } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CallProvider } from '@/call/use-call';
import { theme } from '@/theme';

const RootLayout = () => {
  const system = useColorScheme() === 'light' ? DefaultTheme : DarkTheme;
  const { demo } = useGlobalSearchParams<{ demo?: string }>();

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
        <StatusBar />
        <CallProvider demo={demo === 'call'}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'hex' }} />
          </Stack>
        </CallProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
