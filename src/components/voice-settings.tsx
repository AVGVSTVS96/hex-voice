import { BottomSheet, Button, Column, Host, Icon, RNHostView, Row, Spacer, Text } from '@expo/ui';
import { ColorPicker, Divider, Picker, Text as NativeText, Toggle } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  frame,
  labelsHidden,
  padding,
  pickerStyle,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Persona } from '@/components/persona';
import { PERSONA_MODELS } from '@/components/persona/animation';
import {
  OPAL_PALETTES,
  PERSONA_COLORS,
  PERSONA_VARIANTS,
  isPersonaVariant,
  opalPaletteInput,
  type OpalPalette,
  type PersonaVariant,
} from '@/components/persona/variants';
import { SelectionCarousel } from '@/components/selection-carousel';
import { REACTIONS, type CallPreferences, type Reaction } from '@/hooks/use-call-preferences';
import { VOICES, isLiveVoice, type LiveVoice } from '@/live/voices';

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
const voiceOptions = VOICES.map((voice) => ({ ...voice, description: 'Swipe to choose a voice' }));
const GROUP = '#000000';
const SWITCH_ON = '#30D158';
const ORIGINAL_OPAL = 'linear-gradient(135deg, #2FB5AD, #9B4DD6 50%, #F07B3F)';
const SECONDARY = '#929292';

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
  const contentWidth = Math.min(width - 48, 480);
  const [page, setPage] = useState<'voice' | 'persona'>('voice');
  const selectedVoice = VOICES.find((option) => option.id === voice)!;
  const selectedPersona = PERSONA_VARIANTS.find((option) => option.id === persona)!;
  const colorable = PERSONA_MODELS[persona].dynamicColor;
  const dismiss = () => {
    onDismiss();
    setPage('voice');
  };
  const haptic = (enabled = preferences.haptics) => {
    if (ios && enabled) void Haptics.selectionAsync();
  };
  const openPage = (next: 'voice' | 'persona') => {
    haptic();
    setPage(next);
  };

  return (
    <Host colorScheme="dark" seedColor="#FFFFFF" style={{ position: 'absolute' }}>
      <BottomSheet
        isPresented={isPresented}
        onDismiss={dismiss}
        containerColor="#1C1C1C"
        contentPadding={{ top: 24, left: 24, right: 24, bottom: 26 }}
        testID="voice-settings-sheet"
      >
        {page === 'voice' ? (
          <Column alignment="center" spacing={18} style={{ width: contentWidth }}>
            <SelectionCarousel
              key="voice"
              options={voiceOptions}
              value={voice}
              width={contentWidth}
              enabled={voiceEnabled}
              disabledHint={
                voiceLocked ? 'End the conversation to change voices.' : 'Loading your voice…'
              }
              label="Voice"
              testID="voice-carousel"
              onChange={(next) => {
                if (!voiceEnabled || !isLiveVoice(next)) return;
                haptic();
                onVoiceChange(next);
              }}
            />
            <Group width={contentWidth}>
              <LinkRow
                icon="circle"
                title="Persona"
                value={selectedPersona.label}
                label={`Persona, ${selectedPersona.label}. Change appearance`}
                testID="persona-settings-button"
                width={contentWidth}
                onPress={() => openPage('persona')}
              />
              <Separator />
              <Column
                spacing={12}
                style={{ width: contentWidth, paddingHorizontal: 18, paddingVertical: 16 }}
              >
                <Row alignment="center" spacing={14}>
                  <RowIcon name="waveform" />
                  <Text textStyle={{ color: '#FFFFFF', fontSize: 17 }}>
                    Orb reacts to your voice
                  </Text>
                </Row>
                <Picker
                  selection={preferences.reaction}
                  onSelectionChange={(next: Reaction) => {
                    haptic();
                    preferences.setReaction(next);
                  }}
                  testID="reaction-picker"
                  modifiers={[
                    pickerStyle('segmented'),
                    frame({ width: contentWidth - 36 }),
                    accessibilityLabel('How much the orb reacts to your voice'),
                  ]}
                >
                  {REACTIONS.map((reaction) => (
                    <NativeText key={reaction.id} modifiers={[tag(reaction.id)]}>
                      {reaction.label}
                    </NativeText>
                  ))}
                </Picker>
              </Column>
              <Separator />
              <SettingRow icon="speaker.wave.2" title="Call sounds" width={contentWidth}>
                <Toggle
                  isOn={preferences.sounds}
                  onIsOnChange={(on) => {
                    haptic();
                    preferences.setSounds(on);
                  }}
                  testID="sounds-toggle"
                  modifiers={[labelsHidden(), tint(SWITCH_ON), accessibilityLabel('Call sounds')]}
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
                  modifiers={[labelsHidden(), tint(SWITCH_ON), accessibilityLabel('Haptics')]}
                />
              </SettingRow>
            </Group>
          </Column>
        ) : (
          <Column alignment="center" spacing={18} style={{ width: contentWidth }}>
            <SelectionCarousel
              key="persona"
              options={PERSONA_VARIANTS}
              value={persona}
              width={contentWidth}
              height={138}
              preview={
                isPresented ? (
                  <Persona
                    variant={persona}
                    size={160}
                    state="idle"
                    color={preferences.personaColor}
                    palette={opalPaletteInput(preferences.opalPalette)}
                  />
                ) : undefined
              }
              previewHeight={190}
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
                <OpalRow
                  palette={preferences.opalPalette}
                  width={contentWidth}
                  onChange={(next) => {
                    haptic();
                    preferences.setOpalPalette(next);
                  }}
                />
              ) : colorable ? (
                <ColorRow
                  color={preferences.personaColor}
                  width={contentWidth}
                  onChange={(next, fromPreset) => {
                    if (fromPreset) haptic();
                    preferences.setPersonaColor(next);
                  }}
                />
              ) : (
                <SettingRow icon="paintpalette" title="Color" width={contentWidth}>
                  <Text textStyle={{ color: SECONDARY, fontSize: 17 }}>
                    {`${selectedPersona.label} keeps its own`}
                  </Text>
                </SettingRow>
              )}
              <Separator />
              <LinkRow
                icon="waveform"
                title="Voice"
                value={selectedVoice.label}
                label={`Voice, ${selectedVoice.label}. Back to voices`}
                testID="voice-settings-back"
                width={contentWidth}
                onPress={() => openPage('voice')}
              />
            </Group>
          </Column>
        )}
      </BottomSheet>
    </Host>
  );
}

