import { Stack } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Probe (not for main): where iOS puts each kind of bar item in each iPhone Duo pose, over an empty
// screen whose safe area is outlined.
function Dock() {
  return (
    <View style={{ alignItems: 'center', gap: 2, padding: 2 }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#7c5cff' }} />
      <Text style={{ color: 'white', fontSize: 11, fontVariant: ['tabular-nums'] }}>1:23</Text>
    </View>
  );
}

const button = (identifier: string, label: string, name: SFSymbol) =>
  ({
    type: 'button',
    identifier,
    label,
    icon: { type: 'sfSymbol', name },
    onPress: () => {},
  }) as const;

export default function Index() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          title: '',
          unstable_headerLeftItems: () => [
            button('back', 'Back', 'chevron.left'),
            button('calls', 'Calls', 'list.bullet'),
          ],
          unstable_headerRightItems: () => [
            { type: 'custom', element: <Dock />, hidesSharedBackground: true },
            button('tasks', 'Tasks', 'checklist'),
            button('settings', 'Settings', 'gearshape'),
          ],
        }}
      />
      <Stack.Toolbar>
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button icon="mic.fill" onPress={() => {}}>
          Mute
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button
          icon="phone.down.fill"
          variant="prominent"
          tintColor="red"
          onPress={() => {}}
        >
          End
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <View style={{ flex: 1, backgroundColor: '#202024' }}>
        <SafeAreaView style={{ flex: 1, borderWidth: 2, borderColor: '#3ddc84' }}>
          <View style={{ flex: 1 }} />
        </SafeAreaView>
      </View>
    </>
  );
}
