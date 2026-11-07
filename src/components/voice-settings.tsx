import { Column, Icon, RNHostView, Row, Spacer } from '@expo/ui';
import {
  ArrangementView,
  BottomSheet,
  Button as NativeButton,
  Group as SheetContent,
  Picker,
  Rectangle,
  Text as NativeText,
  Toggle,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  accessibilityElement,
  accessibilityHidden,
  accessibilityIdentifier,
  accessibilityLabel,
  animation,
  arrangementViewStyle,
  background,
  buttonBorderShape,
  buttonStyle,
  clipped,
  controlSize,
  foregroundStyle,
  frame,
  labelsHidden,
  labelStyle,
  offset,
  onGeometryChange,
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
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { Persona, preloadPersonas } from '@/components/persona';
import { PageBar } from '@/components/tasks/bar';
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
import { useViewport, type Size } from '@/hooks/use-viewport';
import { useVoicePreview } from '@/hooks/use-voice-preview';
import { VOICES, isLiveVoice, type LiveVoice } from '@/live/voices';
import { heard, motion } from '@/motion';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import type { Rect } from '@/screens/window';
import { Host } from '@/ui/host';
import { breakpoint, metrics, space } from '@/ui/tokens';

// On the phone (and iPhone Duo folded) the sheet hangs from the bottom edge at two heights. Where
// the width is regular it's a centered form sheet, and a page sheet where the call is split across
// the screen (iPad landscape, iPhone Duo open upright). Either way its content lays out to the width
// the sheet gets, the carousel beside the rows where that's wide enough.
export type SettingsSheet = 'phone' | 'form' | 'page';

// The open Duo's settings panes: the persona's beside the rows', or the persona's alone.
type Pane = 'persona' | 'rows' | 'alone';

type Props = {
  sheet: SettingsSheet;
  // On the open Duo, settings is a place of its own over the call instead of a sheet, since iOS
  // moves a sheet off an active fold. It's the place Tasks takes, covering what the toolbar leaves
  // (`area`), and shows as `pane` opens it while it's settings the place shows (`shown`).
  place?: { area: Rect; shown: boolean; pane: SharedValue<number> };
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
// Side by side from `breakpoint.beside` wide, or from `besideShort` wide where the page stacked
// can't fit the height.
const BESIDE = { height: 520, carousel: 300, preview: 260, orb: 180 };
// The persona's orb shrinks to this on a screen too short for the whole page, the Duo folded, and
// grows to `BESIDE.preview` where its own place has the room.
const SHORT_PREVIEW = 120;
const SHEET_GAP = 24;

const SHEET_TOP = space[6];
const SHEET_BOTTOM = 26;
const PERSONA_PAGE = 138;
const ORB = 190;
const VOICE_CAROUSEL = 180;
const HEADER_TOP = space[3.5];
const HEADER = 44;
// The bar over the persona's pane on the open Duo.
const BAR = 60;

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
  sheet,
  place,
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
  const screen = useViewport();
  const phone = sheet === 'phone';
  const insets = useSafeAreaInsets();
  // The system sizes the sheet, and its content lays out to the width the sheet gets. The width
  // flows one way, from the sheet to the content: a sheet fitted to its content's width chases its
  // own measurement, and one held to a width we pick gets capped by the system narrower than its
  // content, or the window's width runs under iPhone Duo's side column.
  const [given, setGiven] = useState<number>();
  // On the open Duo iOS gives the persona and the rows a pane each where the screen is wider than
  // tall, and the persona's pane alone otherwise, which then holds the persona in its top half and
  // the rows in its bottom half. Each lays out to the pane iOS reports, and until it does, to its
  // half or all of what the toolbar leaves.
  const area = place?.area;
  const two = !!area && screen.width > screen.height;
  const edges = area && {
    top: area.y,
    leading: area.x,
    trailing: screen.width - area.x - area.width,
    bottom: screen.height - area.y - area.height,
  };
  const [reported, setReported] = useState<Partial<Record<Pane, Size>>>({});
  const half = (taken: number) => ({ width: screen.width / 2 - taken, height: area?.height ?? 0 });
  const personaPane = two
    ? (reported.persona ?? half(edges?.leading ?? 0))
    : (reported.alone ?? { width: area?.width ?? 0, height: area?.height ?? 0 });
  const rowsPane = two ? (reported.rows ?? half(edges?.trailing ?? 0)) : personaPane;
  const personaHeight = two ? personaPane.height : screen.height / 2 - (edges?.top ?? 0);
  const width = place ? rowsPane.width : (given ?? 0);
  const room = screen.height - insets.top - SHEET_GAP;
  const beside =
    !place &&
    (width >= breakpoint.beside ||
      (width >= breakpoint.besideShort && room < APPEARANCE_HEIGHT - ORB + SHORT_PREVIEW));
  const contentWidth = Math.min(width - 2 * metrics.gutter, 480);
  const carouselWidth = place
    ? Math.min(personaPane.width - 2 * metrics.gutter, BESIDE.carousel + 80)
    : Math.min(BESIDE.carousel, (width - 3 * metrics.gutter) * 0.4);
  const rowsWidth = beside ? width - carouselWidth - 3 * metrics.gutter : contentWidth;
  const preview = place
    ? Math.max(
        SHORT_PREVIEW,
        Math.min(BESIDE.preview, personaHeight - PERSONA_PAGE - BAR - SHEET_TOP),
      )
    : beside
      ? Math.min(BESIDE.preview, room - PERSONA_PAGE - 2 * SHEET_TOP)
      : Math.max(SHORT_PREVIEW, Math.min(ORB, room - (APPEARANCE_HEIGHT - ORB)));
  const appearanceHeight = beside
    ? Math.min(BESIDE.height, room)
    : APPEARANCE_HEIGHT - ORB + preview;
  // The phone's sheet takes each page's height as a detent. A form or page sheet keeps one height,
  // so there the voice page fills the settings page's whole height and nothing of it shows: given
  // the voice page's detent too, the sheet shrinks to it under content still the settings' height.
  const detents = phone
    ? [{ height: appearanceHeight }, { height: VOICE_HEIGHT }]
    : [{ height: appearanceHeight }];
  const orbSize = Math.min(beside || place ? BESIDE.orb : PREVIEW_ORB, preview - 30);
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
    if (enabled) void Haptics.selectionAsync();
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

  // In the open Duo's place, the rows and the voices push over each other the same way, each as tall
  // as their room lets it be: midway down a pane of their own, or from the top of the persona's
  // pane's bottom half.
  const slide = (shown: boolean, away: number, alignment: 'top' | 'center') => [
    frame({ maxWidth: Infinity, maxHeight: Infinity, alignment }),
    background(theme.sheet),
    offset({ x: shown ? 0 : away }),
    animation(motion.page, onVoicePage),
    accessibilityHidden(!shown),
  ];
  useEffect(() => {
    if (isPresented) preloadPersonas(PERSONA_VARIANTS.map((option) => option.id));
  }, [isPresented]);
  // Leaving settings there leaves the voices too, as dismissing the sheet does.
  useEffect(() => {
    if (!isPresented) setOnVoicePage(false);
  }, [isPresented]);

  const carousel = (
    <SelectionCarousel
      options={PERSONA_VARIANTS}
      value={persona}
      width={beside || place ? carouselWidth : contentWidth}
      height={PERSONA_PAGE}
      // One persona for as long as settings lives, so opening settings never makes a new one.
      preview={
        <Animated.View style={orbStyle}>
          <Persona
            variant={persona}
            size={orbSize}
            state="idle"
            paused={!isPresented}
            drawn={!!place || isPresented}
            color={preferences.personaColor}
            palette={opalPaletteInput(preferences.opalPalette)}
          />
        </Animated.View>
      }
      previewHeight={preview}
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
          <Text tone="secondary">{selectedVoice.label}</Text>
          <Icon name="chevron.right" size={13} color={theme.secondary} />
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

  const voices = (
    <>
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
        <Text variant="headline">Voice</Text>
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
    </>
  );

  // The sheet stays mounted where settings has its place, closed, so a fold that moves settings
  // into its place takes the sheet down instead of leaving it up, unseen, over the screen.
  const align = two ? 'center' : 'top';
  const placed = place && edges && (
    <SettingsPlace
      shown={place.shown}
      open={isPresented}
      pane={place.pane}
      two={two}
      edges={edges}
      persona={personaHeight}
      onBack={onDismiss}
      onPane={(pane, size) =>
        setReported((now) =>
          now[pane]?.width === size.width && now[pane]?.height === size.height
            ? now
            : { ...now, [pane]: { width: size.width, height: size.height } },
        )
      }
    >
      {carousel}
      <ZStack
        alignment="center"
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity }), clipped()]}
      >
        <Column
          alignment="center"
          spacing={metrics.groupSpacing}
          modifiers={[
            ...(two ? [] : [padding({ top: SHEET_TOP })]),
            ...slide(!onVoicePage, -width / 3, align),
          ]}
        >
          {rows}
        </Column>
        <Column alignment="center" spacing={0} modifiers={slide(onVoicePage, width, align)}>
          {voices}
        </Column>
      </ZStack>
    </SettingsPlace>
  );

  return (
    <>
      {placed}
      <Host seedColor={theme.tint} avoids="system" style={{ position: 'absolute' }}>
        <BottomSheet
          keepMounted
          isPresented={!placed && isPresented}
          onIsPresentedChange={(presented) => {
            if (!presented && !placed) onDismiss();
          }}
          onDismiss={() => setOnVoicePage(false)}
        >
          <SheetContent
            modifiers={[
              presentationDragIndicator('visible'),
              presentationDetents(detents, {
                selection: detents[onVoicePage ? detents.length - 1 : 0],
                // Dragging the sheet to the other height reads as leaving the page you're on: up from
                // the voices goes back to settings, down from settings closes the sheet.
                onSelectionChange: (detent) => {
                  if (!phone) return;
                  const voiceSized =
                    typeof detent === 'object' &&
                    'height' in detent &&
                    detent.height === VOICE_HEIGHT;
                  if (voiceSized === onVoicePage) return;
                  if (onVoicePage) showVoices(false);
                  else onDismiss();
                },
              }),
              ...(phone
                ? []
                : [presentationSizing(sheet, { fitted: { horizontal: false, vertical: true } })]),
              presentationBackground(theme.sheet),
            ]}
          >
            <ZStack
              alignment="bottom"
              modifiers={[
                ...(phone
                  ? [
                      frame({
                        maxWidth: Infinity,
                        minHeight: 0,
                        maxHeight: Infinity,
                        alignment: 'bottom',
                      }),
                      clipped(),
                    ]
                  : [
                      frame({ height: appearanceHeight }),
                      frame({ maxWidth: Infinity }),
                      clipped(),
                      animation(motion.page, onVoicePage),
                    ]),
                // The sheet's own frame for checks: the BottomSheet's view is a zero-size anchor.
                accessibilityElement('contain'),
                accessibilityIdentifier('voice-settings-sheet'),
              ]}
            >
              <RNHostView>
                <View
                  pointerEvents="none"
                  onLayout={({ nativeEvent }) => {
                    // The sheet keeps its contents on the open Duo, laid out there at the window's
                    // width rather than a sheet's.
                    if (!place) setGiven(nativeEvent.layout.width);
                  }}
                  style={StyleSheet.absoluteFill}
                />
              </RNHostView>
              {placed ? null : width > 0 && beside ? (
                <Row
                  alignment="center"
                  spacing={metrics.gutter}
                  style={{ paddingHorizontal: metrics.gutter }}
                  modifiers={page(!onVoicePage, -width / 3, appearanceHeight)}
                >
                  {carousel}
                  <Column spacing={metrics.groupSpacing}>{rows}</Column>
                </Row>
              ) : width > 0 ? (
                <Column
                  alignment="center"
                  spacing={metrics.groupSpacing}
                  style={{ paddingTop: SHEET_TOP }}
                  modifiers={page(!onVoicePage, -width / 3, appearanceHeight)}
                >
                  {carousel}
                  {rows}
                </Column>
              ) : null}
              {!placed && width > 0 && (
                <Column
                  alignment="center"
                  spacing={0}
                  modifiers={page(onVoicePage, width, phone ? VOICE_HEIGHT : appearanceHeight)}
                >
                  {voices}
                </Column>
              )}
            </ZStack>
          </SheetContent>
        </BottomSheet>
      </Host>
    </>
  );
}

