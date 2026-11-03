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
import { PLACES, type Place } from '@/live/inbox';
import { theme } from '@/theme';

const HEADER = 36;

// Back, named for where it goes ('' draws a bare chevron).
export type Back = { to: string; onPress: () => void };

// What a page's bar takes from where the page sits: how it's drawn, and its Back.
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
        back={back && { ...back, to: back.to === title ? '' : back.to }}
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

// A page's bar on iPhone Duo: Back and what sits at the bar's end over the page's name set large,
// or all of it on one line.
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
          padding({ leading: INSET - 4, trailing: 16, top: 8, bottom: 8 }),
          frame({ minHeight: 56 }),
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
          modifiers={[frame({ height: 44 }), frame({ maxWidth: Infinity })]}
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
          padding({ top: 2 }),
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

// Back as iOS 26 draws it in a bar: a chevron, and the name of where it goes, on Liquid Glass.
export function BackButton({ back }: { back: Back }) {
  return (
    <Button
      onPress={back.onPress}
      testID="task-back"
      modifiers={[
        buttonStyle('glass'),
        buttonBorderShape(back.to ? 'capsule' : 'circle'),
        controlSize('large'),
        ...(ios ? [accessibilityLabel(back.to ? `Back to ${back.to}` : 'Back')] : []),
      ]}
    >
      <Row alignment="center" spacing={4}>
        <Icon name="chevron.left" size={16} color={theme.accent} />
        {back.to ? (
          <Text
            numberOfLines={1}
            textStyle={{ fontSize: 17, fontWeight: '500' }}
            modifiers={[foregroundStyle(theme.accent)]}
          >
            {back.to}
          </Text>
        ) : null}
      </Row>
    </Button>
  );
}

// A page's door out on iPhone Duo: its app's mark and name, with the arrow that says it leaves.
function DoorPill({ door }: { door: Door }) {
  return (
    <Button
      onPress={door.onPress}
      modifiers={[
        buttonStyle('glass'),
        buttonBorderShape('capsule'),
        controlSize('large'),
        ...(ios ? [accessibilityLabel(`Open in ${PLACES[door.place]}`)] : []),
      ]}
    >
      <Row alignment="center" spacing={7}>
        <PlaceTile place={door.place} size={22} />
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 15, fontWeight: '600' }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          {PLACES[door.place]}
        </Text>
        <Icon name="arrow.up.right" size={11} color={theme.secondary} />
      </Row>
    </Button>
  );
}
