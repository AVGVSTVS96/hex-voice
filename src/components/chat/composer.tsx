import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { theme } from '@/theme';

// Where you write to the thread. Send turns into Stop while hex works and you've nothing typed. A
// T3 Code thread only takes what's typed in T3 Code, so there it says so and opens it instead.
export function Composer({
  title,
  sends,
  working,
  link,
  onSend,
  onStop,
}: {
  title: string;
  sends: boolean;
  working: boolean;
  link?: string;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState('');
  if (!sends)
    return (
      <View style={styles.elsewhere}>
        <Text style={styles.note}>Write to this thread in its own app.</Text>
        {link && (
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(link)}
            hitSlop={10}
          >
            <Text style={styles.open}>Open</Text>
          </Pressable>
        )}
      </View>
    );
  const words = text.trim();
  const stops = working && !words;
  return (
    <View style={styles.composer}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={`Message ${title}`}
        placeholderTextColor={theme.tertiary}
        multiline
        style={styles.input}
        testID="chat-input"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={stops ? 'Stop' : 'Send'}
        disabled={!stops && !words}
        testID="chat-send"
        onPress={() => {
          if (stops) return onStop();
          onSend(words);
          setText('');
        }}
        style={[styles.send, !stops && !words && styles.idle]}
      >
        <View pointerEvents="none">
          <Glyph
            name={stops ? 'stop.fill' : 'arrow.up'}
            size={stops ? 13 : 16}
            color={theme.onProminent}
          />
        </View>
      </Pressable>
    </View>
  );
}

const SEND = 34;

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: theme.surface,
  },
  input: {
    flex: 1,
    color: theme.text,
    fontSize: 17,
    lineHeight: 22,
    maxHeight: 140,
    paddingTop: 6,
    paddingBottom: 6,
  },
  send: {
    width: SEND,
    height: SEND,
    borderRadius: SEND / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.prominent,
  },
  idle: { opacity: 0.3 },
  elsewhere: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: theme.surface,
  },
  note: { color: theme.secondary, fontSize: 15 },
  open: { color: theme.text, fontSize: 15, fontWeight: '600' },
});
