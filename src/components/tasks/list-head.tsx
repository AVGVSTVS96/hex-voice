import { Column, Icon, Row, ScrollView, TextInput, type TextInputRef } from '@expo/ui';
import { Circle, Rectangle, ZStack } from '@expo/ui/swift-ui';
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
import { labelOf, metrics, space, type Tone } from '@/ui/tokens';

export function SearchButton({ onPress }: { onPress: () => void }) {
  return (
    <BarButton shape="circle" label="Search" testID="tasks-search" onPress={onPress}>
      <Icon name="magnifyingglass" size={metrics.symbol.bar} color={theme.text} />
    </BarButton>
  );
}

// Each stage's color, as Muse colors a section's name and the dot beside it.
const STAGE_TONES: Record<Stage, { word: Tone; dot: Tone }> = {
  needs: { word: 'accent', dot: 'accentFill' },
  working: { word: 'progress', dot: 'progressFill' },
  done: { word: 'text', dot: 'fillStrong' },
  quiet: { word: 'secondary', dot: 'fill' },
};

function Badge({ tone }: { tone: { word: Tone; dot: Tone } }) {
  return (
    <ZStack alignment="center">
      <Circle
        modifiers={[
          frame({ width: metrics.tabs.badge, height: metrics.tabs.badge }),
          foregroundStyle(theme[tone.dot]),
        ]}
      />
      <Circle
        modifiers={[
          frame({ width: metrics.tabs.dot, height: metrics.tabs.dot }),
          foregroundStyle(theme[tone.word]),
        ]}
      />
    </ZStack>
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
      modifiers={[frame({ maxWidth: Infinity }), ...(onSearch ? [padding({ top: space[3] })] : [])]}
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
              const tone = STAGE_TONES[key];
              return (
                <Row
                  key={key}
                  alignment="center"
                  spacing={metrics.tabs.gap}
                  onPress={() => onChange(key)}
                  modifiers={[
                    padding({ bottom: metrics.tabs.under }),
                    contentShape(shapes.rectangle()),
                    accessibilityLabel(unknown ? title : `${title}, ${count}`),
                    ...(on ? [accessibilityAddTraits(['isSelected'])] : []),
                  ]}
                >
                  {on ? <Badge tone={tone} /> : null}
                  <Text
                    numberOfLines={1}
                    variant="detail"
                    weight={on ? 'semibold' : 'regular'}
                    tone={on ? tone.word : 'secondary'}
                  >
                    {title}
                  </Text>
                  <Text
                    variant="detail"
                    weight={on || needs ? 'semibold' : 'regular'}
                    tone={needs ? 'accent' : on ? tone.word : 'tertiary'}
                    modifiers={[monospacedDigit()]}
                  >
                    {unknown ? '–' : String(count)}
                  </Text>
                </Row>
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
      spacing={space[3]}
      modifiers={[
        padding({
          leading: space[4],
          trailing: metrics.list.inset - space[1],
          top: space[4],
          bottom: space[3],
        }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Row
        alignment="center"
        spacing={space[2]}
        modifiers={[
          padding({ leading: space[4], trailing: space[4] }),
          frame({ height: metrics.bar.button }),
          frame({ maxWidth: Infinity }),
          glass('capsule'),
        ]}
      >
        <Icon name="magnifyingglass" size={metrics.symbol.small} color={theme.secondary} />
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
          textStyle={labelOf('body')}
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
