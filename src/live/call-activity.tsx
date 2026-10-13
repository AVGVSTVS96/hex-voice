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

export type CallActivityProps = {
  orb: string;
  state: 'connecting' | 'live' | 'muted';
  since: number;
};

const CallActivity = (props: CallActivityProps) => {
  'widget';
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
        foregroundStyle(alignment === 'trailing' ? '#F5F5F5' : '#A1A1A6'),
        frame({ width, alignment }),
      ]}
    />
  );
  const subtitle = props.since ? (
    timer(15, 64, 'leading')
  ) : (
    <Text modifiers={[font({ size: 15 }), foregroundStyle('#A1A1A6')]}>Connecting</Text>
  );
  const title = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 17, weight: 'semibold' }), foregroundStyle('#F5F5F5')]}>
        hex
      </Text>
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
          color={end ? '#080808' : '#F5F5F5'}
          modifiers={[
            frame({ width: size, height: size }),
            background(end ? '#F9F9F9' : muted ? '#363636' : '#202020', shapes.circle()),
          ]}
        />
      </Button>
    );
  };
  const controls = (size: number) => (
    <HStack spacing={10}>
      {props.state === 'connecting' ? null : control('mute', size)}
      {control('end', size)}
    </HStack>
  );

  return {
    banner: (
      <HStack spacing={14} modifiers={[padding({ all: 16 }), activityBackgroundTint('#000000')]}>
        {orb(48)}
        {title}
        <Spacer />
        {controls(44)}
      </HStack>
    ),
    compactLeading: orb(24),
    compactTrailing: muted ? (
      <Image systemName="mic.slash.fill" color="#F5F5F5" size={14} />
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
