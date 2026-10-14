import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { TasksButton } from '@/components/tasks-button';
import { VoiceControl } from '@/components/voice-control';

type Props = {
  axis: 'row' | 'column';
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  reading: boolean;
  callsOpen: boolean;
  tasks: { needs: number; working: number; open: boolean };
  onReading: () => void;
  onCalls: () => void;
  onTasks: () => void;
  onSettings: () => void;
};

// The words and Calls lead, Tasks and settings trail: across the top on the phone and iPad, down
// iPhone Duo's side column with the two groups set apart.
export function ScreenToolbar({
  axis,
  style,
  reading,
  callsOpen,
  tasks,
  onReading,
  onCalls,
  onTasks,
  onSettings,
}: Props) {
  return (
    <Animated.View pointerEvents="box-none" style={[styles[axis], style]}>
      <View style={styles[`${axis}Group`]}>
        <VoiceControl
          icon="captions"
          label={reading ? 'Show orb' : 'Show transcript'}
          testID="transcript-button"
          selected={reading}
          onPress={onReading}
        />
        <VoiceControl
          icon="calls"
          label="Calls"
          testID="calls-button"
          selected={callsOpen}
          onPress={onCalls}
        />
      </View>
      <View style={styles[`${axis}Group`]}>
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
  column: { position: 'absolute', alignItems: 'center', gap: 32 },
  columnGroup: { alignItems: 'center', gap: 16 },
});
