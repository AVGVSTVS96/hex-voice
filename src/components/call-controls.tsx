import { GlassEffectContainer, HStack, Host, Spacer, VStack } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import type { LiveStatus } from '@/live/types';
import { GlassButton } from '@/ui/glass-button';
import { metrics, type ControlsSize } from '@/ui/tokens';

type Props = {
  status: LiveStatus;
  canMute: boolean;
  muted: boolean;
  failed: boolean;
  ready: boolean;
  axis: 'row' | 'column';
  mute?: boolean;
  size?: ControlsSize;
  style?: ViewStyle;
  onMute: () => void;
  onPrimary: () => void;
};

// Mute and the call button: a row beside each other on the phone, a column in iPhone Duo's side
// column with mute above. A call held elsewhere, like a phone call, mutes there, not here. In the
// iPad inbox's rail, before any call, the call button waits alone.
export function CallControls({
  status,
  canMute,
  muted,
  failed,
  ready,
  axis,
  mute = true,
  size = 'regular',
  style,
  onMute,
  onPrimary,
}: Props) {
  const sizes = metrics.controls[size];
  const connected = status === 'connected';
  const connecting = status === 'connecting';
  const disconnecting = status === 'disconnecting';
  const muteSide = metrics[sizes.mute];
  const callSide = metrics[sizes.call];
  const along = (mute ? muteSide + sizes.gap : 0) + callSide;
  const Stack = axis === 'row' ? HStack : VStack;
  const muteOff = !connected || !canMute;
  // With no call there's nothing to mute, so an empty space holds mute's place and the call button
  // beside it never moves. Not an invisible button: in a GlassEffectContainer, a glass button with
  // opacity 0 still drew, glyph and all.
  const idle = !connected && !connecting && !disconnecting;
  const primaryOff = disconnecting || !ready;
  return (
    <View
      pointerEvents="box-none"
      style={[styles[axis], axis === 'row' && { height: callSide }, style]}
    >
      <Host
        matchContents
        ignoreSafeArea="all"
        style={
          axis === 'row' ? { width: along, height: callSide } : { width: callSide, height: along }
        }
      >
        <GlassEffectContainer>
          <Stack spacing={sizes.gap}>
            {mute && idle ? (
              <Spacer modifiers={[frame({ width: muteSide, height: muteSide })]} />
            ) : mute ? (
              <GlassButton
                icon={muted ? 'mic-off' : 'mic'}
                label={muted ? 'Unmute microphone' : 'Mute microphone'}
                testID="session-mute-button"
                disabled={muteOff}
                selected={muted}
                size={sizes.mute}
                onPress={onMute}
              />
            ) : null}
            <GlassButton
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
            />
          </Stack>
        </GlassEffectContainer>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: metrics.call,
  },
  column: { alignItems: 'center', width: metrics.call },
});
