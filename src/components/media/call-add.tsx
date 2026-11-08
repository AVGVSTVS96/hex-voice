import { buttonsOf } from "@/call/call";
import type { Call } from "@/call/call";
import { useShare } from "@/call/use-call";
import { AddMedia } from "@/components/media/add-media";
import { MOST } from "@/live/media";
import { GlassFace } from "@/ui/glass-button";
import { Host } from "@/ui/host";
import { metrics } from "@/ui/tokens";

export const CallAdd = ({ call }: { call: Call }) => {
  const share = useShare(call);

  return (
    <Host matchContents style={{ width: metrics.docked, height: metrics.docked }}>
      <AddMedia
        testID="call-add"
        label="Send a photo or video"
        glass
        most={buttonsOf(call).add ? MOST : 0}
        sends
        onAdd={share}
      >
        <GlassFace icon="add" size="docked" />
      </AddMedia>
    </Host>
  );
};
