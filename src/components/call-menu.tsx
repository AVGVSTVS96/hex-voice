import { Column, Host, Spacer } from '@expo/ui';
import { Button, Image, Label, Menu, ShareLink } from '@expo/ui/swift-ui';
import { contentShape, shapes } from '@expo/ui/swift-ui/modifiers';

import { circle, theme } from '@/theme';
import { metrics } from '@/ui/tokens';

type Props = { transcript?: string; title: string; onDelete?: () => void };

export function CallMenu({ transcript, title, onDelete }: Props) {
  return (
    <Host matchContents ignoreSafeArea="all" style={{ width: metrics.tool, height: metrics.tool }}>
      <Menu
        label={
          <Column
            alignment="center"
            spacing={0}
            style={{
              ...circle(metrics.tool),
              backgroundColor: theme.surface,
            }}
            modifiers={[contentShape(shapes.circle())]}
          >
            <Spacer flexible />
            <Image systemName="ellipsis" size={20} color={theme.text} />
            <Spacer flexible />
          </Column>
        }
      >
        {transcript !== undefined && (
          <ShareLink item={transcript} subject={title}>
            <Label title="Share transcript" systemImage="square.and.arrow.up" />
          </ShareLink>
        )}
        {onDelete && (
          <Button label="Delete call" systemImage="trash" role="destructive" onPress={onDelete} />
        )}
      </Menu>
    </Host>
  );
}
