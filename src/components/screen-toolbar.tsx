import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { TasksButton } from '@/components/tasks-button';
import { VoiceControl } from '@/components/voice-control';

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

// Calls leads, Tasks and settings trail: across the top on the phone and iPad, down iPhone Duo's
// side column with the two set apart (`gaps` apart, where the column is short). `gathered`, the
// three sit together at the leading end, leaving the trailing end to the call buttons.
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
      <View style={[styles[`${axis}Group`], gaps && { gap: gaps.group }]}>
        <TasksButton
          needs={tasks.needs}
          working={tasks.working}
          selected={tasks.open}
          onPress={onTasks}
        />
        <VoiceControl
          icon="settings"
          label="Voice and appearance settings"
          testID="voice-settings-button"
          onPress={onSettings}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  rowGroup: { flexDirection: 'row', gap: 12 },
  gathered: { justifyContent: 'flex-start', gap: 12 },
  column: { position: 'absolute', alignItems: 'center', gap: 32 },
  columnGroup: { alignItems: 'center', gap: 16 },
});