// Settings on the open Duo, over the call where Tasks would be. iOS arranges it: the persona's pane
// beside the rows' where the screen is wider than tall, meeting at the fold flat and parting around
// it partly open, and the persona's pane alone where it's taller than wide, with the persona in the
// top half of the screen and the rows below it. The arrangement fills the screen, so flat its panes
// meet on the crease; each pane and the sheet's color keep out of what the toolbar takes on the
// edges it touches (`edges`). It fades in where it sits as Tasks does, never moved by a transform
// (its Host would keep telling accessibility where it started).
function SettingsPlace({
  shown,
  open,
  pane: opened,
  two,
  edges: { top, leading, trailing, bottom },
  persona: personaHeight,
  onBack,
  onPane,
  children: [persona, rows],
}: {
  shown: boolean;
  open: boolean;
  pane: SharedValue<number>;
  two: boolean;
  edges: { top: number; leading: number; trailing: number; bottom: number };
  persona: number;
  onBack: () => void;
  onPane: (pane: Pane, size: Size) => void;
  children: [ReactNode, ReactNode];
}) {
  const fade = useAnimatedStyle(() => ({
    opacity: shown ? interpolate(opened.get(), [0.25, 1], [0, 1], Extrapolation.CLAMP) : 0,
  }));
  const pane = (name: Pane, sides: { leading: number; trailing: number }) => [
    frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
    onGeometryChange((size) => onPane(name, size)),
    padding({ top, bottom, ...sides }),
  ];
  return (
    <Animated.View
      testID="settings-place"
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      style={[StyleSheet.absoluteFill, fade]}
    >
      <Host seedColor={theme.tint} style={{ flex: 1 }}>
        <ZStack
          modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
            accessibilityElement('contain'),
            accessibilityIdentifier('voice-settings-sheet'),
          ]}
        >
          <Rectangle
            modifiers={[foregroundStyle(theme.sheet), padding({ top, leading, trailing, bottom })]}
          />
          <ArrangementView
            modifiers={[
              arrangementViewStyle('split', { axes: 'horizontal' }),
              frame({ maxWidth: Infinity, maxHeight: Infinity }),
            ]}
          >
            <ArrangementView.Primary>
              <Column
                alignment="center"
                spacing={0}
                modifiers={pane(two ? 'persona' : 'alone', {
                  leading,
                  trailing: two ? 0 : trailing,
                })}
              >
                <Column
                  alignment="center"
                  spacing={0}
                  modifiers={[
                    two ? frame({ maxHeight: Infinity }) : frame({ height: personaHeight }),
                    frame({ maxWidth: Infinity }),
                  ]}
                >
                  <PageBar title="Settings" back={{ to: 'Call', short: false, onPress: onBack }} />
                  <Spacer flexible />
                  {persona}
                  <Spacer flexible />
                </Column>
                {two ? null : rows}
              </Column>
            </ArrangementView.Primary>
            <ArrangementView.Secondary>
              {two ? (
                <Column
                  alignment="center"
                  spacing={0}
                  modifiers={pane('rows', { leading: 0, trailing })}
                >
                  {rows}
                </Column>
              ) : (
                // Left empty, iOS draws a bar along the bottom of the lone pane, like the home
                // indicator.
                <Spacer flexible />
              )}
            </ArrangementView.Secondary>
          </ArrangementView>
        </ZStack>
      </Host>
    </Animated.View>
  );
}
