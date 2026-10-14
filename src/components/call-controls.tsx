import { StyleSheet, View, type ViewStyle } from 'react-native';

import { VoiceControl } from '@/components/voice-control';
import type { LiveStatus } from '@/live/types';

type Props = {
  status: LiveStatus;
  muted: boolean;
  failed: boolean;
  ready: boolean;
  axis: 'row' | 'column';
  style?: ViewStyle;
  onMute: () => void;
  onPrimary: () => void;
};

// Mute and the call button: a row beside each other on the phone, a column in iPhone Duo's side
// column with mute above.
export function CallControls({
  status,
  muted,
  failed,
  ready,
  axis,
  style,
  onMute,
  onPrimary,
}: Props) {
  const connected = status === 'connected';
  const connecting = status === 'connecting';
  const disconnecting = status === 'disconnecting';
  return (
    <View pointerEvents="box-none" style={[styles[axis], style]}>
      <VoiceControl
        icon={muted ? 'mic-off' : 'mic'}
        label={muted ? 'Unmute microphone' : 'Mute microphone'}
        testID="session-mute-button"
        disabled={!connected}
        selected={muted}
        size={60}
        onPress={onMute}
      />
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
        size={64}
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
    gap: 12,
    height: 64,
  },
  column: { alignItems: 'center', gap: 12, width: 64 },
});
