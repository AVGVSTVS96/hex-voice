import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'hex' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
