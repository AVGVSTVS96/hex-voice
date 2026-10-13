import { Column, Host, Icon, RNHostView, Row, Spacer, Text } from '@expo/ui';
import {
  BottomSheet,
  Button as NativeButton,
  ColorPicker,
  Divider,
  Group as SheetContent,
  Picker,
  Text as NativeText,
  Toggle,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  accessibilityLabel,
  animation,
  background,
  buttonBorderShape,
  buttonStyle,
  contentShape,
  controlSize,
  frame,
  labelStyle,
  labelsHidden,
  offset,
  padding,
  pickerStyle,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  shapes,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Persona } from '@/components/persona';
import { PERSONA_MODELS } from '@/components/persona/animation';
import {
  OPAL_PALETTES,
  PERSONA_COLORS,
  PERSONA_VARIANTS,
  isPersonaVariant,
  opalPaletteInput,
  type PersonaVariant,
} from '@/components/persona/variants';
import { SelectionCarousel } from '@/components/selection-carousel';
import { REACTIONS, type CallPreferences, type Reaction } from '@/hooks/use-call-preferences';
import { useVoicePreview } from '@/hooks/use-voice-preview';
import { VOICES, isLiveVoice, type LiveVoice } from '@/live/voices';
import { motion } from '@/motion';
import { metrics, theme } from '@/theme';

type Props = {
  isPresented: boolean;
  onDismiss: () => void;
  voice: LiveVoice;
  onVoiceChange: (voice: LiveVoice) => void;
  voiceEnabled: boolean;
  voiceLocked: boolean;
  persona: PersonaVariant;
  onPersonaChange: (persona: PersonaVariant) => void;
  personaEnabled: boolean;
  preferences: CallPreferences;
};

const ios = process.env.EXPO_OS === 'ios';
const voiceOptions = VOICES.map((voice) => ({
  ...voice,
  description: 'accent' in voice ? voice.accent : 'Swipe to hear each voice',
}));
// A short phrase as the microphone hears it: one loudness peak per syllable. Each step is the
// call's own reaction spring, so the orb moves exactly as it does when you talk.
const PHRASE = [0.9, 0.35, 0.75, 0.25, 0.6, 0];
const ORIGINAL_OPAL = 'linear-gradient(135deg, #2FB5AD, #9B4DD6 50%, #F07B3F)';

const SHEET_TOP = 24;
const SHEET_BOTTOM = 26;
const PERSONA_PAGE = 138;
const ORB = 190;
const VOICE_CAROUSEL = 180;
const HEADER_TOP = 14;
const HEADER = 44;
const DIVIDER = 1 / 3;
const SWATCH_GAP = 4;
const SWATCH_SLOTS = Math.max(OPAL_PALETTES.length, PERSONA_COLORS.length + 1);

const groupHeight = (rows: number) => rows * metrics.row + (rows - 1) * DIVIDER;
const APPEARANCE_HEIGHT =
  SHEET_TOP +
  PERSONA_PAGE +
  ORB +
  metrics.groupSpacing +
  groupHeight(2) +
  metrics.groupSpacing +
  groupHeight(3) +
  SHEET_BOTTOM;
const VOICE_HEIGHT = HEADER_TOP + HEADER + VOICE_CAROUSEL + SHEET_BOTTOM;
const DETENTS = [{ height: APPEARANCE_HEIGHT }, { height: VOICE_HEIGHT }];

