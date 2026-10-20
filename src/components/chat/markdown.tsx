import { Fragment, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { blocksOf, type Block } from '@/live/markdown';
import { theme } from '@/theme';

// The markdown hex writes in chat: paragraphs, headings, lists, quotes and fenced code, with bold,
// italics, inline code and links inside them. Anything else shows as the words it is.
export function Markdown({
  text,
  color = theme.text,
}: {
  text: string;
  color?: typeof theme.text;
}) {
  return (
    <View style={styles.blocks}>
      {blocksOf(text).map((block, i) => (
        <Fragment key={i}>{render(block, color)}</Fragment>
      ))}
    </View>
  );
}

function render(block: Block, color: typeof theme.text) {
  switch (block.kind) {
    case 'code':
      return (
        <View style={styles.code}>
          <Text selectable style={styles.codeText}>
            {block.text}
          </Text>
        </View>
      );
    case 'heading':
      return <Text style={[styles.body, styles.heading, { color }]}>{inline(block.text)}</Text>;
    case 'quote':
      return (
        <View style={styles.quote}>
          <Text style={[styles.body, { color: theme.secondary }]}>{inline(block.text)}</Text>
        </View>
      );
    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.item}>
              <Text style={[styles.body, styles.mark]}>{item.mark}</Text>
              <Text selectable style={[styles.body, styles.itemText, { color }]}>
                {inline(item.text)}
              </Text>
            </View>
          ))}
        </View>
      );
    case 'text':
      return (
        <Text selectable style={[styles.body, { color }]}>
          {inline(block.text)}
        </Text>
      );
  }
}

const SPAN =
  /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s)>\]]+)/g;

function inline(text: string): ReactNode[] {
  return text.split(SPAN).map((part, i) => {
    if (i % 2 === 0) return part;
    if (part.startsWith('`'))
      return (
        <Text key={i} style={styles.inlineCode}>
          {part.slice(1, -1)}
        </Text>
      );
    if (part.startsWith('**') || part.startsWith('__'))
      return (
        <Text key={i} style={styles.bold}>
          {inline(part.slice(2, -2))}
        </Text>
      );
    if (part.startsWith('*') || part.startsWith('_'))
      return (
        <Text key={i} style={styles.italic}>
          {inline(part.slice(1, -1))}
        </Text>
      );
    const [, label, url] = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/) ?? [, part, part];
    return (
      <Text key={i} style={styles.link} onPress={() => void Linking.openURL(url!)}>
        {label}
      </Text>
    );
  });
}

const styles = StyleSheet.create({
  blocks: { gap: 10 },
  body: { fontSize: 17, lineHeight: 24 },
  heading: { fontWeight: '600' },
  bold: { fontWeight: '600' },
  italic: { fontStyle: 'italic' },
  link: { color: theme.accent, textDecorationLine: 'underline' },
  inlineCode: {
    fontFamily: 'Menlo',
    fontSize: 15,
    color: theme.text,
    backgroundColor: theme.surface,
  },
  code: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  codeText: { fontFamily: 'Menlo', fontSize: 13, lineHeight: 18, color: theme.text },
  quote: { borderLeftWidth: 3, borderLeftColor: theme.edge, paddingLeft: 12 },
  list: { gap: 6 },
  item: { flexDirection: 'row', gap: 8 },
  mark: { color: theme.secondary, minWidth: 14 },
  itemText: { flex: 1 },
});
