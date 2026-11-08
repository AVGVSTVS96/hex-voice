import { BottomSheet, Button, Group, Menu, RNHostView } from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  accessibilityLabel,
  disabled,
  frame,
  ignoreSafeArea,
  preferredColorScheme,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { Camera } from '@/components/media/camera';
import { CLIP_SECONDS, type Picked } from '@/live/media';
import { bevel } from '@/theme';
import { glass as onGlass } from '@/ui/glass-button';
import { film } from '@/ui/tokens';

// The + (`children`, on glass if `glass`) and what it opens, as ChatGPT's plus does: the system
// menu with Camera, which rises as a sheet to half the screen, and Photos, Apple's own picker, up
// to `most` at once (none: the + is off). What you shoot or pick goes to `onAdd`; `sends` says it
// goes out from there, so the camera's last button says Send rather than Add.
export function AddMedia({
  label,
  glass = false,
  most,
  sends,
  testID,
  onAdd,
  children,
}: {
  label: string;
  glass?: boolean;
  most: number;
  sends: boolean;
  testID: string;
  onAdd: (media: Picked[]) => void;
  children: ReactNode;
}) {
  const [camera, setCamera] = useState(false);
  const pick = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: most > 1,
      selectionLimit: most,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      // A clip the size the camera records, so a minute of 4K doesn't go up whole.
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
    });
    if (picked.canceled) return;
    if (picked.assets.some(({ duration }) => (duration ?? 0) > CLIP_SECONDS * 1000))
      return Alert.alert('Videos up to a minute', 'Pick a shorter video, or trim it in Photos.');
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
        <Menu
          label={children}
          modifiers={[
            accessibilityLabel(label),
            accessibilityIdentifier(testID),
            disabled(most < 1),
            ...(glass ? [onGlass('circle')] : []),
          ]}
        >
          <Button label="Camera" systemImage="camera" onPress={() => setCamera(true)} />
          <Button label="Photos" systemImage="photo.on.rectangle" onPress={() => void pick()} />
        </Menu>
      }
    >
      <Group
        modifiers={[
          presentationDetents(['medium', 'large']),
          presentationDragIndicator('visible'),
          presentationBackground(film.black),
          preferredColorScheme('dark'),
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          ignoreSafeArea(),
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
