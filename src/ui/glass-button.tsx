import { Button, Image, ProgressView } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  background,
  buttonStyle,
  contentShape,
  disabled as disable,
  frame,
  glassEffect,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { theme } from '@/theme';
import { Host } from '@/ui/host';
import { metrics, type GlassSize } from '@/ui/tokens';

const symbols = {
  settings: 'slider.horizontal.3',
  transcript: 'text.bubble',
  'beside-row': 'rectangle.split.2x1',
  'beside-column': 'rectangle.split.1x2',
  calls: 'clock.arrow.circlepath',
  tasks: 'list.bullet',
  mic: 'mic',
  'mic-off': 'mic.slash',
  close: 'xmark',
  waveform: 'waveform',
} as const;

type Props = {
  icon: keyof typeof symbols;
  label: string;
  onPress: () => void;
  testID: string;
  size?: GlassSize;
  disabled?: boolean;
  selected?: boolean;
  prominent?: boolean;
  loading?: boolean;
};

// Not buttonStyle('glass'): SwiftUI pads its label past the frame sizes the layout counts on.
export function glass(
  shape: 'circle' | 'capsule',
  { prominent = false, disabled = false }: { prominent?: boolean; disabled?: boolean } = {},
) {
  return glassEffect({
    glass: {
      variant: 'regular',
      interactive: !disabled,
      tint: prominent ? theme.prominent : undefined,
    },
    shape,
  });
}

// A round button on glass. A `bare` one leaves the glass to the group it sits in.
export function GlassButton({
  icon,
  label,
  onPress,
  testID,
  size = 'tool',
  disabled = false,
  selected = false,
  prominent = false,
  loading = false,
  bare = false,
}: Props & { bare?: boolean }) {
  const color = prominent
    ? theme.onProminent
    : disabled
      ? theme.tertiary
      : selected
        ? theme.accent
        : theme.text;
  const diameter = metrics[size];
  const face = [
    frame({ width: diameter, height: diameter }),
    ...(selected
      ? [background({ type: 'hierarchical', style: 'quaternary' }, shapes.circle())]
      : []),
    contentShape(shapes.circle()),
  ];
  return (
    <Button
      onPress={onPress}
      testID={testID}
      modifiers={[
        buttonStyle('plain'),
        disable(disabled),
        accessibilityLabel(label),
        accessibilityAddTraits(selected ? ['isSelected'] : []),
        ...(bare ? [] : [glass('circle', { prominent, disabled })]),
      ]}
    >
      {loading ? (
        <ProgressView modifiers={[tint(color), ...face]} />
      ) : (
        <Image
          systemName={symbols[icon]}
          size={metrics.symbol[prominent ? 'prominent' : 'regular']}
          color={color}
          modifiers={face}
        />
      )}
    </Button>
  );
}

// A GlassButton that React Native lays out, in a Host of its own.
export function HostedGlassButton(props: Props) {
  const diameter = metrics[props.size ?? 'tool'];
  return (
    <Host matchContents style={{ width: diameter, height: diameter }}>
      <GlassButton {...props} />
    </Host>
  );
}
