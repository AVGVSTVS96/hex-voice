import { RNHostView, Row } from '@expo/ui';
import { ColorPicker } from '@expo/ui/swift-ui';
import { accessibilityLabel, frame, labelsHidden } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { Pressable, View, useColorScheme } from 'react-native';

import { PERSONA_MODELS } from '@/components/persona/animation';
import {
  OPAL_PALETTES,
  PERSONA_COLORS,
  PERSONA_VARIANTS,
  type PersonaVariant,
} from '@/components/persona/variants';
import type { CallPreferences } from '@/hooks/use-call-preferences';
import { metrics, theme } from '@/theme';

const ios = process.env.EXPO_OS === 'ios';
const SLOTS = OPAL_PALETTES.length;
const MIN_GAP = 4;
const MAX_SWATCH = 36;
const ORIGINAL_OPAL = 'linear-gradient(135deg, #2FB5AD, #9B4DD6 50%, #F07B3F)';

type Layout = { width: number; size: number; gap: number };

// Every persona's colors fill the same slots across the row, so swiping between personas keeps
// each swatch, and the rows below, exactly where they were.
export function PersonaColors({
  persona,
  preferences,
  width,
  onSelect,
}: {
  persona: PersonaVariant;
  preferences: CallPreferences;
  width: number;
  onSelect: () => void;
}) {
  const light = useColorScheme() === 'light';
  const inner = width - 2 * metrics.rowInset;
  const size = Math.min(MAX_SWATCH, Math.floor((inner - MIN_GAP * (SLOTS - 1)) / SLOTS));
  const layout = { width, size, gap: (inner - SLOTS * size) / (SLOTS - 1) };

  if (persona === 'opal')
    return (
      <SwatchRow layout={layout} label="Opal colors">
        {OPAL_PALETTES.map((option) => (
          <Swatch
            key={option.id}
            color={option.swatch ?? undefined}
            label={option.label}
            layout={layout}
            selected={option.id === preferences.opalPalette}
            onPress={() => {
              onSelect();
              preferences.setOpalPalette(option.id);
            }}
          />
        ))}
      </SwatchRow>
    );

  if (!PERSONA_MODELS[persona].dynamicColor) {
    const { label } = PERSONA_VARIANTS.find(({ id }) => id === persona)!;
    return (
      <SwatchRow
        layout={layout}
        label={`${label} keeps its own color`}
        inert
        trailing={
          <RNHostView matchContents>
            <SkeletonSwatch size={size} />
          </RNHostView>
        }
      >
        {PERSONA_COLORS.map((preset) => (
          <SkeletonSwatch key={preset.id} size={size} />
        ))}
      </SwatchRow>
    );
  }

  const color = preferences.personaColor;
  const custom = !PERSONA_COLORS.some((preset) => preset.id === color);
  return (
    <SwatchRow
      layout={layout}
      label="Persona color"
      trailing={
        ios && (
          <ColorPicker
            selection={color}
            supportsOpacity={false}
            onSelectionChange={(next) =>
              preferences.setPersonaColor(next.slice(0, 7).toUpperCase())
            }
            modifiers={[
              labelsHidden(),
              frame({ width: size, height: size }),
              accessibilityLabel(custom ? 'Custom color, selected' : 'Custom color'),
            ]}
          />
        )
      }
    >
      {PERSONA_COLORS.map((preset) => (
        <Swatch
          key={preset.id}
          color={light ? preset.light : preset.id}
          label={light && 'lightLabel' in preset ? preset.lightLabel : preset.label}
          layout={layout}
          selected={preset.id === color}
          onPress={() => {
            onSelect();
            preferences.setPersonaColor(preset.id);
          }}
        />
      ))}
    </SwatchRow>
  );
}

function SwatchRow({
  layout: { width, gap },
  label,
  inert = false,
  trailing,
  children,
}: {
  layout: Layout;
  label: string;
  inert?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Row
      alignment="center"
      spacing={gap}
      style={{ width, height: metrics.row, paddingHorizontal: metrics.rowInset }}
    >
      <RNHostView matchContents>
        <View
          accessible={inert}
          accessibilityRole={inert ? undefined : 'radiogroup'}
          accessibilityLabel={label}
          style={{ flexDirection: 'row', gap }}
        >
          {children}
        </View>
      </RNHostView>
      {trailing}
    </Row>
  );
}

function Swatch({
  color,
  label,
  selected,
  onPress,
  layout: { size, gap },
}: {
  color?: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  layout: Layout;
}) {
  const inner = size - 10;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={gap / 2}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: selected ? theme.text : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: color,
          experimental_backgroundImage: color ? undefined : ORIGINAL_OPAL,
        }}
      />
    </Pressable>
  );
}

function SkeletonSwatch({ size }: { size: number }) {
  const inner = size - 10;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: theme.skeleton,
        }}
      />
    </View>
  );
}
