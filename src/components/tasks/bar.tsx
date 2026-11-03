import { Column, Icon, Row, Spacer, Text } from '@expo/ui';
import { Button } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  contentShape,
  controlSize,
  foregroundStyle,
  frame,
  labelStyle,
  layoutPriority,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { createContext, useContext, type ReactNode } from 'react';

import type { Bar } from '@/components/tasks/pages';
import { INSET, ios } from '@/components/tasks/parts';
import { PlaceTile } from '@/components/tasks/places';
import { glass } from '@/components/voice-control';
import { PLACES, type Place } from '@/live/inbox';
import { theme } from '@/theme';

const HEADER = 36;
// iOS 26's bar buttons: 44pt glass, a circle for a symbol and a capsule for a name.
export const BAR = 44;

export type Back = { to?: string; onPress: () => void };

export type Chrome = { bar: Bar; back?: Back };
export const PageChrome = createContext<Chrome>({ bar: 'center' });
export const useChrome = () => useContext(PageChrome);

// Where a page opens in its app, as its bar holds it.
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
  const { bar, back } = useChrome();
  if (bar !== 'center')
    return (
      <PageBar
        bar={bar}
        title={title}
        subtitle={subtitle}
        back={back}
        trailing={door ? <DoorPill door={door} /> : undefined}
      />
    );
  return (
    <Row
      alignment="center"
      spacing={12}
      modifiers={[
        frame({ minHeight: HEADER }),
        padding({ top: 14, leading: 16, trailing: 16 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      {back ? (
        <Button
          label="Back"
          systemImage="chevron.left"
          onPress={back.onPress}
          testID="task-back"
          modifiers={[
            labelStyle('iconOnly'),
            buttonStyle('glass'),
            buttonBorderShape('circle'),
            controlSize('regular'),
          ]}
        />
      ) : (
        <Spacer style={{ width: HEADER }} />
      )}
      <Spacer flexible />
      <Column alignment="center" spacing={1}>
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
      <Spacer flexible />
      {door ? (
        <Row
          alignment="center"
          spacing={0}
          onPress={door.onPress}
          modifiers={[
            frame({ width: 36, height: 36 }),
            contentShape(shapes.rectangle()),
            ...(ios ? [accessibilityLabel(`Open in ${PLACES[door.place]}`)] : []),
          ]}
        >
          <PlaceTile place={door.place} size={30} />
        </Row>
      ) : (
        <Spacer style={{ width: HEADER }} />
      )}
    </Row>
  );
}

export function PageBar({
  bar,
  title,
  subtitle,
  back,
  trailing,
}: {
  bar: Exclude<Bar, 'center'>;
  title: string;
  subtitle?: string;
  back?: Back;
  trailing?: ReactNode;
}) {
  const backButton = back ? <BackButton back={back} /> : null;
  if (bar === 'inline')
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
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 19, fontWeight: '700' }}
          modifiers={[foregroundStyle(theme.text), layoutPriority(1)]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 14 }}
          modifiers={[
            foregroundStyle(theme.secondary),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        >
          {subtitle ?? ''}
        </Text>
        {trailing}
      </Row>
    );
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[
        padding({ leading: INSET, trailing: 16, top: 8, bottom: 10 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
      ]}
    >
      {backButton || trailing ? (
        <Row
          alignment="center"
          spacing={12}
          modifiers={[frame({ height: BAR }), frame({ maxWidth: Infinity })]}
        >
          {backButton}
          <Spacer flexible />
          {trailing}
        </Row>
      ) : null}
      <Text
        numberOfLines={2}
        textStyle={{ fontSize: 28, fontWeight: '700' }}
        modifiers={[
          foregroundStyle(theme.text),
          padding({ top: 10 }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 15 }}
          modifiers={[
            foregroundStyle(theme.secondary),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </Column>
  );
}

export function BackButton({ back }: { back: Back }) {
  return (
    <BarButton
      shape={back.to ? 'capsule' : 'circle'}
      label={back.to ? `Back to ${back.to}` : 'Back'}
      testID="task-back"
      onPress={back.onPress}
    >
      <Icon name="chevron.left" size={17} color={theme.accent} />
      {back.to ? (
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 17, fontWeight: '500' }}
          modifiers={[foregroundStyle(theme.accent), frame({ maxWidth: 180 })]}
        >
          {back.to}
        </Text>
      ) : null}
    </BarButton>
  );
}

function DoorPill({ door }: { door: Door }) {
  return (
    <BarButton shape="capsule" label={`Open in ${PLACES[door.place]}`} onPress={door.onPress}>
      <PlaceTile place={door.place} size={22} />
      <Text
        numberOfLines={1}
        textStyle={{ fontSize: 15, fontWeight: '600' }}
        modifiers={[foregroundStyle(theme.text)]}
      >
        {PLACES[door.place]}
      </Text>
      <Icon name="arrow.up.right" size={11} color={theme.secondary} />
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
