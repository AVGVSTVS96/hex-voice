import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  background,
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  multilineTextAlignment,
  padding,
  resizable,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';
import type { ColorValue } from 'react-native';

export type CallActivityProps = {
  orb: string;
  state: 'connecting' | 'live' | 'muted' | 'ended';
  since: number;
  outcome?: string;
  bad?: boolean;
};

const CallActivity = (props: CallActivityProps) => {
  'widget';
  // This layout runs as a string in the widget extension, where neither the theme nor
  // DynamicColorIOS exist, so each color is the object DynamicColorIOS would make. The Lock Screen
  // follows the system; the island is always dark.
  const color = (dark: string, light: string) =>
    ({ dynamic: { dark, light } }) as unknown as ColorValue;
  const text = color('#F5F5F5', '#0A0A0A');
  const secondary = color('#A1A1A6', '#6E6E73');
  const muted = props.state === 'muted';
  const orb = (size: number) => (
    <Image assetName={props.orb} modifiers={[resizable(), frame({ width: size, height: size })]} />
  );
  const timer = (size: number, width: number, alignment: 'leading' | 'trailing') => (
    <Text
      timerInterval={{ lower: new Date(props.since), upper: new Date(props.since + 86400000) }}
      countsDown={false}
      modifiers={[
        font({ size }),
        monospacedDigit(),
        multilineTextAlignment(alignment),
        foregroundStyle(alignment === 'trailing' ? text : secondary),
        frame({ width, alignment }),
      ]}
    />
  );
  const subtitle = props.outcome ? (
    <Text
      modifiers={[
        font({ size: 15 }),
        foregroundStyle(props.bad ? color('#F0A5A8', '#D93A42') : secondary),
      ]}
    >
      {props.outcome}
    </Text>
  ) : props.since ? (
    timer(15, 64, 'leading')
  ) : (
    <Text modifiers={[font({ size: 15 }), foregroundStyle(secondary)]}>Connecting</Text>
  );
  const title = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle(text)]}>hex</Text>
      {subtitle}
    </VStack>
  );
  const control = (target: 'mute' | 'end', size: number) => {
    const end = target === 'end';
    return (
      <Button target={target} modifiers={[buttonStyle('plain')]}>
        <Image
          systemName={end ? 'xmark' : muted ? 'mic.slash.fill' : 'mic.fill'}
          size={size * 0.38}
          color={end ? color('#080808', '#FAFAFA') : text}
          modifiers={[
            frame({ width: size, height: size }),
            background(
              end
                ? color('#F9F9F9', '#0A0A0A')
                : muted
                  ? color('#363636', '#D9D9DE')
                  : color('#202020', '#EEEEF0'),
              shapes.circle(),
            ),
          ]}
        />
      </Button>
    );
  };
  const controls = (size: number) => (
    <HStack spacing={10}>
      {props.state === 'connecting' || props.state === 'ended' ? null : control('mute', size)}
      {props.state === 'ended' ? null : control('end', size)}
    </HStack>
  );

  return {
    banner: (
      <HStack
        spacing={14}
        modifiers={[padding({ all: 16 }), activityBackgroundTint(color('#000000', '#FFFFFF'))]}
      >
        {orb(48)}
        {title}
        <Spacer />
        {controls(44)}
      </HStack>
    ),
    compactLeading: orb(24),
    compactTrailing: props.outcome ? null : muted ? (
      <Image systemName="mic.slash.fill" color={text} size={14} />
    ) : props.since ? (
      timer(15, 44, 'trailing')
    ) : null,
    minimal: orb(24),
    expandedLeading: (
      <HStack spacing={12} modifiers={[padding({ leading: 6, top: 6 })]}>
        {orb(44)}
        {title}
      </HStack>
    ),
    expandedTrailing: (
      <HStack modifiers={[padding({ trailing: 6, top: 6 })]}>{controls(44)}</HStack>
    ),
  };
};

export default createLiveActivity('CallActivity', CallActivity);
