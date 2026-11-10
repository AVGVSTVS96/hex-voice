import { Column, Icon, RNHostView, Row, Spacer } from "@expo/ui";
import {
  ArrangementView,
  BottomSheet,
  Button as NativeButton,
  Group as SheetContent,
  Rectangle,
  ScrollView,
  TextField,
  Toggle,
  ZStack,
} from "@expo/ui/swift-ui";
import type { TextFieldRef } from "@expo/ui/swift-ui";
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
  disabled,
  foregroundStyle,
  frame,
  labelsHidden,
  labelStyle,
  lineLimit,
  offset,
  onGeometryChange,
  padding,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  presentationSizing,
  scrollDismissesKeyboard,
  submitLabel,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as z from "zod/mini";

import { Persona, preloadPersonas } from "@/components/persona";
import { PersonaColors } from "@/components/persona-colors";
import {
  PERSONA_VARIANTS,
  isPersonaVariant,
  opalPaletteInput,
} from "@/components/persona/variants";
import type { PersonaVariant } from "@/components/persona/variants";
import { SelectionCarousel } from "@/components/selection-carousel";
import { Group, PickerRow, Separator, SettingRow, groupHeight } from "@/components/settings-list";
import { PageBar } from "@/components/tasks/bar";
import { useToolbarBack } from "@/components/toolbar-back";
import { REACTIONS } from "@/hooks/use-call-preferences";
import type { CallPreferences, Reaction } from "@/hooks/use-call-preferences";
import type { TalkSettings } from "@/hooks/use-talk";
import { useViewport } from "@/hooks/use-viewport";
import type { Size } from "@/hooks/use-viewport";
import { useVoicePreview } from "@/hooks/use-voice-preview";
import { UNSET, WORDS_LIMIT } from "@/live/talk";
import type { Talk } from "@/live/talk";
import { VOICES, isLiveVoice } from "@/live/voices";
import type { LiveVoice } from "@/live/voices";
import { heard, motion } from "@/motion";
import type { Rect } from "@/screens/window";
import { theme } from "@/theme";
import { Host } from "@/ui/host";
import { Text } from "@/ui/text";
import { breakpoint, metrics, radius, space } from "@/ui/tokens";

export type SettingsSheet = "phone" | "form" | "page";

type Pane = "persona" | "rows" | "alone";

interface Props {
  sheet: SettingsSheet;
  place?: { area: Rect; shown: boolean; pane: SharedValue<number> } | undefined;
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
  talk: TalkSettings;
}

const voiceOptions = VOICES.map((voice) => ({
  ...voice,
  description: "accent" in voice ? voice.accent : "Swipe to hear each voice",
}));

const PHRASE = [
  { level: 0.9, pitch: -0.2, tone: 0.2 },
  { level: 0.35, pitch: -0.35, tone: -0.1 },
  { level: 0.75, pitch: 0.1, tone: 0.3 },
  { level: 0.25, pitch: 0.35, tone: 0 },
  { level: 0.6, pitch: 0.9, tone: 0.5 },
  { level: 0, pitch: 0, tone: 0 },
];

const PREVIEW_ORB = 160;

const BESIDE = { height: 520, carousel: 300, preview: 260, orb: 180 };

const SHORT_PREVIEW = 120;
const SHEET_GAP = 24;

const SHEET_TOP = space[6];
const SHEET_BOTTOM = 26;
const PERSONA_PAGE = 138;

const FOLDED_PERSONA_SHARE = 0.4;
const ORB = 190;
const VOICE_CAROUSEL = 180;
const HEADER_TOP = space[4];
const HEADER = 44;

const PERSONA_PANE_BAR = 60;

const APPEARANCE_HEIGHT =
  SHEET_TOP +
  PERSONA_PAGE +
  ORB +
  metrics.groupSpacing +
  groupHeight(2) +
  metrics.groupSpacing +
  groupHeight(3) +
  SHEET_BOTTOM;

const WORDS = 3 * 22 + 2 * space[3];
const NOTE = 18;

