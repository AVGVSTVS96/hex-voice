import { HStack, Host, VStack } from '@expo/ui/swift-ui';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { TasksButton } from '@/components/tasks-button';
import { Control, glass, VoiceControl } from '@/components/voice-control';
import { TOOL } from '@/screens/layout';

type Props = {
  axis: 'row' | 'column';
  gaps?: { tools: number; group: number };
  gathered?: boolean;
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  callsOpen: boolean;
  tasks: { needs: number; working: number; open: boolean };
  onCalls: () => void;
  onTasks: () => void;
  onSettings: () => void;
};

const GROUP_GAP = { row: 12, column: 16 } as const;

// Calls leads, Tasks and settings trail: across the top on the phone and iPad, down iPhone Duo's
// side column with the two set apart (`gaps` apart, where the column is short). `gathered`, the
// three sit together at the leading end, leaving the trailing end to the call buttons. Calls is a
// glass circle of its own; Tasks and settings share one glass capsule, like a bar's item group.
export function ScreenToolbar({
  axis,
  gaps,
  gathered = false,
  style,
  callsOpen,
  tasks,
  onCalls,
  onTasks,
  onSettings,
}: Props) {
  const gap = gaps?.group ?? GROUP_GAP[axis];
  const Group = axis === 'row' ? HStack : VStack;
  const long = 2 * TOOL + gap;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles[axis], gaps && { gap: gaps.tools }, gathered && styles.gathered, style]}
    >
      <VoiceControl
        icon="calls"
        label="Calls"
        testID="calls-button"
        selected={callsOpen}
        onPress={onCalls}
      />
      <Host
        matchContents
        ignoreSafeArea="all"
        style={axis === 'row' ? { width: long, height: TOOL } : { width: TOOL, height: long }}
      >
        <Group spacing={gap} modifiers={[glass('capsule')]}>
          <TasksButton
            needs={tasks.needs}
            working={tasks.working}
            selected={tasks.open}
            onPress={onTasks}
          />
          <Control
            icon="settings"
            label="Voice and appearance settings"
            testID="voice-settings-button"
            onPress={onSettings}
          />
        </Group>
      </Host>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  gathered: { justifyContent: 'flex-start', gap: 12 },
  column: { position: 'absolute', alignItems: 'center', gap: 32 },
});
