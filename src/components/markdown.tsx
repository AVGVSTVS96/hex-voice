import { Column, Text } from '@expo/ui';
import type { ModifierConfig } from '@expo/ui/swift-ui/modifiers';

import { Failure } from '@/components/tasks/parts';
import { openURL, useFailures } from '@/hooks/use-failures';
import { theme } from '@/theme';
import { radius, space, type } from '@/ui/tokens';
import type { TextStyle, TextVariant } from '@/ui/tokens';
import { MarkdownView } from '../../modules/markdown';

// Markdown in the app's own look, in one of its text styles: words in the text tone or the secondary one, code on the
// surface with the inner corner, quotes with the edge's bar, links in the accent. `inline` is one
// run of words, folded to `lines` when given; otherwise it lays out blocks. A link iOS can't open
// says so beneath.
export const Markdown = ({
  children,
  tone = 'text',
  variant = 'body',
  inline,
  lines,
  selectable,
  modifiers,
}: {
  children: string;
  tone?: 'text' | 'secondary';
  variant?: TextVariant;
  inline?: boolean;
  lines?: number;
  selectable?: boolean;
  modifiers?: ModifierConfig[];
}) => {
  const tries = useFailures();
  if (process.env.EXPO_OS !== 'ios') {
    return <Text>{children}</Text>;
  }
  const failed = Object.values(tries.failed)[0];
  const look: TextStyle = type[variant];
  return (
    <Column alignment="start" spacing={space[1]} modifiers={modifiers}>
      <MarkdownView
        markdown={children}
        inline={inline}
        lines={lines}
        selectable={selectable}
        size={look.fontSize}
        leading={look.lineSpacing ?? 0}
        gap={space[3]}
        radius={radius.inner}
        color={theme[tone]}
        secondary={theme.secondary}
        edge={theme.edge}
        surface={theme.surface}
        accent={theme.accent}
        onLink={(url) => {
          void tries.attempt(url, 'Not opened', async () => openURL(url));
        }}
      />
      {failed ? <Failure text={failed} /> : null}
    </Column>
  );
};
