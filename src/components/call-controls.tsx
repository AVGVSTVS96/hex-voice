import { GlassEffectContainer, HStack, Spacer, VStack } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import type { ModifierConfig } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { buttonsOf } from '@/call/call';
import type { Call, CallButton } from '@/call/call';
import { GlassButton } from '@/ui/glass-button';
import { Host } from '@/ui/host';
import { metrics } from '@/ui/tokens';
import type { ControlsSize } from '@/ui/tokens';

interface Props {
  call: Call;
  ready: boolean;
  axis: 'row' | 'column';
  mute?: boolean;
  size?: ControlsSize;
  onMute: () => void;
  onPrimary: () => void;
}

const PRIMARY: Record<
  CallButton,
  { icon: 'close' | 'waveform'; label: string; loading?: true; off?: true }
> = {
  start: { icon: 'waveform', label: 'Start conversation' },
  retry: { icon: 'waveform', label: 'Retry conversation' },
  cancel: { icon: 'close', label: 'Cancel connection', loading: true },
  end: { icon: 'close', label: 'End conversation' },
  ending: { icon: 'waveform', label: 'Ending conversation', loading: true, off: true },
};

// Mute and the call button, as SwiftUI: a row beside each other on the phone, a column in iPhone
// Duo's side column with mute above. A call held elsewhere, like a phone call, mutes there, not
// here. In the iPad inbox's rail, before any call, the call button waits alone.
export const CallButtons = ({
  call,
  ready,
  axis,
  mute = true,
  size = 'regular',
  modifiers,
  onMute,
  onPrimary,
}: Props & { modifiers?: ModifierConfig[] }) => {
  const sizes = metrics.controls[size];
  const buttons = buttonsOf(call);
  const primary = PRIMARY[buttons.call];
  const muteSide = metrics[sizes.mute];
  const Stack = axis === 'row' ? HStack : VStack;

  return (
    <GlassEffectContainer modifiers={modifiers}>
      <Stack spacing={sizes.gap}>
        {/* With no call there's nothing to mute, so an empty space holds mute's place and the
        call button beside it never moves. Not an invisible button: in a GlassEffectContainer,
        a glass button with opacity 0 still drew, glyph and all. */}
        {mute &&
          (buttons.mute ? (
            <GlassButton
              icon={buttons.mute.muted ? 'mic-off' : 'mic'}
              label={buttons.mute.muted ? 'Unmute microphone' : 'Mute microphone'}
              testID="session-mute-button"
              disabled={!buttons.mute.enabled}
              selected={buttons.mute.muted}
              size={sizes.mute}
              onPress={onMute}
            />
          ) : (
            <Spacer modifiers={[frame({ width: muteSide, height: muteSide })]} />
          ))}
        <GlassButton
          icon={primary.icon}
          label={primary.label}
          testID="session-primary-button"
          prominent
          size={sizes.call}
          loading={primary.loading}
          disabled={primary.off === true || !ready}
          onPress={onPrimary}
        />
      </Stack>
    </GlassEffectContainer>
  );
};

// CallButtons where React Native places them, in a Host of their own.
export const CallControls = ({ style, ...props }: Props & { style?: ViewStyle }) => {
  const { axis, mute = true, size = 'regular' } = props;
  const sizes = metrics.controls[size];
  const callSide = metrics[sizes.call];
  const along = (mute ? metrics[sizes.mute] + sizes.gap : 0) + callSide;

  return (
    <View
      pointerEvents="box-none"
      style={[styles[axis], axis === 'row' && { height: callSide }, style]}
    >
      <Host
        matchContents
        style={
          axis === 'row' ? { width: along, height: callSide } : { width: callSide, height: along }
        }
      >
        <CallButtons {...props} />
      </Host>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: metrics.call,
  },
  column: { alignItems: 'center', width: metrics.call },
});
