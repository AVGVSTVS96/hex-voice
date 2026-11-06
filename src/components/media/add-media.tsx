import { BottomSheet, Button, Group, Menu, RNHostView } from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  frame,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactElement } from 'react';

import { Camera } from '@/components/media/camera';
import type { Picked } from '@/live/media';
import { bevel, theme } from '@/theme';

// The + and what it opens, as ChatGPT's plus does: the system menu with Camera, which rises as a
// sheet to half the screen, and Photos, Apple's own picker. What you shoot or pick goes to `onAdd`;
// `sends` says it goes out from there, so the camera's last button says Send rather than Add.
export function AddMedia({
  label,
  most,
  sends,
  testID,
  onAdd,
}: {
  label: ReactElement;
  most: number;
  sends: boolean;
  testID: string;
  onAdd: (media: Picked[]) => void;
}) {
  const [camera, setCamera] = useState(false);
  const pick = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: most > 1,
      selectionLimit: most,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (picked.canceled) return;
    onAdd(
      picked.assets.map(({ uri, type, mimeType }) =>
        type === 'video'
          ? { uri, kind: 'video', type: mimeType ?? 'video/mp4' }
          : { uri, kind: 'photo', type: mimeType ?? 'image/jpeg' },
      ),
    );
  };
  return (
    <BottomSheet
      isPresented={camera}
      onIsPresentedChange={setCamera}
      testID={`${testID}-camera`}
      anchor={
        <Menu label={label} modifiers={[accessibilityIdentifier(testID)]}>
          <Button label="Camera" systemImage="camera" onPress={() => setCamera(true)} />
          <Button label="Photos" systemImage="photo.on.rectangle" onPress={() => void pick()} />
        </Menu>
      }
    >
      <Group
        modifiers={[
          presentationDetents(['medium', 'large']),
          presentationDragIndicator('visible'),
          presentationBackground(theme.media),
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          strokeBorder({
            content: bevel.gradient,
            style: { lineWidth: bevel.width },
            shape: 'containerRelativeShape',
          }),
        ]}
      >
        <RNHostView>
          <Camera
            keep={sends ? 'Send' : 'Add'}
            onShot={(shot) => {
              setCamera(false);
              onAdd([shot]);
            }}
          />
        </RNHostView>
      </Group>
    </BottomSheet>
  );
}