const VOICE_HEIGHT =
  HEADER_TOP +
  HEADER +
  VOICE_CAROUSEL +
  metrics.groupSpacing +
  groupHeight(2) +
  metrics.groupSpacing +
  WORDS +
  space[2] +
  NOTE +
  SHEET_BOTTOM;

const VoiceDetent = z.object({ height: z.literal(VOICE_HEIGHT) });

interface Edges {
  top: number;
  leading: number;
  trailing: number;
  bottom: number;
}

interface Panes {
  two: boolean;
  edges: Edges;
  personaPane: Size;
  rowsPane: Size;
  personaHeight: number;
}

const voiceSummary = (voice: string, talk: Talk | undefined) => {
  const personality = talk?.personalities.find(
    ({ id }) => id === (talk.settings.personality ?? UNSET.personality),
  );

  return personality && personality.id !== UNSET.personality
    ? `${voice} · ${personality.label}`
    : voice;
};

const placePanes = (screen: Size, area: Rect, reported: Partial<Record<Pane, Size>>): Panes => {
  const two = screen.width > screen.height;

  const edges = {
    top: area.y,
    leading: area.x,
    trailing: screen.width - area.x - area.width,
    bottom: screen.height - area.y - area.height,
  };

  const half = (taken: number) => ({ width: screen.width / 2 - taken, height: area.height });

  const personaPane = two
    ? (reported.persona ?? half(edges.leading))
    : (reported.alone ?? { width: area.width, height: area.height });

  const rowsPane = two ? (reported.rows ?? half(edges.trailing)) : personaPane;
  const personaHeight = two ? personaPane.height : screen.height / 2 - edges.top;

  return { two, edges, personaPane, rowsPane, personaHeight };
};

const sheetPreview = (beside: boolean, room: number) =>
  beside
    ? Math.min(BESIDE.preview, room - PERSONA_PAGE - 2 * SHEET_TOP)
    : Math.max(SHORT_PREVIEW, Math.min(ORB, room - (APPEARANCE_HEIGHT - ORB)));

const sizesOf = (width: number, room: number, panes: Panes | undefined) => {
  const beside =
    !panes &&
    (width >= breakpoint.beside ||
      (width >= breakpoint.besideShort && room < APPEARANCE_HEIGHT - ORB + SHORT_PREVIEW));

  const contentWidth = Math.min(width - 2 * metrics.gutter, 480);

  const carouselWidth = panes
    ? Math.min(panes.personaPane.width - 2 * metrics.gutter, BESIDE.carousel + 80)
    : Math.min(BESIDE.carousel, (width - 3 * metrics.gutter) * 0.4);

  const rowsWidth = beside ? width - carouselWidth - 3 * metrics.gutter : contentWidth;

  const preview = panes
    ? Math.max(
        SHORT_PREVIEW,
        Math.min(BESIDE.preview, panes.personaHeight - PERSONA_PAGE - PERSONA_PANE_BAR - SHEET_TOP),
      )
    : sheetPreview(beside, room);

  const appearanceHeight = beside
    ? Math.min(Math.max(BESIDE.height, VOICE_HEIGHT), room)
    : APPEARANCE_HEIGHT - ORB + preview;

  const orbSize = Math.min(beside || panes ? BESIDE.orb : PREVIEW_ORB, preview - 30);

  return { beside, contentWidth, carouselWidth, rowsWidth, preview, appearanceHeight, orbSize };
};

