import { Column, Host, Icon, Row, Spacer, Text } from '@expo/ui';
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
  frame,
  labelStyle,
  labelsHidden,
  offset,
  padding,
  pickerStyle,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
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
  const [onVoicePage, setOnVoicePage] = useState(false);
  const [take, setTake] = useState(0);
  const selectedVoice = VOICES.find((option) => option.id === voice)!;
  const reducedMotion = useReducedMotion();
  const level = useSharedValue(0);
  const pitch = useSharedValue(0);
  const tone = useSharedValue(0);
  const reaction = REACTIONS.find(({ id }) => id === preferences.reaction)!.amount;
  const orbStyle = useAnimatedStyle(() => ({
    transform: heard(reaction, PREVIEW_ORB, level.get(), pitch.get(), tone.get()),
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
                        size={PREVIEW_ORB}
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
                <PersonaColors
                  persona={persona}
                  preferences={preferences}
                  width={contentWidth}
                  onSelect={() => haptic()}
                />
                <Separator />
                <SettingRow icon="mic" title="Reacts to you" width={contentWidth}>
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
