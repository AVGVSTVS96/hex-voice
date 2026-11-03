import { Button, Host, Image, ProgressView } from '@expo/ui/swift-ui';
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
  type ModifierConfig,
} from '@expo/ui/swift-ui/modifiers';

import { theme } from '@/theme';

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
  size?: number;
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

export function Control({
  icon,
  label,
  onPress,
  testID,
  size = 48,
  disabled = false,
  selected = false,
  prominent = false,
  loading = false,
  modifiers = [],
}: Props & { modifiers?: ModifierConfig[] }) {
  const color = prominent
    ? theme.onProminent
    : disabled
      ? theme.tertiary
      : selected
        ? theme.accent
        : theme.text;
  const face = [
    frame({ width: size, height: size }),
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
        ...modifiers,
      ]}
    >
      {loading ? (
        <ProgressView modifiers={[tint(color), ...face]} />
      ) : (
        <Image
          systemName={symbols[icon]}
          size={prominent ? 27 : 24}
          color={color}
          modifiers={face}
        />
      )}
    </Button>
  );
}

export function VoiceControl(props: Props) {
  const size = props.size ?? 48;
  return (
    <Host matchContents ignoreSafeArea="all" style={{ width: size, height: size }}>
      <Control
        {...props}
        modifiers={[glass('circle', { prominent: props.prominent, disabled: props.disabled })]}
      />
    </Host>
  );
}