export const VoiceSettings = ({
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
  talk,
}: Props) => {
  const screen = useViewport();
  const phone = sheet === "phone";
  const insets = useSafeAreaInsets();
  const [given, setGiven] = useState<number>();
  const [reported, setReported] = useState<Partial<Record<Pane, Size>>>({});
  const panes = place && placePanes(screen, place.area, reported);
  const two = panes?.two === true;
  const width = panes ? panes.rowsPane.width : (given ?? 0);

  const { beside, contentWidth, carouselWidth, rowsWidth, preview, appearanceHeight, orbSize } =
    sizesOf(width, screen.height - insets.top - SHEET_GAP, panes);

  const [onVoicePage, setOnVoicePage] = useState(false);
  const [take, setTake] = useState(0);
  const selectedVoice = VOICES.find((option) => option.id === voice) ?? VOICES[0];
  const reducedMotion = useReducedMotion();
  const level = useSharedValue(0);
  const pitch = useSharedValue(0);
  const tone = useSharedValue(0);
  const reaction = REACTIONS.find(({ id }) => id === preferences.reaction) ?? REACTIONS[0];

  const voiceLine = voiceSummary(selectedVoice.label, talk.talk);

  const orbStyle = useAnimatedStyle(() => ({
    transform: heard(reaction.amount, orbSize, level.get(), pitch.get(), tone.get()),
  }));

  const speak = () => {
    level.set(withSequence(...PHRASE.map((step) => withSpring(step.level, motion.reaction))));
    pitch.set(withSequence(...PHRASE.map((step) => withSpring(step.pitch, motion.tone))));
    tone.set(withSequence(...PHRASE.map((step) => withSpring(step.tone, motion.tone))));
  };

  useVoicePreview(voice, isPresented && onVoicePage && voiceEnabled, take);

  const haptic = (enabled?: boolean) => {
    if (enabled ?? preferences.haptics) {
      void Haptics.selectionAsync();
    }
  };

  const showVoices = (show: boolean) => {
    haptic();
    setOnVoicePage(show);
  };

  const back = onVoicePage
    ? {
        to: "Settings",
        onPress: () => {
          showVoices(false);
        },
      }
    : { to: "Call", onPress: onDismiss };

  const backInToolbar = useToolbarBack("settings", isPresented ? back : undefined, !!place);

  const slide = (shown: boolean, away: number, alignment: "top" | "center") => [
    frame({ maxWidth: Infinity, maxHeight: Infinity, alignment }),
    background(theme.sheet),
    offset({ x: shown ? 0 : away }),
    animation(motion.page, onVoicePage),
    accessibilityHidden(!shown),
  ];

  useEffect(() => {
    if (isPresented) {
      preloadPersonas(PERSONA_VARIANTS.map((option) => option.id));
    }
  }, [isPresented]);
  useEffect(() => {
    if (!isPresented) {
      setOnVoicePage(false);
    }
  }, [isPresented]);

  const carousel = (
    <SelectionCarousel
      options={PERSONA_VARIANTS}
      value={persona}
      width={beside || place ? carouselWidth : contentWidth}
      height={PERSONA_PAGE}
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
        if (!personaEnabled || !isPersonaVariant(next)) {
          return;
        }

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
          onSelect={() => {
            haptic();
          }}
        />
        <Separator />
        <PickerRow
          icon="mic"
          title="Reacts to you"
          width={rowsWidth}
          choices={REACTIONS}
          selection={preferences.reaction}
          onChange={(next: Reaction) => {
            haptic();
            preferences.setReaction(next);

            if (!reducedMotion) {
              speak();
            }
          }}
          label="How much the orb reacts to your voice"
          testID="reaction-picker"
        />
      </Group>
      <Group width={rowsWidth}>
        <SettingRow
          icon="waveform"
          title="Voice"
          width={rowsWidth}
          label={`Voice, ${voiceLine}. Hear and change the voice and how it talks`}
          onPress={() => {
            showVoices(true);
          }}
          testID="voice-row"
        >
          <Text tone="secondary" modifiers={[lineLimit(1)]}>
            {voiceLine}
          </Text>
          <Icon name="chevron.right" size={metrics.symbol.small} color={theme.tertiary} />
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
            modifiers={[labelsHidden(), tint(theme.switchOn), accessibilityLabel("Call sounds")]}
          />
        </SettingRow>
        <Separator />
        <SettingRow icon="hand.tap" title="Haptics" width={rowsWidth}>
          <Toggle
            isOn={preferences.haptics}
            onIsOnChange={(on) => {
              haptic(on);
              preferences.setHaptics(on);
            }}
            testID="haptics-toggle"
            modifiers={[labelsHidden(), tint(theme.switchOn), accessibilityLabel("Haptics")]}
          />
        </SettingRow>
      </Group>
    </>
  );

  const voices = (
    <VoicePage
      width={contentWidth}
      backInToolbar={backInToolbar}
      voice={voice}
      enabled={voiceEnabled}
      locked={voiceLocked}
      talk={talk}
      onTalk={haptic}
      onBack={() => {
        showVoices(false);
      }}
      onPress={() => {
        setTake((count) => count + 1);
      }}
      onChange={(next) => {
        if (!voiceEnabled || !isLiveVoice(next)) {
          return;
        }

        haptic();
        onVoiceChange(next);
      }}
    />
  );

  const align = two ? "center" : "top";

  const placed = place && panes && (
    <SettingsPlace
      shown={place.shown}
      open={isPresented}
      pane={place.pane}
      two={two}
      row={two && phone ? panes.edges.leading + place.area.width * FOLDED_PERSONA_SHARE : undefined}
      edges={panes.edges}
      persona={panes.personaHeight}
      onPane={(pane, size) => {
        setReported((now) =>
          now[pane]?.width === size.width && now[pane]?.height === size.height
            ? now
            : { ...now, [pane]: { width: size.width, height: size.height } },
        );
      }}
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
      <Sheet
        sheet={sheet}
        placed={!!placed}
        open={isPresented}
        onVoicePage={onVoicePage}
        width={width}
        beside={beside}
        appearanceHeight={appearanceHeight}
        carousel={carousel}
        rows={rows}
        voices={voices}
        onDismiss={onDismiss}
        onLeaveVoices={() => {
          showVoices(false);
        }}
        onClosed={() => {
          setOnVoicePage(false);
        }}
        onWidth={setGiven}
      />
    </>
  );
};

