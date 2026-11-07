import { Icon, Row, TextInput, type TextInputRef } from '@expo/ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  background,
  clipShape,
  contentShape,
  foregroundStyle,
  frame,
  minimumScaleFactor,
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

// The stages as capsules, the chosen one filled, as Muse marks the tab you're on, all four always
// in sight: on the narrowest page their words tighten a little rather than run off. Only a count
// of what needs you is mint.
export function Tabs({
  counts,
  stage,
  unknown,
  onChange,
  title,
  back,
  onSearch,
}: {
  counts: Record<Stage, number>;
  stage: Stage;
  // Not loaded yet, or hex can't be reached: no count is better than a made-up 0.
  unknown: boolean;
  onChange: (stage: Stage) => void;
  // Where the stages share the bar's row: the page's name, and its way back.
  title?: string;
  back?: Back;
  onSearch?: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        padding({ top: onSearch ? space[2] : 0, bottom: space[2] }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      {title ? (
        <Row
          alignment="center"
          spacing={space[3]}
          modifiers={[padding({ leading: metrics.list.inset - space[1], trailing: space[2] })]}
        >
          {back ? <BackButton back={back} /> : null}
          <Text numberOfLines={1} variant="title">
            {title}
          </Text>
        </Row>
      ) : null}
      <Row
        alignment="center"
        spacing={0}
        modifiers={[
          padding({
            leading: metrics.list.inset - metrics.tabs.pad,
            trailing: metrics.list.inset - metrics.tabs.pad,
          }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {STAGES.map(({ key, title }) => {
          const on = key === stage;
          const count = counts[key];
          const needs = !unknown && key === 'needs' && count > 0;
          return (
            <Row
              key={key}
              alignment="center"
              spacing={metrics.tabs.gap}
              onPress={() => onChange(key)}
              modifiers={[
                padding({ leading: metrics.tabs.pad, trailing: metrics.tabs.pad }),
                frame({ height: metrics.tabs.height }),
                ...(on ? [background(theme.card)] : []),
                clipShape('capsule'),
                contentShape(shapes.capsule()),
                accessibilityLabel(unknown ? title : `${title}, ${count}`),
                ...(on ? [accessibilityAddTraits(['isSelected'])] : []),
              ]}
            >
              <Text
                numberOfLines={1}
                variant="detail"
                weight={on ? 'medium' : 'regular'}
                tone={on ? 'text' : 'secondary'}
                modifiers={[minimumScaleFactor(metrics.tabs.tightest)]}
              >
                {title}
              </Text>
              <Text
                variant="detail"
                weight={needs ? 'medium' : 'regular'}
                tone={needs ? 'accent' : 'tertiary'}
                modifiers={[monospacedDigit(), minimumScaleFactor(metrics.tabs.tightest)]}
              >
                {unknown ? '–' : String(count)}
              </Text>
            </Row>
          );
        })}
      </Row>
      {onSearch ? (
        <Row
          alignment="center"
          spacing={0}
          modifiers={[padding({ trailing: metrics.list.inset - space[1] })]}
        >
          <SearchButton onPress={onSearch} />
        </Row>
      ) : null}
    </Row>
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
          top: space[5],
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