function Group({ width, children }: { width: number; children: ReactNode }) {
  return (
    <Column spacing={0} style={{ width, borderRadius: 26, backgroundColor: GROUP }}>
      {children}
    </Column>
  );
}

function Separator() {
  return <Divider modifiers={[padding({ leading: 58 })]} />;
}

function RowIcon({ name }: { name: SFSymbol }) {
  return ios ? (
    <Icon name={name} size={20} color="#FFFFFF" style={{ width: 26 }} />
  ) : (
    <Spacer style={{ width: 26 }} />
  );
}

function SettingRow({
  icon,
  title,
  width,
  children,
}: {
  icon: SFSymbol;
  title: string;
  width: number;
  children: ReactNode;
}) {
  return (
    <Row alignment="center" spacing={14} style={{ width, height: 58, paddingHorizontal: 18 }}>
      <RowIcon name={icon} />
      <Text textStyle={{ color: '#FFFFFF', fontSize: 17 }}>{title}</Text>
      <Spacer flexible />
      {children}
    </Row>
  );
}

function LinkRow({
  icon,
  title,
  value,
  label,
  testID,
  width,
  onPress,
}: {
  icon: SFSymbol;
  title: string;
  value: string;
  label: string;
  testID: string;
  width: number;
  onPress: () => void;
}) {
  return (
    <Button
      variant="text"
      onPress={onPress}
      testID={testID}
      style={{ padding: 0, width, height: 58 }}
      modifiers={ios ? [accessibilityLabel(label)] : undefined}
    >
      <Row alignment="center" spacing={14} style={{ width, height: 58, paddingHorizontal: 18 }}>
        <RowIcon name={icon} />
        <Text textStyle={{ color: '#FFFFFF', fontSize: 17 }}>{title}</Text>
        <Spacer flexible />
        <Text textStyle={{ color: SECONDARY, fontSize: 17 }}>{value}</Text>
        {ios ? (
          <Icon name="chevron.right" size={13} color={SECONDARY} />
        ) : (
          <Text textStyle={{ color: SECONDARY, fontSize: 21 }}>›</Text>
        )}
      </Row>
    </Button>
  );
}

function ColorRow({
  color,
  width,
  onChange,
}: {
  color: string;
  width: number;
  onChange: (color: string, fromPreset: boolean) => void;
}) {
  const custom = !PERSONA_COLORS.some((preset) => preset.id === color);
  return (
    <Row alignment="center" spacing={0} style={{ width, height: 66, paddingHorizontal: 14 }}>
      <RNHostView matchContents>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 6 }}>
          {PERSONA_COLORS.map((preset) => (
            <Swatch
              key={preset.id}
              color={preset.id}
              label={preset.label}
              selected={preset.id === color}
              onPress={() => onChange(preset.id, true)}
            />
          ))}
        </View>
      </RNHostView>
      <Spacer flexible />
      {ios && (
        <ColorPicker
          selection={color}
          supportsOpacity={false}
          onSelectionChange={(next) => onChange(next.slice(0, 7).toUpperCase(), false)}
          modifiers={[
            labelsHidden(),
            accessibilityLabel(custom ? 'Custom color, selected' : 'Custom color'),
          ]}
        />
      )}
    </Row>
  );
}

function OpalRow({
  palette,
  width,
  onChange,
}: {
  palette: OpalPalette;
  width: number;
  onChange: (palette: OpalPalette) => void;
}) {
  const gap = 4;
  const count = OPAL_PALETTES.length;
  const size = Math.min(38, Math.floor((width - 28 - gap * (count - 1)) / count));
  return (
    <Row alignment="center" spacing={0} style={{ width, height: 66, paddingHorizontal: 14 }}>
      <RNHostView matchContents>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap }}>
          {OPAL_PALETTES.map((option) => (
            <Swatch
              key={option.id}
              color={option.swatch ?? undefined}
              label={option.label}
              size={size}
              selected={option.id === palette}
              onPress={() => onChange(option.id)}
            />
          ))}
        </View>
      </RNHostView>
    </Row>
  );
}

function Swatch({
  color,
  label,
  selected,
  onPress,
  size = 38,
}: {
  color?: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: number;
}) {
  const inner = size - 10;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: selected ? '#FFFFFF' : 'transparent',
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