const VoicePage = ({
  width,
  backInToolbar,
  voice,
  enabled,
  locked,
  talk: { talk, failure, change },
  onTalk,
  onBack,
  onPress,
  onChange,
}: {
  width: number;
  backInToolbar: boolean;
  voice: LiveVoice;
  enabled: boolean;
  locked: boolean;
  talk: TalkSettings;
  onTalk: () => void;
  onBack: () => void;
  onPress: () => void;
  onChange: (next: string) => void;
}) => (
  <>
    <Row
      alignment="center"
      spacing={0}
      style={{ width, height: HEADER }}
      modifiers={[padding({ top: HEADER_TOP })]}
    >
      {backInToolbar ? (
        <Spacer style={{ width: HEADER }} />
      ) : (
        <NativeButton
          label="Back"
          systemImage="chevron.left"
          onPress={onBack}
          testID="voice-back"
          modifiers={[
            labelStyle("iconOnly"),
            buttonStyle("glass"),
            buttonBorderShape("circle"),
            controlSize("large"),
          ]}
        />
      )}
      <Spacer flexible />
      <Text variant="headline">Voice</Text>
      <Spacer flexible />
      <Spacer style={{ width: HEADER }} />
    </Row>
    <ScrollView
      showsIndicators={false}
      modifiers={[
        scrollDismissesKeyboard("interactively"),
        frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" }),
      ]}
    >
      <Column alignment="center" spacing={0} modifiers={[padding({ bottom: space[6] })]}>
        <SelectionCarousel
          options={voiceOptions}
          value={voice}
          width={width}
          height={VOICE_CAROUSEL}
          enabled={enabled}
          disabledHint={locked ? "End the conversation to change voices." : "Loading your voice…"}
          label="Voice"
          testID="voice-carousel"
          onPress={onPress}
          onChange={onChange}
        />
        <Column
          alignment="start"
          spacing={metrics.groupSpacing}
          modifiers={[padding({ top: metrics.groupSpacing })]}
        >
          <Group width={width}>
            <PickerRow
              icon="theatermasks"
              title="Personality"
              width={width}
              choices={talk?.personalities ?? []}
              selection={talk?.settings.personality ?? UNSET.personality}
              onChange={(next: string) => {
                onTalk();
                change({ personality: next });
              }}
              enabled={!!talk}
              label="How hex comes across on calls"
              testID="personality-picker"
            />
            <Separator />
            <PickerRow
              icon="speedometer"
              title="Pace"
              width={width}
              choices={talk?.paces ?? []}
              selection={talk?.settings.pace ?? UNSET.pace}
              onChange={(next: string) => {
                onTalk();
                change({ pace: next });
              }}
              enabled={!!talk}
              label="How fast hex talks on calls"
              testID="pace-picker"
            />
          </Group>
          <Column alignment="start" spacing={space[2]}>
            <Words
              width={width}
              words={talk?.settings.words}
              enabled={!!talk}
              onSave={(words) => {
                change({ words });
              }}
            />
            <Text
              variant="caption"
              tone="secondary"
              modifiers={[lineLimit(1), padding({ leading: metrics.rowInset })]}
            >
              {failure ?? "Every call talks this way, phone calls too."}
            </Text>
          </Column>
        </Column>
      </Column>
    </ScrollView>
  </>
);

