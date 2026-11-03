import { StyleSheet, View, type ViewStyle } from 'react-native';

import { VoiceControl } from '@/components/voice-control';
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
// where they share iPhone Duo's toolbar or a short column.
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
  return (
    <View
      pointerEvents="box-none"
      style={[styles[axis], { gap: sizes.gap }, axis === 'row' && { height: sizes.call }, style]}
    >
      {mute && (
        <VoiceControl
          icon={muted ? 'mic-off' : 'mic'}
          label={muted ? 'Unmute microphone' : 'Mute microphone'}
          testID="session-mute-button"
          disabled={!connected || !canMute}
          selected={muted}
          size={sizes.mute}
          onPress={onMute}
        />
      )}
      <VoiceControl
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
        disabled={disconnecting || !ready}
        onPress={onPrimary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: GAP,
    height: CONTROLS,
  },
  column: { alignItems: 'center', gap: GAP, width: CONTROLS },
});