export function VoiceSettings({
  isPresented,
  onDismiss,
  voice,
  onVoiceChange,
  voiceEnabled,
  voiceLocked,
  persona,
  onPersonaChange,
  personaEnabled,
  preferences,
}: Props) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width - 2 * metrics.gutter, 480);
  const swatch = Math.min(
    36,
    Math.floor(
      (contentWidth - 2 * metrics.rowInset - SWATCH_GAP * (SWATCH_SLOTS - 1)) / SWATCH_SLOTS,
    ),
  );
  const [onVoicePage, setOnVoicePage] = useState(false);
  const [take, setTake] = useState(0);
  const selectedVoice = VOICES.find((option) => option.id === voice)!;
  const selectedPersona = PERSONA_VARIANTS.find((option) => option.id === persona)!;
  const reducedMotion = useReducedMotion();
  const level = useSharedValue(0);
  const reaction = REACTIONS.find(({ id }) => id === preferences.reaction)!.amount;
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + reaction * level.get() }],
  }));
  useVoicePreview(voice, isPresented && onVoicePage && voiceEnabled, take);

  const haptic = (enabled = preferences.haptics) => {
    if (ios && enabled) void Haptics.selectionAsync();
  };
  const showVoices = (show: boolean) => {
    haptic();
    setOnVoicePage(show);
  };
  // The voice page slides in from the right edge while the first page drifts a third of the way
  // left, like a navigation push. Pages hang from the sheet's bottom edge, the one edge that stays
  // put while the sheet changes height, so nothing on them jumps as it resizes.
  const page = (shown: boolean, away: number, height: number) => [
    frame({ maxWidth: Infinity, height, alignment: 'top' }),
    background(theme.sheet),
    offset({ x: shown ? 0 : away }),
    animation(motion.page, onVoicePage),
    accessibilityHidden(!shown),
  ];

  return (
    <Host colorScheme="dark" seedColor="#FFFFFF" style={{ position: 'absolute' }}>
      <BottomSheet
        isPresented={isPresented}
        onIsPresentedChange={(presented) => {
          if (!presented) onDismiss();
        }}
        onDismiss={() => setOnVoicePage(false)}
        testID="voice-settings-sheet"
      >
        <SheetContent
          modifiers={[
            presentationDragIndicator('visible'),
            presentationDetents(DETENTS, {
              selection: DETENTS[onVoicePage ? 1 : 0],
              // Dragging the sheet to the other height reads as leaving the page you're on: up from
              // the voices goes back to settings, down from settings closes the sheet.
              onSelectionChange: (detent) => {
                const voiceSized =
                  typeof detent === 'object' &&
                  'height' in detent &&
                  detent.height === VOICE_HEIGHT;
                if (voiceSized === onVoicePage) return;
                if (onVoicePage) showVoices(false);
                else onDismiss();
              },
            }),
            presentationBackground(theme.sheet),
          ]}
        >
          <ZStack
            alignment="bottom"
            modifiers={[
              frame({ maxWidth: Infinity, minHeight: 0, maxHeight: Infinity, alignment: 'bottom' }),
            ]}
          >
            <Column
              alignment="center"
              spacing={metrics.groupSpacing}
              style={{ paddingTop: SHEET_TOP }}
              modifiers={page(!onVoicePage, -width / 3, APPEARANCE_HEIGHT)}
            >
              <SelectionCarousel
                options={PERSONA_VARIANTS}
                value={persona}
                width={contentWidth}
                height={PERSONA_PAGE}
                preview={
                  isPresented ? (
                    <Animated.View style={orbStyle}>
                      <Persona
                        variant={persona}
                        size={160}
                        state="idle"
                        color={preferences.personaColor}
                        palette={opalPaletteInput(preferences.opalPalette)}
                      />
                    </Animated.View>
                  ) : undefined
                }
                previewHeight={ORB}
                enabled={personaEnabled}
                label="Persona appearance"
                testID="persona-carousel"
                onChange={(next) => {
                  if (!personaEnabled || !isPersonaVariant(next)) return;
                  haptic();
                  onPersonaChange(next);
                }}
              />
              <Group width={contentWidth}>
                {persona === 'opal' ? (
                  <SwatchRow width={contentWidth} label="Opal colors">
                    {OPAL_PALETTES.map((option) => (
                      <Swatch
                        key={option.id}
                        color={option.swatch ?? undefined}
                        label={option.label}
                        size={swatch}
                        selected={option.id === preferences.opalPalette}
                        onPress={() => {
                          haptic();
                          preferences.setOpalPalette(option.id);
                        }}
                      />
                    ))}
                  </SwatchRow>
                ) : PERSONA_MODELS[persona].dynamicColor ? (
                  <ColorRow
                    color={preferences.personaColor}
                    width={contentWidth}
                    size={swatch}
                    onChange={(next, fromPreset) => {
                      if (fromPreset) haptic();
                      preferences.setPersonaColor(next);
                    }}
                  />
                ) : (
                  <SwatchRow
                    width={contentWidth}
                    label={`${selectedPersona.label} keeps its own color`}
                    inert
                    trailing={
                      <RNHostView matchContents>
                        <SkeletonSwatch size={swatch} />
                      </RNHostView>
                    }
                  >
                    {PERSONA_COLORS.map((preset) => (
                      <SkeletonSwatch key={preset.id} size={swatch} />
                    ))}
                  </SwatchRow>
                )}
                <Separator />
                <SettingRow icon="mic" title="Reacts to you" width={contentWidth}>
                  <Picker
                    selection={preferences.reaction}
                    onSelectionChange={(next: Reaction) => {
                      haptic();
                      preferences.setReaction(next);
                      if (!reducedMotion)
                        level.set(
                          withSequence(...PHRASE.map((peak) => withSpring(peak, motion.reaction))),
                        );
                    }}
                    testID="reaction-picker"
                    modifiers={[
                      pickerStyle('menu'),
                      labelsHidden(),
                      tint(theme.secondary),
                      accessibilityLabel('How much the orb reacts to your voice'),
                    ]}
                  >
                    {REACTIONS.map((option) => (
                      <NativeText key={option.id} modifiers={[tag(option.id)]}>
                        {option.label}
                      </NativeText>
                    ))}
                  </Picker>
                </SettingRow>
              </Group>
              <Group width={contentWidth}>
                <SettingRow
                  icon="waveform"
                  title="Voice"
                  width={contentWidth}
                  label={`Voice, ${selectedVoice.label}. Hear and change voices`}
                  onPress={() => showVoices(true)}
                  testID="voice-row"
                >
                  <Text textStyle={{ color: theme.secondary, fontSize: metrics.body }}>
                    {selectedVoice.label}
                  </Text>
                  {ios && <Icon name="chevron.right" size={13} color={theme.secondary} />}
                </SettingRow>
                <Separator />
                <SettingRow icon="speaker.wave.2" title="Call sounds" width={contentWidth}>
                  <Toggle
                    isOn={preferences.sounds}
                    onIsOnChange={(on) => {
                      haptic();
                      preferences.setSounds(on);
                    }}
                    testID="sounds-toggle"
                    modifiers={[
                      labelsHidden(),
                      tint(theme.switchOn),
                      accessibilityLabel('Call sounds'),
                    ]}
                  />
                </SettingRow>
                <Separator />
                <SettingRow
                  icon="iphone.radiowaves.left.and.right"
                  title="Haptics"
                  width={contentWidth}
                >
                  <Toggle
                    isOn={preferences.haptics}
                    onIsOnChange={(on) => {
                      haptic(on);
                      preferences.setHaptics(on);
                    }}
                    testID="haptics-toggle"
                    modifiers={[
                      labelsHidden(),
                      tint(theme.switchOn),
                      accessibilityLabel('Haptics'),
                    ]}
                  />
                </SettingRow>
              </Group>
            </Column>
            <Column
              alignment="center"
              spacing={0}
              modifiers={page(onVoicePage, width, VOICE_HEIGHT)}
            >
              <Row
                alignment="center"
                spacing={0}
                style={{ width: contentWidth, height: HEADER }}
                modifiers={[padding({ top: HEADER_TOP })]}
              >
                <NativeButton
                  label="Back"
                  systemImage="chevron.left"
                  onPress={() => showVoices(false)}
                  testID="voice-back"
                  modifiers={[
                    labelStyle('iconOnly'),
                    buttonStyle('glass'),
                    buttonBorderShape('circle'),
                    controlSize('large'),
                  ]}
                />
                <Spacer flexible />
                <Text textStyle={{ color: theme.text, fontSize: metrics.body, fontWeight: '600' }}>
                  Voice
                </Text>
                <Spacer flexible />
                <Spacer style={{ width: HEADER }} />
              </Row>
              <SelectionCarousel
                options={voiceOptions}
                value={voice}
                width={contentWidth}
                height={VOICE_CAROUSEL}
                enabled={voiceEnabled}
                disabledHint={
                  voiceLocked ? 'End the conversation to change voices.' : 'Loading your voice…'
                }
                label="Voice"
                testID="voice-carousel"
                onPress={() => setTake((count) => count + 1)}
                onChange={(next) => {
                  if (!voiceEnabled || !isLiveVoice(next)) return;
                  haptic();
                  onVoiceChange(next);
                }}
              />
            </Column>
          </ZStack>
        </SheetContent>
      </BottomSheet>
    </Host>
  );
}

