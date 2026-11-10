import { BottomSheet, Button, Group, Menu, RNHostView } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  disabled,
  frame,
  ignoreSafeArea,
  preferredColorScheme,
  presentationBackground,
  presentationDetents,
  presentationDragIndicator,
  strokeBorder,
} from "@expo/ui/swift-ui/modifiers";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import type { ReactNode } from "react";
import { Alert } from "react-native";

import { Camera } from "@/components/media/camera";
import { CLIP_SECONDS } from "@/live/media";
import type { Picked } from "@/live/media";
import { bevel } from "@/theme";
import { glass as onGlass } from "@/ui/glass-button";
import { film } from "@/ui/tokens";

export const AddMedia = ({
  label,
  glass = false,
  most,
  sends,
  testID,
  onChoose,
  onAdd,
  children,
}: {
  label: string;
  glass?: boolean;
  most: number;
  sends: boolean;
  testID: string;
  onChoose?: () => void;
  onAdd: (media: Picked[]) => void;
  children: ReactNode;
}) => {
  const [camera, setCamera] = useState(false);

  const pick = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: most > 1,
      selectionLimit: most,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      // oxlint-disable-next-line typescript/no-deprecated -- Apple deprecated the picker's export preset with no replacement; it keeps a picked clip the size the camera records, not a minute of 4K (https://developer.apple.com/documentation/uikit/uiimagepickercontroller/2890964-videoexportpreset)
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
    });

    if (picked.canceled) {
      return;
    }

    if (picked.assets.some(({ duration }) => (duration ?? 0) > CLIP_SECONDS * 1000)) {
      Alert.alert("Videos up to a minute", "Pick a shorter video, or trim it in Photos.");

      return;
    }

    onAdd(
      picked.assets.map(({ uri, type, mimeType }) =>
        type === "video"
          ? { uri, kind: "video", type: mimeType ?? "video/mp4" }
          : { uri, kind: "photo", type: mimeType ?? "image/jpeg" },
      ),
    );
  };

  return (
    <BottomSheet
      isPresented={camera}
      onIsPresentedChange={setCamera}
      testID={testID}
      anchor={
        <Menu
          label={children}
          modifiers={[
            accessibilityLabel(label),
            disabled(most < 1),
            ...(glass ? [onGlass("circle")] : []),
          ]}
        >
          <Button
            label="Camera"
            systemImage="camera"
            onPress={() => {
              onChoose?.();
              setCamera(true);
            }}
          />
          <Button
            label="Photos"
            systemImage="photo.on.rectangle"
            onPress={() => {
              onChoose?.();
              void pick();
            }}
          />
        </Menu>
      }
    >
      <Group
        modifiers={[
          presentationDetents(["medium", "large"]),
          presentationDragIndicator("visible"),
          presentationBackground(film.black),
          preferredColorScheme("dark"),
          frame({ maxWidth: Infinity, maxHeight: Infinity }),
          ignoreSafeArea(),
          strokeBorder({
            content: bevel.gradient,
            style: { lineWidth: bevel.width },
            shape: "containerRelativeShape",
          }),
        ]}
      >
        <RNHostView>
          <Camera
            keep={sends ? "Send" : "Add"}
            onShot={(shot) => {
              setCamera(false);
              onAdd([shot]);
            }}
          />
        </RNHostView>
      </Group>
    </BottomSheet>
  );
};
