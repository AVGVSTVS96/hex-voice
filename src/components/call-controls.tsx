import { GlassEffectContainer, HStack, Host, VStack } from '@expo/ui/swift-ui';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Control, glass } from '@/components/voice-control';
import type { LiveStatus } from '@/live/types';
import { CONTROLS, GAP, MUTE } from '@/screens/layout';

type Props = {
  status: LiveStatus;
  canMute: boolean;
  muted: boolean;
  failed: boolean;
  ready: boolean;
  axis: 'row' | 'column';
  mute?: boolean;
  sizes?: { mute: number; call: number; gap: number };
  style?: ViewStyle;
  onMute: () => void;
  onPrimary: () => void;
};

// Mute and the call button: a row beside each other on the phone, a column in iPhone Duo's side
// column with mute above. A call held elsewhere, like a phone call, mutes there, not here. In the
// iPad inbox's rail, before any call, the call button waits alone. `sizes` draws them smaller,
// where they share iPhone Duo's toolbar or a short column. The two share one glass
// container, so their glass samples and morphs together like the system's.
export function CallControls({
  status,
  canMute,
  muted,
  failed,
  ready,
  axis,
  mute = true,
  sizes = { mute: MUTE, call: CONTROLS, gap: GAP },
  style,
  onMute,
  onPrimary,
}: Props) {
  const connected = status === 'connected';
  const connecting = status === 'connecting';
  const disconnecting = status === 'disconnecting';
  const gap = sizes.gap;
  const along = (mute ? sizes.mute + gap : 0) + sizes.call;
  const Stack = axis === 'row' ? HStack : VStack;
  const muteOff = !connected || !canMute;
  const primaryOff = disconnecting || !ready;
  return (
    <View
      pointerEvents="box-none"
      style={[styles[axis], axis === 'row' && { height: sizes.call }, style]}
    >
      <Host
        matchContents
        ignoreSafeArea="all"
        style={
          axis === 'row'
            ? { width: along, height: sizes.call }
            : { width: sizes.call, height: along }
        }
      >
        <GlassEffectContainer>
          <Stack spacing={gap}>
            {mute && (
              <Control
                icon={muted ? 'mic-off' : 'mic'}
                label={muted ? 'Unmute microphone' : 'Mute microphone'}
                testID="session-mute-button"
                disabled={muteOff}
                selected={muted}
                size={sizes.mute}
                onPress={onMute}
                modifiers={[glass('circle', { disabled: muteOff })]}
              />
            )}
            <Control
              icon={connected || connecting ? 'close' : 'waveform'}
              label={
                disconnecting
                  ? 'Ending conversation'
                  : connecting
                    ? 'Cancel connection'
                    : connected
                      ? 'End conversation'
                      : failed
                        ? 'Retry conversation'
                        : 'Start conversation'
              }
              testID="session-primary-button"
              prominent
              size={sizes.call}
              loading={connecting || disconnecting}
              disabled={primaryOff}
              onPress={onPrimary}
              modifiers={[glass('circle', { prominent: true, disabled: primaryOff })]}
            />
          </Stack>
        </GlassEffectContainer>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', height: CONTROLS },
  column: { alignItems: 'center', width: CONTROLS },
});
