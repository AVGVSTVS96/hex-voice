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
import { metrics } from '@/ui/tokens';
import type { GlassSize } from '@/ui/tokens';

const symbols = {
  back: 'chevron.left',
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
  add: 'plus',
} as const;

interface Props {
  icon: keyof typeof symbols;
  label: string;
  onPress: () => void;
  testID: string;
  size?: GlassSize;
  disabled?: boolean;
  selected?: boolean;
  prominent?: boolean;
  loading?: boolean;
}

export const glass = (
  shape: 'circle' | 'capsule',
  { prominent = false, disabled = false }: { prominent?: boolean; disabled?: boolean } = {},
) =>
  glassEffect({
    glass: {
      variant: 'regular',
      interactive: !disabled,
      tint: prominent ? theme.prominent : undefined,
    },
    shape,
  });

const stroke = (size: number) => font({ size, weight: metrics.stroke });

export const GlassButton = ({
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
}: Props & { bare?: boolean }) => {
  const color = symbolColor(prominent, disabled);
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
};

export const GlassMenu = ({
  icon,
  label,
  children,
}: Pick<Props, 'icon' | 'label'> & { children: ReactNode }) => (
  <Menu label={<GlassFace icon={icon} />} modifiers={[accessibilityLabel(label), glass('circle')]}>
    {children}
  </Menu>
);

export const GlassFace = ({ icon, size = 'tool' }: { icon: Props['icon']; size?: GlassSize }) => (
  <Image
    systemName={symbols[icon]}
    size={metrics.symbol.regular}
    color={theme.text}
    modifiers={[stroke(metrics.symbol.regular), ...face(size, false)]}
  />
);

const symbolColor = (prominent: boolean, disabled: boolean) => {
  if (prominent) {
    return theme.onProminent;
  }

  return disabled ? theme.tertiary : theme.text;
};

const face = (size: GlassSize, selected: boolean) => {
  const diameter = metrics[size];

  return [
    frame({ width: diameter, height: diameter }),
    ...(selected
      ? [background({ type: 'hierarchical', style: 'quaternary' }, shapes.circle())]
      : []),
    contentShape(shapes.circle()),
  ];
};

export const HostedGlassButton = (props: Props) => {
  const diameter = metrics[props.size ?? 'tool'];

  return (
    <Host matchContents style={{ width: diameter, height: diameter }}>
      <GlassButton {...props} />
    </Host>
  );
};
