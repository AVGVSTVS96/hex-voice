import { Column, RNHostView, Row, Spacer } from '@expo/ui';
import { Circle, TabView, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  contentShape,
  foregroundStyle,
  frame,
  shapes,
  tabViewStyle,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactElement } from 'react';
import { View } from 'react-native';

import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { metrics, space } from '@/ui/tokens';

interface SelectionOption {
  id: string;
  label: string;
  description: string;
}

export const SelectionCarousel = ({
  options,
  value,
  onChange,
  onPress,
  width,
  height = 180,
  preview,
  previewHeight = 0,
  enabled = true,
  disabledHint,
  label,
  testID,
}: {
  options: readonly SelectionOption[];
  value: string;
  onChange: (value: string) => void;
  onPress?: () => void;
  width: number;
  height?: number;
  preview?: ReactElement;
  previewHeight?: number;
  enabled?: boolean;
  disabledHint?: string;
  label: string;
  testID: string;
}) => {
  const totalHeight = height + previewHeight;
  // A static page prevents both swipe and page-dot changes during a call.
  if (!enabled) {
    const selected = options.find((option) => option.id === value) ?? options[0];
    return (
      <SelectionPage
        option={{ ...selected, description: disabledHint ?? selected.description }}
        width={width}
        height={height}
        testID={`${testID}-locked`}
      />
    );
  }

  // The pager reports each change, which lands halfway through a swipe, and is handed back the page
  // it's on, so a swipe never waits on JavaScript; a tapped dot hands it another.
  const pager = (
    <TabView
      selection={value}
      onSelectionChange={(next) => {
        if (next !== value && options.some((option) => option.id === next)) {
          onChange(next);
        }
      }}
      testID={testID}
      modifiers={[
        frame({ width, height: totalHeight }),
        tabViewStyle({ type: 'page', indexDisplayMode: 'never' }),
        accessibilityLabel(label),
      ]}
    >
      {options.map((option) => (
        <TabView.Tab key={option.id} value={option.id}>
          <SelectionPage
            option={option}
            width={width}
            height={totalHeight}
            previewHeight={previewHeight}
            onPress={onPress}
            testID={`${testID}-${option.id}`}
          />
        </TabView.Tab>
      ))}
    </TabView>
  );

  // The page dots are drawn here rather than by iOS, whose dots stay white on a light ground. As
  // iOS's do, each says which page it is and a tap on one goes there.
  const dots = (
    <Row alignment="center" spacing={0} modifiers={[frame({ height: metrics.pageDots })]}>
      {options.map((option, i) => {
        const current = option.id === value;
        return (
          <Row
            key={option.id}
            alignment="center"
            spacing={0}
            onPress={current ? undefined : () => onChange(option.id)}
            modifiers={[
              frame({ width: DOT * 2, height: REACH }),
              contentShape(shapes.rectangle()),
              accessibilityLabel(`${option.label}, ${i + 1} of ${options.length}`),
              ...(current ? [accessibilityAddTraits(['isSelected'])] : []),
            ]}
          >
            <Circle
              modifiers={[
                frame({ width: DOT, height: DOT }),
                foregroundStyle(current ? theme.text : theme.tertiary),
              ]}
            />
          </Row>
        );
      })}
    </Row>
  );
  return (
    <ZStack alignment="bottom" modifiers={[frame({ width, height: totalHeight })]}>
      {preview ? (
        <Column
          alignment="center"
          spacing={0}
          modifiers={[frame({ width, height: totalHeight, alignment: 'top' })]}
        >
          <RNHostView matchContents>
            <View
              pointerEvents="none"
              style={{
                width,
                height: previewHeight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {preview}
            </View>
          </RNHostView>
        </Column>
      ) : null}
      {/* The transparent pager covers the preview, so the entire control swipes. */}
      {pager}
      {dots}
    </ZStack>
  );
};

const DOT = 7;
const REACH = 30;

const SelectionPage = ({
  option,
  width,
  height,
  previewHeight = 0,
  onPress,
  testID,
}: {
  option: SelectionOption;
  width: number;
  height: number;
  previewHeight?: number;
  onPress?: () => void;
  testID: string;
}) => (
  <Column
    alignment="center"
    spacing={space[2]}
    style={{
      width,
      height,
      paddingHorizontal: space[4],
      paddingTop: previewHeight,
      paddingBottom: metrics.pageDots,
    }}
    onPress={onPress}
    testID={testID}
  >
    <Spacer flexible />
    <Text variant="title" align="center">
      {option.label}
    </Text>
    <Text variant="body" tone="secondary" align="center">
      {option.description}
    </Text>
    <Spacer flexible />
  </Column>
);
