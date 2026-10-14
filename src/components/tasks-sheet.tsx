import { Host } from '@expo/ui';
import { BottomSheet, Group as SheetContent } from '@expo/ui/swift-ui';
import {
  presentationBackground,
  presentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
  type PresentationDetent,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { TasksView, type TasksProps } from '@/components/tasks/tasks-view';
import { theme } from '@/theme';

// Tasks on the phone and iPhone Duo. Before a call it opens full height; on a call it opens half
// height so the call goes on behind it. However it goes away, swiped down or tapped past, it tells
// the screen once it has.
export function TasksSheet({
  onDismiss,
  onCall,
  ...view
}: TasksProps & { onDismiss: () => void; onCall: boolean }) {
  const { width } = useWindowDimensions();
  const [detent, setDetent] = useState<PresentationDetent>(onCall ? 'medium' : 'large');
  useEffect(() => {
    if (view.open) setDetent(onCall ? 'medium' : 'large');
  }, [view.open, onCall]);

  return (
    <Host seedColor={theme.tint} style={{ position: 'absolute' }}>
      <BottomSheet
        isPresented={view.open}
        onIsPresentedChange={(presented) => {
          if (!presented) onDismiss();
        }}
        onDismiss={onDismiss}
        testID="tasks-sheet"
      >
        <SheetContent
          modifiers={[
            presentationDragIndicator('visible'),
            presentationDetents(onCall ? ['medium', 'large'] : ['large'], {
              selection: detent,
              onSelectionChange: setDetent,
            }),
            ...(onCall
              ? [presentationBackgroundInteraction({ type: 'enabledUpThrough', detent: 'medium' })]
              : []),
            presentationBackground(theme.sheet),
          ]}
        >
          <TasksView {...view} width={width} />
        </SheetContent>
      </BottomSheet>
    </Host>
  );
}
