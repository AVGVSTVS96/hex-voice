import { HStack, Overlay, VStack } from '@expo/ui/swift-ui';
import { StyleSheet, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { NeedsDot, TasksButton } from '@/components/tasks-button';
import { GlassButton, HostedGlassButton, glass } from '@/ui/glass-button';
import { Host } from '@/ui/host';
import { metrics, type ToolbarGaps } from '@/ui/tokens';

type Props = {
  axis: 'row' | 'column';
  onLayout?: ViewProps['onLayout'];
  gaps?: ToolbarGaps;
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  callsOpen: boolean;
  tasks: { needs: number; working: number; open: boolean };
  settingsOpen?: boolean;
  onCalls: () => void;
  onTasks: () => void;
  onSettings: () => void;
};

// Calls leads, Tasks and settings trail: across the top on the phone and iPad, down iPhone Duo's
// side column with the two set apart, closer where the column is short.
export function ScreenToolbar({
  axis,
  onLayout,
  gaps = 'regular',
  style,
  callsOpen,
  tasks,
  settingsOpen = false,
  onCalls,
  onTasks,
  onSettings,
}: Props) {
  const column = metrics.toolbar[gaps];
  const gap = axis === 'row' ? metrics.toolbar.row : column.group;
  const Group = axis === 'row' ? HStack : VStack;
  const long = 2 * metrics.tool + gap;
  return (
    <Animated.View
      pointerEvents="box-none"
      onLayout={onLayout}
      style={[styles[axis], axis === 'column' && { gap: column.tools }, style]}
    >
      <HostedGlassButton
        icon="calls"
        label="Calls"
        testID="calls-button"
        selected={callsOpen}
        onPress={onCalls}
      />
      <Host
        matchContents
        style={
          axis === 'row'
            ? { width: long, height: metrics.tool }
            : { width: metrics.tool, height: long }
        }
      >
        <Overlay alignment="topLeading">
          <Group spacing={gap} modifiers={[glass('capsule')]}>
            <TasksButton
              needs={tasks.needs}
              working={tasks.working}
              selected={tasks.open}
              onPress={onTasks}
            />
            <GlassButton
              bare
              icon="settings"
              label="Voice and appearance settings"
              testID="voice-settings-button"
              selected={settingsOpen}
              onPress={onSettings}
            />
          </Group>
          <Overlay.Content>
            <NeedsDot needs={tasks.needs} />
          </Overlay.Content>
        </Overlay>
      </Host>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  column: { position: 'absolute', alignItems: 'center' },
});
