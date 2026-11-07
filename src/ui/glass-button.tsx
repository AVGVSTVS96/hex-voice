import { Button, Image, Menu, ProgressView } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  background,
  buttonStyle,
  contentShape,
  disabled as disable,
  font,
  frame,
  glassEffect,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';

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
  more: 'ellipsis',
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

// A button's symbol in Muse's thin line, the same weight on every button.
const stroke = (size: number) => font({ size, weight: metrics.stroke });

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
  // Chosen, the glass fills a little, as Muse marks the tab you're on; mint stays for what needs you.
  const color = prominent ? theme.onProminent : disabled ? theme.tertiary : theme.text;
  const look = face(size, selected);
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
        <ProgressView modifiers={[tint(color), ...look]} />
      ) : (
        <Image
          systemName={symbols[icon]}
          size={metrics.symbol[prominent ? 'prominent' : 'regular']}
          color={color}
          modifiers={[stroke(metrics.symbol[prominent ? 'prominent' : 'regular']), ...look]}
        />
      )}
    </Button>
  );
}

// A GlassButton that opens a menu of `children`.
export function GlassMenu({
  icon,
  label,
  children,
}: Pick<Props, 'icon' | 'label'> & { children: ReactNode }) {
  return (
    <Menu
      label={
        <Image
          systemName={symbols[icon]}
          size={metrics.symbol.regular}
          color={theme.text}
          modifiers={[stroke(metrics.symbol.regular), ...face('tool', false)]}
        />
      }
      modifiers={[accessibilityLabel(label), glass('circle')]}
    >
      {children}
    </Menu>
  );
}

function face(size: GlassSize, selected: boolean) {
  const diameter = metrics[size];
  return [
    frame({ width: diameter, height: diameter }),
    ...(selected
      ? [background({ type: 'hierarchical', style: 'quaternary' }, shapes.circle())]
      : []),
    contentShape(shapes.circle()),
  ];
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