function Group({ width, children }: { width: number; children: ReactNode }) {
  return (
    <Column
      spacing={0}
      style={{ width, borderRadius: metrics.groupRadius, backgroundColor: theme.group }}
    >
      {children}
    </Column>
  );
}

function Separator() {
  return (
    <Divider
      modifiers={[padding({ leading: metrics.rowInset + metrics.rowIcon + metrics.rowSpacing })]}
    />
  );
}

function SettingRow({
  icon,
  title,
  width,
  label,
  onPress,
  testID,
  children,
}: {
  icon: SFSymbol;
  title: string;
  width: number;
  label?: string;
  onPress?: () => void;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <Row
      alignment="center"
      spacing={metrics.rowSpacing}
      style={{ width, height: metrics.row, paddingHorizontal: metrics.rowInset }}
      onPress={onPress}
      testID={testID}
      modifiers={[
        contentShape(shapes.rectangle()),
        ...(label && ios ? [accessibilityLabel(label)] : []),
      ]}
    >
      {ios ? (
        <Icon name={icon} size={20} color={theme.text} style={{ width: metrics.rowIcon }} />
      ) : (
        <Spacer style={{ width: metrics.rowIcon }} />
      )}
      <Text textStyle={{ color: theme.text, fontSize: metrics.body }}>{title}</Text>
      <Spacer flexible />
      {children}
    </Row>
  );
}

