import { Column, Icon, Row, ScrollView, TextInput, type TextInputRef } from '@expo/ui';
import { Capsule, Overlay, Rectangle } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  contentShape,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useContext, type RefObject } from 'react';

import { BackButton, BarButton, type Back } from '@/components/tasks/bar';
import { Typing } from '@/components/tasks/pages';
import { STAGES, type Stage } from '@/live/inbox';
import { theme } from '@/theme';
import { glass } from '@/ui/glass-button';
import { Text } from '@/ui/text';
import { labelOf, metrics, space } from '@/ui/tokens';

export function SearchButton({ onPress }: { onPress: () => void }) {
  return (
    <BarButton shape="circle" label="Search" testID="tasks-search" onPress={onPress}>
      <Icon name="magnifyingglass" size={metrics.symbol.bar} color={theme.text} />
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
      modifiers={[
        frame({ maxWidth: Infinity }),
        ...(onSearch ? [padding({ top: space[2.5] })] : []),
      ]}
    >
      <Row alignment="center" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
        {back ? (
          <Row
            alignment="center"
            spacing={0}
            modifiers={[padding({ leading: metrics.list.inset - space[1], bottom: space[2] })]}
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
            spacing={space[5]}
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
                    spacing={metrics.tabs.gap}
                    onPress={() => onChange(key)}
                    modifiers={[
                      padding({ bottom: metrics.tabs.underline }),
                      contentShape(shapes.rectangle()),
                      accessibilityLabel(unknown ? title : `${title}, ${count}`),
                      ...(on ? [accessibilityAddTraits(['isSelected'])] : []),
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      variant="subheadline"
                      weight={on ? 'semibold' : 'medium'}
                      tone={on ? 'text' : 'secondary'}
                    >
                      {title}
                    </Text>
                    <Text
                      variant="subheadline"
                      weight={on || needs ? 'semibold' : 'medium'}
                      tone={needs ? 'accent' : on ? 'text' : 'tertiary'}
                      modifiers={[monospacedDigit()]}
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
            modifiers={[padding({ trailing: metrics.list.inset - space[1], bottom: space[2] })]}
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
      spacing={space[2.5]}
      modifiers={[
        padding({
          leading: space[4],
          trailing: metrics.list.inset - space[1],
          top: space[4.5],
          bottom: space[2.5],
        }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Row
        alignment="center"
        spacing={space[2]}
        modifiers={[
          padding({ leading: space[3.5], trailing: space[3.5] }),
          frame({ height: metrics.bar.button }),
          frame({ maxWidth: Infinity }),
          glass('capsule'),
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
          textStyle={labelOf('callout')}
          modifiers={[
            foregroundStyle(theme.text),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        />
      </Row>
      <BarButton shape="circle" label="Cancel" testID="tasks-search-cancel" onPress={onCancel}>
        <Icon name="xmark" size={metrics.symbol.bar} color={theme.text} />
      </BarButton>
    </Row>
  );
}
