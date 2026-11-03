import { Column, Icon, Row, ScrollView, Text, TextInput } from '@expo/ui';
import { Button, Capsule, Overlay, Rectangle } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  contentShape,
  controlSize,
  foregroundStyle,
  frame,
  glassEffect,
  labelStyle,
  monospacedDigit,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

import { BackButton, type Back } from '@/components/tasks/bar';
import { INSET, ios } from '@/components/tasks/parts';
import { STAGES, type Stage } from '@/live/inbox';
import { theme } from '@/theme';

// The list's head in a sheet or iPad's pane: its title and search. The title sits on the toolbar's
// line where there is one beside it (`line`), and under the grabber in a sheet.
export function ListHead({ line, onSearch }: { line?: number; onSearch: () => void }) {
  return (
    <Row
      alignment="center"
      spacing={12}
      modifiers={[
        padding({
          leading: INSET,
          trailing: INSET - 4,
          top: line === undefined ? 22 : Math.max(8, line - 20),
          bottom: 12,
        }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Text
        numberOfLines={1}
        textStyle={{ fontSize: 28, fontWeight: '700' }}
        modifiers={[
          foregroundStyle(theme.text),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        Tasks
      </Text>
      <SearchButton onPress={onSearch} />
    </Row>
  );
}

export function SearchButton({ onPress }: { onPress: () => void }) {
  return (
    <Button
      label="Search"
      systemImage="magnifyingglass"
      onPress={onPress}
      testID="tasks-search"
      modifiers={[
        labelStyle('iconOnly'),
        buttonStyle('glass'),
        buttonBorderShape('circle'),
        controlSize('regular'),
      ]}
    />
  );
}

// The stages as tabs, each with its count: words, the chosen one in text with a mint rule under it
// that sits on the line across the list. What needs you counts in mint whichever tab is open.
// Where the list has no room for its title, its Back leads the tabs and search sits at their end.
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

// Search: on iPhone Duo's pages as iOS 26 draws it, the field on Liquid Glass and a glass button
// that puts it away; in a sheet or iPad's pane, a filled field and Cancel.
export function Search({
  query,
  glass,
  onChange,
  onCancel,
}: {
  query: string;
  glass: boolean;
  onChange: (query: string) => void;
  onCancel: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={glass ? 10 : 12}
      modifiers={[
        padding({ leading: 16, trailing: glass ? INSET - 4 : INSET, top: 18, bottom: 10 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Row
        alignment="center"
        spacing={8}
        modifiers={[
          padding({ leading: glass ? 14 : 12, trailing: glass ? 14 : 12 }),
          frame({ height: glass ? 44 : 40 }),
          frame({ maxWidth: Infinity }),
          ...(glass
            ? [glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'capsule' })]
            : [background(theme.surface), clipShape('roundedRectangle', 12)]),
        ]}
      >
        <Icon name="magnifyingglass" size={14} color={theme.secondary} />
        <TextInput
          autoFocus
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
      {glass ? (
        <Button
          label="Cancel"
          systemImage="xmark"
          onPress={onCancel}
          testID="tasks-search-cancel"
          modifiers={[
            labelStyle('iconOnly'),
            buttonStyle('glass'),
            buttonBorderShape('circle'),
            controlSize('large'),
          ]}
        />
      ) : (
        <Text
          onPress={onCancel}
          textStyle={{ fontSize: 16, fontWeight: '500' }}
          modifiers={[foregroundStyle(theme.accent)]}
        >
          Cancel
        </Text>
      )}
    </Row>
  );
}