const Words = ({
  width,
  words,
  enabled,
  onSave,
}: {
  width: number;
  words: string | undefined;
  enabled: boolean;
  onSave: (words: string) => void;
}) => {
  const field = useRef<TextFieldRef>(null);
  const draft = useRef(words ?? "");
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      draft.current = words ?? "";
      void field.current?.setText(draft.current);
    }
  }, [words]);

  const save = () => {
    if (draft.current.trim() !== (words ?? "")) {
      onSave(draft.current.trim());
    }
  };

  return (
    <Row
      alignment="start"
      spacing={metrics.rowSpacing}
      style={{
        width,
        borderRadius: radius.group,
        backgroundColor: theme.card,
        paddingHorizontal: metrics.rowInset,
        paddingVertical: space[3],
      }}
    >
      <Icon
        name="text.quote"
        size={metrics.symbol.row}
        color={theme.text}
        style={{ width: metrics.rowIcon }}
      />
      <TextField
        ref={field}
        placeholder="Tell hex how to talk, in your words"
        axis="vertical"
        maxLength={WORDS_LIMIT}
        testID="talk-words"
        onTextChange={(text) => {
          if (text.includes("\n")) {
            draft.current = text.replaceAll("\n", " ");
            void field.current?.setText(draft.current);
            void field.current?.blur();

            return;
          }

          draft.current = text;
        }}
        onFocusChange={(now) => {
          focused.current = now;

          if (!now) {
            save();
          }
        }}
        modifiers={[
          lineLimit(3, { reservesSpace: true }),
          submitLabel("done"),
          frame({ maxWidth: Infinity, maxHeight: WORDS }),
          disabled(!enabled),
          accessibilityLabel("How hex should talk, in your words"),
        ]}
      />
    </Row>
  );
};

const Sheet = ({
  sheet,
  placed,
  open,
  onVoicePage,
  width,
  beside,
  appearanceHeight,
  carousel,
  rows,
  voices,
  onDismiss,
  onLeaveVoices,
  onClosed,
  onWidth,
}: {
  sheet: SettingsSheet;
  placed: boolean;
  open: boolean;
  onVoicePage: boolean;
  width: number;
  beside: boolean;
  appearanceHeight: number;
  carousel: ReactNode;
  rows: ReactNode;
  voices: ReactNode;
  onDismiss: () => void;
  onLeaveVoices: () => void;
  onClosed: () => void;
  onWidth: (width: number) => void;
}) => {
  const phone = sheet === "phone";

  const appearance = { height: appearanceHeight };
  const voice = { height: VOICE_HEIGHT };
  const detents = phone ? [appearance, voice] : [appearance];

  const page = (shown: boolean, away: number, height: number) => [
    frame({ height, alignment: "top" }),
    frame({ maxWidth: Infinity }),
    background(theme.sheet),
    offset({ x: shown ? 0 : away }),
    animation(motion.page, onVoicePage),
    accessibilityHidden(!shown),
  ];

  return (
    <Host seedColor={theme.tint} avoids="system" style={{ position: "absolute" }}>
      <BottomSheet
        keepMounted
        isPresented={!placed && open}
        onIsPresentedChange={(presented) => {
          if (!presented && !placed) {
            onDismiss();
          }
        }}
        onDismiss={onClosed}
      >
        <SheetContent
          modifiers={[
            presentationDragIndicator("visible"),
            presentationDetents(detents, {
              selection: phone && onVoicePage ? voice : appearance,
              onSelectionChange: (detent) => {
                if (!phone) {
                  return;
                }

                const voiceSized = VoiceDetent.safeParse(detent).success;

                if (voiceSized === onVoicePage) {
                  return;
                }

                if (onVoicePage) {
                  onLeaveVoices();
                } else {
                  onDismiss();
                }
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
                      alignment: "bottom",
                    }),
                    clipped(),
                  ]
                : [
                    frame({ height: appearanceHeight }),
                    frame({ maxWidth: Infinity }),
                    clipped(),
                    animation(motion.page, onVoicePage),
                  ]),
              accessibilityElement("contain"),
              accessibilityIdentifier("voice-settings-sheet"),
            ]}
          >
            <RNHostView>
              <View
                pointerEvents="none"
                onLayout={({ nativeEvent }) => {
                  if (!placed) {
                    onWidth(nativeEvent.layout.width);
                  }
                }}
                style={StyleSheet.absoluteFill}
              />
            </RNHostView>
            {!placed &&
              width > 0 &&
              (beside ? (
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
              ))}
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
  );
};

