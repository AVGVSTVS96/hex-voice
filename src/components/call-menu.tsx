import { Column, Host, Spacer } from '@expo/ui';
import { Button, Image, Label, Menu, ShareLink } from '@expo/ui/swift-ui';
import { contentShape, shapes } from '@expo/ui/swift-ui/modifiers';

import { theme } from '@/theme';

type Props = { transcript?: string; title: string; onDelete?: () => void; size?: number };

export function CallMenu({ transcript, title, onDelete, size = 48 }: Props) {
  return (
    <Host colorScheme="dark" matchContents style={{ width: size, height: size }}>
      <Menu
        label={
          <Column
            alignment="center"
            spacing={0}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
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
