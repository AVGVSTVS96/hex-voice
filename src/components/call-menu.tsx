import { Button, Label, ShareLink } from "@expo/ui/swift-ui";

import { GlassMenu } from "@/ui/glass-button";
import { Host } from "@/ui/host";
import { metrics } from "@/ui/tokens";

interface Props {
  transcript?: string;
  title: string;
  onDelete?: () => void;
}

export const CallMenu = ({ transcript, title, onDelete }: Props) => (
  <Host matchContents style={{ width: metrics.tool, height: metrics.tool }}>
    <GlassMenu icon="more" label="Call actions">
      {transcript !== undefined && (
        <ShareLink item={transcript} subject={title}>
          <Label title="Share transcript" systemImage="square.and.arrow.up" />
        </ShareLink>
      )}
      {onDelete && (
        <Button label="Delete call" systemImage="trash" role="destructive" onPress={onDelete} />
      )}
    </GlassMenu>
  </Host>
);
