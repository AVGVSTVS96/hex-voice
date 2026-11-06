import { GlassEffectContainer, HStack, Host, Spacer, VStack } from '@expo/ui/swift-ui';
import { frame } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { buttonsOf, type Call, type CallButton } from '@/call/call';
import { CallAdd } from '@/components/media/call-add';
import { GlassButton } from '@/ui/glass-button';
import { metrics, type ControlsSize } from '@/ui/tokens';

type Props = {
  call: Call;
  ready: boolean;
  axis: 'row' | 'column';
  mute?: boolean;
  // The +, which the call docked beside Tasks leaves out.
  add?: boolean;
  size?: ControlsSize;
  style?: ViewStyle;
  onMute: () => void;
  onPrimary: () => void;
};

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

// The + on a live call, mute and the call button: a row beside each other on the phone, a column
// in iPhone Duo's side column with the + above mute. A call held elsewhere, like a phone call, mutes there, not here. In the
// iPad inbox's rail, before any call, the call button waits alone.
export function CallControls({
  call,
  ready,
  axis,
  mute = true,
  add: adds = true,
  size = 'regular',
  style,
  onMute,
  onPrimary,
}: Props) {
  const sizes = metrics.controls[size];
  const buttons = buttonsOf(call);
  const primary = PRIMARY[buttons.call];
  const muteSide = metrics[sizes.mute];
  const callSide = metrics[sizes.call];
  const add = adds && mute && buttons.add;
  const along = (add ? muteSide + sizes.gap : 0) + (mute ? muteSide + sizes.gap : 0) + callSide;
  const Stack = axis === 'row' ? HStack : VStack;
  const primaryOff = primary.off || !ready;
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
            {add ? <CallAdd call={call} size={sizes.mute} /> : null}
            {/* With no call there's nothing to mute, so an empty space holds mute's place and the
            call button beside it never moves. Not an invisible button: in a GlassEffectContainer,
            a glass button with opacity 0 still drew, glyph and all. */}
            {mute && !buttons.mute ? (
              <Spacer modifiers={[frame({ width: muteSide, height: muteSide })]} />
            ) : mute && buttons.mute ? (
              <GlassButton
                icon={buttons.mute.muted ? 'mic-off' : 'mic'}
                label={buttons.mute.muted ? 'Unmute microphone' : 'Mute microphone'}
                testID="session-mute-button"
                disabled={!buttons.mute.enabled}
                selected={buttons.mute.muted}
                size={sizes.mute}
                onPress={onMute}
              />
            ) : null}
            <GlassButton
              icon={primary.icon}
              label={primary.label}
              testID="session-primary-button"
              prominent
              size={sizes.call}
              loading={primary.loading}
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
