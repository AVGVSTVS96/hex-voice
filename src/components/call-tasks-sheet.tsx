import { BottomSheet, Group as SheetContent } from "@expo/ui/swift-ui";
import {
  presentationBackground,
  presentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
} from "@expo/ui/swift-ui/modifiers";
import { Linking } from "react-native";

import { StepsLoading, Trace } from "@/components/tasks/trace";
import { useCallTasks } from "@/hooks/use-call-tasks";
import type { CallId } from "@/live/calls";
import { theme } from "@/theme";
import { Host } from "@/ui/host";

export interface CallTasksAt {
  call: CallId;
  task: string;
}

export const CallTasksSheet = ({
  at,
  onCall,
  onDismiss,
}: {
  at: CallTasksAt | null;
  onCall: boolean;
  onDismiss: () => void;
}) => {
  const { task, ...answered } = useCallTasks(at?.call);

  return (
    <Host seedColor={theme.tint} avoids="system" style={{ position: "absolute" }}>
      <BottomSheet
        isPresented={at !== null}
        onIsPresentedChange={(presented) => {
          if (!presented) {
            onDismiss();
          }
        }}
        onDismiss={onDismiss}
        testID="call-tasks-sheet"
      >
        <SheetContent
          modifiers={[
            presentationDragIndicator("visible"),
            presentationDetents(onCall ? ["medium", "large"] : ["large"]),
            ...(onCall
              ? [presentationBackgroundInteraction({ type: "enabledUpThrough", detent: "medium" })]
              : []),
            presentationBackground(theme.sheet),
          ]}
        >
          {task && at ? (
            <Trace
              key={`${at.call} ${at.task}`}
              task={task}
              focus={at.task}
              onOpen={(link) => {
                void Linking.openURL(link).catch(() => null);
              }}
            />
          ) : (
            <StepsLoading {...answered} />
          )}
        </SheetContent>
      </BottomSheet>
    </Host>
  );
};
