import { Column, Host, Icon, RNHostView, Row, Spacer, Text } from '@expo/ui';
import {
  BottomSheet,
  Button as NativeButton,
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
  controlSize,
  foregroundStyle,
  frame,
  labelsHidden,
  labelStyle,
  offset,
  padding,
  pickerStyle,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  presentationSizing,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Persona } from '@/components/persona';
import {
  PERSONA_VARIANTS,
  isPersonaVariant,
  opalPaletteInput,
  type PersonaVariant,
} from '@/components/persona/variants';
import { PersonaColors } from '@/components/persona-colors';
import { SelectionCarousel } from '@/components/selection-carousel';
import { Group, Separator, SettingRow, groupHeight } from '@/components/settings-list';
import { REACTIONS, type CallPreferences, type Reaction } from '@/hooks/use-call-preferences';
import { useVoicePreview } from '@/hooks/use-voice-preview';
import { VOICES, isLiveVoice, type LiveVoice } from '@/live/voices';
import { heard, motion } from '@/motion';
import { metrics, theme } from '@/theme';

// On the phone the sheet hangs from the bottom edge, full width. Where the width is regular it's a
// centered sheet, and beside the words (iPad landscape, iPhone Duo open) it lays the carousel
// beside the rows.
export type SettingsFit = 'phone' | 'centered' | 'beside';

