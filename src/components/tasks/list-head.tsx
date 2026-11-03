import { Column, Icon, Row, ScrollView, Text, TextInput } from '@expo/ui';
import { Capsule, Overlay, Rectangle } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  contentShape,
  foregroundStyle,
  frame,
  glassEffect,
  monospacedDigit,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useContext } from 'react';

import { BackButton, BAR, BarButton, type Back } from '@/components/tasks/bar';
import { Typing } from '@/components/tasks/pages';
import { INSET, ios } from '@/components/tasks/parts';
import { STAGES, type Stage } from '@/live/inbox';
import { theme } from '@/theme';

// Held wide, folds the list to one row per project, or back out to every task.
// In Quiet, already one row per project, it stays in place but does nothing.
export function CollapseButton({
  collapsed,
  disabled,
  onPress,
}: {
  collapsed: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <BarButton
      shape="circle"
      disabled={disabled}
      label={collapsed ? 'Show every task' : 'Show projects only'}
      testID="tasks-collapse"
      onPress={onPress}
    >
      <Icon
        name={collapsed ? 'rectangle.expand.vertical' : 'rectangle.compress.vertical'}
        size={17}
        color={theme.text}
      />
    </BarButton>
  );
}

export function SearchButton({ onPress }: { onPress: () => void }) {
  return (
    <BarButton shape="circle" label="Search" testID="tasks-search" onPress={onPress}>
      <Icon name="magnifyingglass" size={17} color={theme.text} />
    </BarButton>
  );
}

export function Tabs({
  counts,
  stage,
  offline,
  onChange,
  back,
  onSearch,
}: {
  counts: Record<Stage, number>;
  stage: Stage;
  offline: boolean;
  onChange: (stage: Stage) => void;
  back?: Back;
  onSearch?: () => void;
}) {
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity }), ...(onSearch ? [padding({ top: 10 })] : [])]}
    >
      <Row alignment="center" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
        {back ? (
          <Row
            alignment="center"
            spacing={0}
            modifiers={[padding({ leading: INSET - 4, bottom: 8 })]}
          >
            <BackButton back={back} />
          </Row>
        ) : null}
        <ScrollView
          direction="horizontal"
          showsIndicators={false}
          modifiers={[frame({ maxWidth: Infinity })]}
        >
          <Row
            alignment="end"
            spacing={20}
            modifiers={[padding({ leading: INSET, trailing: INSET })]}
          >
            {STAGES.map(({ key, title }) => {
              const on = key === stage;
              const count = counts[key];
              const needs = key === 'needs' && count > 0;
              return (
                <Overlay key={key} alignment="bottom">
                  <Row
                    alignment="center"
                    spacing={5}
                    onPress={() => onChange(key)}
                    modifiers={[
                      padding({ bottom: 11 }),
                      contentShape(shapes.rectangle()),
                      ...(ios
                        ? [
                            accessibilityLabel(`${title}, ${count}`),
                            ...(on ? [accessibilityAddTraits(['isSelected'])] : []),
                          ]
                        : []),
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      textStyle={{ fontSize: 15, fontWeight: on ? '600' : '500' }}
                      modifiers={[foregroundStyle(on ? theme.text : theme.secondary)]}
                    >
                      {title}
                    </Text>
                    <Text
                      textStyle={{ fontSize: 15, fontWeight: on || needs ? '600' : '500' }}
                      modifiers={[
                        monospacedDigit(),
                        foregroundStyle(needs ? theme.accent : on ? theme.text : theme.tertiary),
                      ]}
                    >
                      {offline ? '–' : String(count)}
                    </Text>
                  </Row>
                  {on ? (
                    <Overlay.Content>
                      <Capsule modifiers={[frame({ height: 2 }), foregroundStyle(theme.accent)]} />
                    </Overlay.Content>
                  ) : null}
                </Overlay>
              );
            })}
          </Row>
        </ScrollView>
        {onSearch ? (
          <Row
            alignment="center"
            spacing={0}
            modifiers={[padding({ trailing: INSET - 4, bottom: 8 })]}
          >
            <SearchButton onPress={onSearch} />
          </Row>
        ) : null}
      </Row>
      <Rectangle
        modifiers={[
          frame({ height: 1 }),
          frame({ maxWidth: Infinity }),
          foregroundStyle(theme.edge),
        ]}
      />
    </Column>
  );
}

export function Search({
  query,
  onChange,
  onCancel,
}: {
  query: string;
  onChange: (query: string) => void;
  onCancel: () => void;
}) {
  const typing = useContext(Typing);
  return (
    <Row
      alignment="center"
      spacing={10}
      modifiers={[
        padding({ leading: 16, trailing: INSET - 4, top: 18, bottom: 10 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Row
        alignment="center"
        spacing={8}
        modifiers={[
          padding({ leading: 14, trailing: 14 }),
          frame({ height: BAR }),
          frame({ maxWidth: Infinity }),
          glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'capsule' }),
        ]}
      >
        <Icon name="magnifyingglass" size={14} color={theme.secondary} />
        <TextInput
          autoFocus
          testID="tasks-search-field"
          onFocus={() => typing(true)}
          onBlur={() => typing(false)}
          defaultValue={query}
          placeholder="Tasks, topics, asks"
          placeholderTextColor={theme.tertiary}
          cursorColor={theme.accent}
          onChangeText={onChange}
          textStyle={{ fontSize: 16 }}
          modifiers={[
            foregroundStyle(theme.text),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        />
      </Row>
      <BarButton shape="circle" label="Cancel" testID="tasks-search-cancel" onPress={onCancel}>
        <Icon name="xmark" size={17} color={theme.text} />
      </BarButton>
    </Row>
  );
}
