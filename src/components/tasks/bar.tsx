import { Column, Icon, Row } from '@expo/ui';
import { Button } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  disabled as disabledModifier,
  frame,
  opacity,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { createContext, useContext, type ReactNode } from 'react';

import { PlaceTile } from '@/components/tasks/places';
import { glass } from '@/ui/glass-button';
import { PLACES, type Place } from '@/live/inbox';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { metrics, space } from '@/ui/tokens';

// Back is its chevron alone in every pose, and says where it goes to VoiceOver.
export type Back = { to: string; onPress: () => void };

export type Chrome = { back?: Back };
export const PageChrome = createContext<Chrome>({});
export const useChrome = () => useContext(PageChrome);

export type Door = { place: Place; onPress: () => void };

export const Header = ({
  title,
  subtitle,
  door,
}: {
  title: string;
  subtitle: string;
  door?: Door;
}) => {
  const { back } = useChrome();
  return (
    <PageBar
      title={title}
      subtitle={subtitle}
      large
      back={back}
      trailing={door ? <DoorPill door={door} /> : undefined}
    />
  );
};

// A page's bar: its way back, its name and a line under it, and what it leads to. A `large` name is
// the list's own, at title size, as Muse names its pages.
export const PageBar = ({
  title,
  subtitle,
  large = false,
  back,
  trailing,
}: {
  title: string;
  subtitle?: string;
  large?: boolean;
  back?: Back;
  trailing?: ReactNode;
}) => {
  const backButton = back ? <BackButton back={back} /> : null;
  return (
    <Row
      alignment="center"
      spacing={space[3]}
      modifiers={[
        padding({
          leading: metrics.list.inset - space[1],
          trailing: space[4],
          top: space[2],
          bottom: space[2],
        }),
        frame({ minHeight: metrics.bar.button + space[3] }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      {backButton}
      <Column
        alignment="start"
        spacing={space[0.5]}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text numberOfLines={1} variant={large ? 'title' : 'headline'}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} variant="detail" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </Column>
      {trailing}
    </Row>
  );
};

export const BackButton = ({ back }: { back: Back }) => (
  <BarButton shape="circle" label={`Back to ${back.to}`} testID="back" onPress={back.onPress}>
    <Icon name="chevron.left" size={metrics.symbol.bar} color={theme.text} />
  </BarButton>
);

// The way out to the app a page lives in: its place's tile in a glass circle, so the title keeps
// the bar's width.
const DoorPill = ({ door }: { door: Door }) => (
  <BarButton shape="circle" label={`Open in ${PLACES[door.place]}`} onPress={door.onPress}>
    <PlaceTile place={door.place} size={24} />
  </BarButton>
);

// Talk a topic through with hex: a secondary glass button at a page's foot, a circle beside the
// composer or named on its own. Its own glyph, so it never reads as the call's button beside it.
export const Talk = ({
  about,
  alone,
  onPress,
}: {
  about: string;
  alone: boolean;
  onPress: () => void;
}) => (
  <BarButton
    shape={alone ? 'capsule' : 'circle'}
    label={`Talk ${about} through with hex`}
    testID="talk-it-through"
    onPress={onPress}
  >
    <Icon name="phone.and.waveform" size={metrics.symbol.bar} color={theme.text} />
    {alone ? (
      <Text numberOfLines={1} variant="body" weight="medium">
        Talk it through
      </Text>
    ) : null}
  </BarButton>
);

// Not buttonStyle('glass'): its padding grows each control past 44pt by a different amount.
export const BarButton = ({
  shape,
  label,
  testID,
  disabled = false,
  onPress,
  children,
}: {
  shape: 'circle' | 'capsule';
  label: string;
  testID?: string;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) => (
  <Button
    onPress={onPress}
    testID={testID}
    modifiers={[
      buttonStyle('plain'),
      ...(disabled ? [disabledModifier(true), opacity(0.4)] : []),
      accessibilityLabel(label),
    ]}
  >
    <Row
      alignment="center"
      spacing={shape === 'circle' ? 0 : metrics.bar.capsule.gap}
      modifiers={[
        ...(shape === 'circle'
          ? [frame({ width: metrics.bar.button, height: metrics.bar.button })]
          : [
              padding({
                leading: metrics.bar.capsule.leading,
                trailing: metrics.bar.capsule.trailing,
              }),
              frame({ height: metrics.bar.button }),
            ]),
        glass(shape),
        contentShape(shape === 'circle' ? shapes.circle() : shapes.capsule()),
      ]}
    >
      {children}
    </Row>
  </Button>
);