const SettingsPlace = ({
  shown,
  open,
  pane: opened,
  two,
  row,
  edges: { top, leading, trailing, bottom },
  persona: personaHeight,
  onPane,
  children: [persona, rows],
}: {
  shown: boolean;
  open: boolean;
  pane: SharedValue<number>;
  two: boolean;
  row?: number | undefined;
  edges: { top: number; leading: number; trailing: number; bottom: number };
  persona: number;
  onPane: (pane: Pane, size: Size) => void;
  children: [ReactNode, ReactNode];
}) => {
  const fade = useAnimatedStyle(() => ({
    opacity: shown ? interpolate(opened.get(), [0.25, 1], [0, 1], Extrapolation.CLAMP) : 0,
  }));

  const pane = (name: Pane, sides: { leading: number; trailing: number }) => [
    frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: "top" }),
    onGeometryChange((size) => {
      onPane(name, size);
    }),
    padding({ top, bottom, ...sides }),
  ];

  const personaPane = (
    <Column
      alignment="center"
      spacing={0}
      modifiers={pane(two ? "persona" : "alone", { leading, trailing: two ? 0 : trailing })}
    >
      <Column
        alignment="center"
        spacing={0}
        modifiers={[
          two ? frame({ maxHeight: Infinity }) : frame({ height: personaHeight }),
          frame({ maxWidth: Infinity }),
        ]}
      >
        <PageBar title="Settings" large />
        <Spacer flexible />
        {persona}
        <Spacer flexible />
      </Column>
      {two ? null : rows}
    </Column>
  );

  const rowsPane = (
    <Column alignment="center" spacing={0} modifiers={pane("rows", { leading: 0, trailing })}>
      {rows}
    </Column>
  );

  return (
    <Animated.View
      testID="settings-place"
      pointerEvents={open ? "auto" : "none"}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      style={[StyleSheet.absoluteFill, fade]}
    >
      <Host seedColor={theme.tint} avoids="keyboard" style={{ flex: 1 }}>
        <ZStack
          modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
            accessibilityElement("contain"),
            accessibilityIdentifier("voice-settings-sheet"),
          ]}
        >
          <Rectangle
            modifiers={[foregroundStyle(theme.sheet), padding({ top, leading, trailing, bottom })]}
          />
          {row === undefined ? (
            <ArrangementView
              modifiers={[
                arrangementViewStyle("split", { axes: "horizontal" }),
                frame({ maxWidth: Infinity, maxHeight: Infinity }),
              ]}
            >
              <ArrangementView.Primary>{personaPane}</ArrangementView.Primary>
              <ArrangementView.Secondary>
                {two ? rowsPane : <Spacer flexible />}
              </ArrangementView.Secondary>
            </ArrangementView>
          ) : (
            <Row spacing={0} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
              <Column spacing={0} modifiers={[frame({ width: row })]}>
                {personaPane}
              </Column>
              {rowsPane}
            </Row>
          )}
        </ZStack>
      </Host>
    </Animated.View>
  );
};
