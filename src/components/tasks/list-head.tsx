import { Column, Icon, Row, ScrollView, Text, TextInput, type TextInputRef } from '@expo/ui';
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
import { useContext, type RefObject } from 'react';

import { BackButton, BAR, BarButton, type Back } from '@/components/tasks/bar';
import { Typing } from '@/components/tasks/pages';
import { ios } from '@/components/tasks/parts';
import { STAGES, type Stage } from '@/live/inbox';
import { theme } from '@/theme';
import { metrics } from '@/ui/tokens';

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
  unknown,
  onChange,
  back,
  onSearch,
}: {
  counts: Record<Stage, number>;
  stage: Stage;
  // Not loaded yet, or hex can't be reached: no count is better than a made-up 0.
  unknown: boolean;
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
            modifiers={[padding({ leading: metrics.list.inset - 4, bottom: 8 })]}
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
            modifiers={[padding({ leading: metrics.list.inset, trailing: metrics.list.inset })]}
          >
            {STAGES.map(({ key, title }) => {
              const on = key === stage;
              const count = counts[key];
              const needs = !unknown && key === 'needs' && count > 0;
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
                            accessibilityLabel(unknown ? title : `${title}, ${count}`),
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
                      {unknown ? '–' : String(count)}
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
            modifiers={[padding({ trailing: metrics.list.inset - 4, bottom: 8 })]}
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
  field,
  query,
  onChange,
  onCancel,
}: {
  field: RefObject<TextInputRef | null>;
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
        padding({ leading: 16, trailing: metrics.list.inset - 4, top: 18, bottom: 10 }),
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
          ref={field}
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
