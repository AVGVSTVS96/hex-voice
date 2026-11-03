import { Column, Icon, Row, Text } from '@expo/ui';
import { Button } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { createContext, useContext, type ReactNode } from 'react';

import { INSET, ios } from '@/components/tasks/parts';
import { PlaceTile } from '@/components/tasks/places';
import { glass } from '@/components/voice-control';
import { PLACES, type Place } from '@/live/inbox';
import { theme } from '@/theme';

// iOS 26's bar buttons: 44pt glass, a circle for a symbol and a capsule for a name.
export const BAR = 44;

// Back names where it goes; `short`, it shows only its chevron, and still says where to VoiceOver.
export type Back = { to: string; short: boolean; onPress: () => void };

export type Chrome = { back?: Back };
export const PageChrome = createContext<Chrome>({});
export const useChrome = () => useContext(PageChrome);

export type Door = { place: Place; onPress: () => void };

export function Header({
  title,
  subtitle,
  door,
}: {
  title: string;
  subtitle: string;
  door?: Door;
}) {
  const { back } = useChrome();
  return (
    <PageBar
      title={title}
      subtitle={subtitle}
      back={back}
      trailing={door ? <DoorPill door={door} /> : undefined}
    />
  );
}

export function PageBar({
  title,
  subtitle,
  back,
  trailing,
}: {
  title: string;
  subtitle?: string;
  back?: Back;
  trailing?: ReactNode;
}) {
  const backButton = back ? <BackButton back={back} /> : null;
  return (
    <Row
      alignment="center"
      spacing={12}
      modifiers={[
        padding({ leading: INSET - 4, trailing: 16, top: 6, bottom: 6 }),
        frame({ minHeight: BAR + 12 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      {backButton}
      <Column
        alignment="start"
        spacing={1}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 17, fontWeight: '600' }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            textStyle={{ fontSize: 13 }}
            modifiers={[foregroundStyle(theme.secondary)]}
          >
            {subtitle}
          </Text>
        ) : null}
      </Column>
      {trailing}
    </Row>
  );
}

export function BackButton({ back }: { back: Back }) {
  return (
    <BarButton
      shape={back.short ? 'circle' : 'capsule'}
      label={`Back to ${back.to}`}
      testID="task-back"
      onPress={back.onPress}
    >
      <Icon name="chevron.left" size={17} color={theme.accent} />
      {!back.short ? (
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 17, fontWeight: '500' }}
          modifiers={[foregroundStyle(theme.accent)]}
        >
          {back.to}
        </Text>
      ) : null}
    </BarButton>
  );
}

// The way out to the app a page lives in: its place's tile in a glass circle, so the title keeps
// the bar's width.
function DoorPill({ door }: { door: Door }) {
  return (
    <BarButton shape="circle" label={`Open in ${PLACES[door.place]}`} onPress={door.onPress}>
      <PlaceTile place={door.place} size={24} />
    </BarButton>
  );
}

// Talk a topic through with hex: a secondary glass button at a page's foot, a circle beside the
// composer or named on its own. The call's own button stays the one prominent one.
export function Talk({ alone, onPress }: { alone: boolean; onPress: () => void }) {
  return (
    <BarButton
      shape={alone ? 'capsule' : 'circle'}
      label="Talk it through with hex"
      testID="talk-it-through"
      onPress={onPress}
    >
      <Icon name="waveform" size={17} color={theme.text} />
      {alone ? (
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 16, fontWeight: '600' }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          Talk it through
        </Text>
      ) : null}
    </BarButton>
  );
}

// Not buttonStyle('glass'): its padding grows each control past BAR by a different amount.
export function BarButton({
  shape,
  label,
  testID,
  onPress,
  children,
}: {
  shape: 'circle' | 'capsule';
  label: string;
  testID?: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      onPress={onPress}
      testID={testID}
      modifiers={[buttonStyle('plain'), ...(ios ? [accessibilityLabel(label)] : [])]}
    >
      <Row
        alignment="center"
        spacing={shape === 'circle' ? 0 : 6}
        modifiers={[
          ...(shape === 'circle'
            ? [frame({ width: BAR, height: BAR })]
            : [padding({ leading: 13, trailing: 15 }), frame({ height: BAR })]),
          glass(shape),
          contentShape(shape === 'circle' ? shapes.circle() : shapes.capsule()),
        ]}
      >
        {children}
      </Row>
    </Button>
  );
}