type Props = {
  fit: SettingsFit;
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
// A short question as the microphone hears it, one step per syllable: how loud, how high and how
// bright, rising at the end. Each step is the call's own spring, so the orb moves as it does when
// you talk.
const PHRASE = [
  { level: 0.9, pitch: -0.2, tone: 0.2 },
  { level: 0.35, pitch: -0.35, tone: -0.1 },
  { level: 0.75, pitch: 0.1, tone: 0.3 },
  { level: 0.25, pitch: 0.35, tone: 0 },
  { level: 0.6, pitch: 0.9, tone: 0.5 },
  { level: 0, pitch: 0, tone: 0 },
];
const PREVIEW_ORB = 160;
const CENTERED = 560;
const BESIDE = { width: 760, height: 520, carousel: 300, preview: 260, orb: 180 };

const SHEET_TOP = 24;
const SHEET_BOTTOM = 26;
const PERSONA_PAGE = 138;
const ORB = 190;
const VOICE_CAROUSEL = 180;
const HEADER_TOP = 14;
const HEADER = 44;

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

export function VoiceSettings({
  fit,
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
  const window = useWindowDimensions();
  // Where the width is regular the system picks the sheet's width (a form sheet on iPad, an
  // edge-attached sheet on iPhone Duo's inner screen), so the pages fit the width it gives.
  const [given, setGiven] = useState<number>();
  const width =
    fit === 'phone' ? window.width : (given ?? (fit === 'centered' ? CENTERED : BESIDE.width));
  const contentWidth = Math.min(width - 2 * metrics.gutter, 480);
  const carouselWidth = Math.min(BESIDE.carousel, (width - 3 * metrics.gutter) * 0.45);
  const rowsWidth = fit === 'beside' ? width - carouselWidth - 3 * metrics.gutter : contentWidth;
  const appearanceHeight = fit === 'beside' ? BESIDE.height : APPEARANCE_HEIGHT;
  const detents = [{ height: appearanceHeight }, { height: VOICE_HEIGHT }];
  const orbSize = fit === 'beside' ? BESIDE.orb : PREVIEW_ORB;
  const [onVoicePage, setOnVoicePage] = useState(false);
  const [take, setTake] = useState(0);
  const selectedVoice = VOICES.find((option) => option.id === voice)!;
  const reducedMotion = useReducedMotion();
  const level = useSharedValue(0);
  const pitch = useSharedValue(0);
  const tone = useSharedValue(0);
  const reaction = REACTIONS.find(({ id }) => id === preferences.reaction)!.amount;
  const orbStyle = useAnimatedStyle(() => ({
    transform: heard(reaction, orbSize, level.get(), pitch.get(), tone.get()),
  }));
  const speak = () => {
    level.set(withSequence(...PHRASE.map((step) => withSpring(step.level, motion.reaction))));
    pitch.set(withSequence(...PHRASE.map((step) => withSpring(step.pitch, motion.tone))));
    tone.set(withSequence(...PHRASE.map((step) => withSpring(step.tone, motion.tone))));
  };
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
  // put while the sheet changes height, so nothing on them jumps as it resizes. Each page spans the
  // whole sheet so the one on top hides the other; that takes two frames, because Expo UI drops
  // maxWidth from a frame that also sets a height.
  const page = (shown: boolean, away: number, height: number) => [
    frame({ height, alignment: 'top' }),
    frame({ maxWidth: Infinity }),
    background(theme.sheet),
    offset({ x: shown ? 0 : away }),
    animation(motion.page, onVoicePage),
    accessibilityHidden(!shown),
  ];

  const carousel = (
    <SelectionCarousel
      options={PERSONA_VARIANTS}
      value={persona}
      width={fit === 'beside' ? carouselWidth : contentWidth}
      height={PERSONA_PAGE}
      preview={
        isPresented ? (
          <Animated.View style={orbStyle}>
            <Persona
              variant={persona}
              size={orbSize}
              state="idle"
              color={preferences.personaColor}
              palette={opalPaletteInput(preferences.opalPalette)}
            />
          </Animated.View>
        ) : undefined
      }
      previewHeight={fit === 'beside' ? BESIDE.preview : ORB}
      enabled={personaEnabled}
      label="Persona appearance"
      testID="persona-carousel"
      onChange={(next) => {
        if (!personaEnabled || !isPersonaVariant(next)) return;
        haptic();
        onPersonaChange(next);
      }}
    />
  );
  const rows = (
    <>
      <Group width={rowsWidth}>
        <PersonaColors
          persona={persona}
          preferences={preferences}
          width={rowsWidth}
          onSelect={() => haptic()}
        />
        <Separator />
        <SettingRow icon="mic" title="Reacts to you" width={rowsWidth}>
          <Picker
            selection={preferences.reaction}
            onSelectionChange={(next: Reaction) => {
              haptic();
              preferences.setReaction(next);
              if (!reducedMotion) speak();
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
      <Group width={rowsWidth}>
        <SettingRow
          icon="waveform"
          title="Voice"
          width={rowsWidth}
          label={`Voice, ${selectedVoice.label}. Hear and change voices`}
          onPress={() => showVoices(true)}
          testID="voice-row"
        >
          <Text
            textStyle={{ fontSize: metrics.body }}
            modifiers={[foregroundStyle(theme.secondary)]}
          >
            {selectedVoice.label}
          </Text>
          {ios && <Icon name="chevron.right" size={13} color={theme.secondary} />}
        </SettingRow>
        <Separator />
        <SettingRow icon="speaker.wave.2" title="Call sounds" width={rowsWidth}>
          <Toggle
            isOn={preferences.sounds}
            onIsOnChange={(on) => {
              haptic();
              preferences.setSounds(on);
            }}
            testID="sounds-toggle"
            modifiers={[labelsHidden(), tint(theme.switchOn), accessibilityLabel('Call sounds')]}
          />
        </SettingRow>
        <Separator />
        <SettingRow icon="iphone.radiowaves.left.and.right" title="Haptics" width={rowsWidth}>
          <Toggle
            isOn={preferences.haptics}
            onIsOnChange={(on) => {
              haptic(on);
              preferences.setHaptics(on);
            }}
            testID="haptics-toggle"
            modifiers={[labelsHidden(), tint(theme.switchOn), accessibilityLabel('Haptics')]}
          />
        </SettingRow>
      </Group>
    </>
  );

  return (
    <Host seedColor={theme.tint} style={{ position: 'absolute' }}>
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
            presentationDetents(detents, {
              selection: detents[onVoicePage ? 1 : 0],
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
            ...(fit === 'phone'
              ? []
              : [presentationSizing('fitted', { fitted: { horizontal: false, vertical: true } })]),
            presentationBackground(theme.sheet),
          ]}
        >
          <ZStack
            alignment="bottom"
            modifiers={
              fit === 'phone'
                ? [
                    frame({
                      maxWidth: Infinity,
                      minHeight: 0,
                      maxHeight: Infinity,
                      alignment: 'bottom',
                    }),
                  ]
                : [
                    frame({ height: onVoicePage ? VOICE_HEIGHT : appearanceHeight }),
                    frame({ maxWidth: Infinity }),
                    animation(motion.page, onVoicePage),
                  ]
            }
          >
            {fit !== 'phone' && (
              <RNHostView>
                <View
                  pointerEvents="none"
                  onLayout={({ nativeEvent }) => setGiven(nativeEvent.layout.width)}
                  style={StyleSheet.absoluteFill}
                />
              </RNHostView>
            )}
            {fit === 'beside' ? (
              <Row
                alignment="center"
                spacing={metrics.gutter}
                style={{ paddingHorizontal: metrics.gutter }}
                modifiers={page(!onVoicePage, -width / 3, appearanceHeight)}
              >
                {carousel}
                <Column spacing={metrics.groupSpacing}>{rows}</Column>
              </Row>
            ) : (
              <Column
                alignment="center"
                spacing={metrics.groupSpacing}
                style={{ paddingTop: SHEET_TOP }}
                modifiers={page(!onVoicePage, -width / 3, appearanceHeight)}
              >
                {carousel}
                {rows}
              </Column>
            )}
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
                <Text
                  textStyle={{ fontSize: metrics.body, fontWeight: '600' }}
                  modifiers={[foregroundStyle(theme.text)]}
                >
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
