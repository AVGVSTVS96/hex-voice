import {
  BottomSheet,
  Button,
  Column,
  Host,
  RNHostView,
  Row,
  Spacer,
  Text as NativeText,
} from '@expo/ui';
import { useRef } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';

import type { TranscriptEntry } from '@/live/types';
import { theme } from '@/theme';

export function TranscriptSheet({
  isPresented,
  onDismiss,
  entries,
}: {
  isPresented: boolean;
  onDismiss: () => void;
  entries: TranscriptEntry[];
}) {
  const { width, height } = useWindowDimensions();
  const visibleEntries = entries.filter((entry) => entry.text.trim());
  const scroll = useRef<ScrollView>(null);
  const following = useRef(true);
  return (
    <Host colorScheme="dark" seedColor="#FFFFFF" style={{ position: 'absolute' }}>
      <BottomSheet
        isPresented={isPresented}
        onDismiss={onDismiss}
        containerColor="#1C1C1E"
        contentPadding={{ top: 24, left: 24, right: 24, bottom: 24 }}
        testID="transcript-sheet"
      >
        <Column spacing={20} style={{ width: width - 48 }}>
          <Row alignment="center">
            <NativeText textStyle={{ color: '#FFFFFF', fontSize: 22, fontWeight: '600' }}>
              Transcript
            </NativeText>
            <Spacer flexible />
            <Button
              variant="text"
              onPress={onDismiss}
              testID="transcript-done"
              style={{ height: 44, paddingHorizontal: 8 }}
            >
              <NativeText textStyle={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>
                Done
              </NativeText>
            </Button>
          </Row>
          <RNHostView matchContents>
            <ScrollView
              ref={scroll}
              scrollEventThrottle={32}
              onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
                following.current =
                  contentOffset.y + layoutMeasurement.height >= contentSize.height - 40;
              }}
              onContentSizeChange={() => {
                if (following.current) scroll.current?.scrollToEnd({ animated: true });
              }}
              style={{ width: width - 48, height: Math.min(height * 0.5, 450) }}
              contentContainerStyle={{ paddingBottom: 24, gap: 24 }}
            >
              {visibleEntries.length ? (
                visibleEntries.map((entry) => (
                  <View
                    key={entry.id}
                    style={{
                      alignSelf: entry.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '92%',
                      backgroundColor: entry.role === 'user' ? '#303032' : 'transparent',
                      borderRadius: 20,
                      padding: entry.role === 'user' ? 14 : 0,
                    }}
                  >
                    <Text
                      accessibilityLabel={`${entry.role === 'user' ? 'You' : 'Assistant'}: ${entry.text}`}
                      selectable
                      style={{ color: theme.text, fontSize: 17, lineHeight: 25 }}
                    >
                      {entry.text.trim()}
                    </Text>
                  </View>
                ))
              ) : (
                <Text
                  style={{
                    color: theme.secondary,
                    fontSize: 16,
                    lineHeight: 24,
                    textAlign: 'center',
                    paddingTop: 30,
                  }}
                >
                  Your conversation will appear here.
                </Text>
              )}
            </ScrollView>
          </RNHostView>
        </Column>
      </BottomSheet>
    </Host>
  );
}