// Every persona's color row shares this footprint, so swiping between personas never moves the
// rows below it.
function SwatchRow({
  width,
  label,
  inert = false,
  trailing,
  children,
}: {
  width: number;
  label: string;
  inert?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Row
      alignment="center"
      spacing={0}
      style={{ width, height: metrics.row, paddingHorizontal: metrics.rowInset }}
    >
      <RNHostView matchContents>
        <View
          accessible={inert}
          accessibilityRole={inert ? undefined : 'radiogroup'}
          accessibilityLabel={label}
          style={{ flexDirection: 'row', gap: SWATCH_GAP }}
        >
          {children}
        </View>
      </RNHostView>
      <Spacer flexible />
      {trailing}
    </Row>
  );
}

function ColorRow({
  color,
  width,
  size,
  onChange,
}: {
  color: string;
  width: number;
  size: number;
  onChange: (color: string, fromPreset: boolean) => void;
}) {
  const custom = !PERSONA_COLORS.some((preset) => preset.id === color);
  return (
    <SwatchRow
      width={width}
      label="Persona color"
      trailing={
        ios && (
          <ColorPicker
            selection={color}
            supportsOpacity={false}
            onSelectionChange={(next) => onChange(next.slice(0, 7).toUpperCase(), false)}
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
          color={preset.id}
          label={preset.label}
          size={size}
          selected={preset.id === color}
          onPress={() => onChange(preset.id, true)}
        />
      ))}
    </SwatchRow>
  );
}

function Swatch({
  color,
  label,
  selected,
  onPress,
  size,
}: {
  color?: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  size: number;
}) {
  const inner = size - 10;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={SWATCH_GAP / 2}
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
