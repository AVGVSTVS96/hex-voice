import { CameraView, useCameraPermissions } from "expo-camera";
import type { CameraType } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { SFSymbol } from "sf-symbols-typescript";

import { useMicHeld } from "@/call/use-call";
import { Glyph } from "@/components/glyph";
import { clock } from "@/live/calls";
import { CLIP_SECONDS } from "@/live/media";
import type { Picked } from "@/live/media";
import { circle } from "@/theme";
import { film, metrics, radius, space, textOf } from "@/ui/tokens";

type Phase = { at: "live" } | { at: "recording"; since: number } | { at: "review"; shot: Picked };

const { shutter, ring } = metrics.media;

const QUICKTAKE_HOLD_MS = 280;

export const Camera = ({ keep, onShot }: { keep: string; onShot: (shot: Picked) => void }) => {
  const camera = useRef<CameraView>(null);
  const [permission, ask] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [phase, setPhase] = useState<Phase>({ at: "live" });
  const quiet = useMicHeld();
  const filled = useSharedValue(0);
  const held = useRef(false);
  const recording = phase.at === "recording";

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void ask();
    }
  }, [permission?.granted, permission?.canAskAgain]);

  const take = async () => {
    const photo = await camera.current?.takePictureAsync({ quality: 0.8 });

    if (photo) {
      setPhase({ at: "review", shot: { uri: photo.uri, kind: "photo", type: "image/jpeg" } });
    }
  };

  const record = async () => {
    held.current = true;
    setPhase({ at: "recording", since: Date.now() });
    filled.set(withTiming(1, { duration: CLIP_SECONDS * 1000, easing: Easing.linear }));

    const clip = await camera.current
      ?.recordAsync({ maxDuration: CLIP_SECONDS, progressUpdateInterval: 0.1 })
      .catch(() => null);

    held.current = false;
    cancelAnimation(filled);
    filled.set(0);
    setPhase(
      clip
        ? { at: "review", shot: { uri: clip.uri, kind: "video", type: "video/quicktime" } }
        : { at: "live" },
    );
  };

  const lift = () => {
    if (!held.current) {
      return;
    }

    held.current = false;
    camera.current?.stopRecording();
  };

  if (permission?.granted !== true) {
    return permission && !permission.canAskAgain ? (
      <View style={[styles.fill, styles.blocked]}>
        <Text style={styles.words}>Allow hex to use the camera in Settings.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Linking.openSettings();
          }}
        >
          <Text style={[styles.words, styles.strong]}>Open Settings</Text>
        </Pressable>
      </View>
    ) : (
      <View style={styles.fill} />
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
        videoQuality="720p"
        mute={quiet}
        active={phase.at !== "review"}
        onRecordingProgress={() => {
          if (!held.current) {
            camera.current?.stopRecording();
          }
        }}
      />
      {phase.at === "review" && phase.shot.kind === "photo" && (
        <Image
          source={{ uri: phase.shot.uri }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      )}
      {phase.at === "recording" && <Timer since={phase.since} />}
      <View style={styles.foot}>
        {phase.at === "review" ? (
          <>
            <Pressable
              accessibilityRole="button"
              testID="camera-retake"
              onPress={() => {
                setPhase({ at: "live" });
              }}
              style={styles.retake}
            >
              <Text style={[styles.words, styles.strong]}>Retake</Text>
            </Pressable>
            <Round
              symbol="arrow.up"
              label={keep}
              testID="camera-keep"
              bright
              onPress={() => {
                onShot(phase.shot);
              }}
            />
          </>
        ) : (
          <>
            <View style={styles.side} />
            <View style={styles.middle}>
              {phase.at === "live" && <Text style={styles.hint}>Hold for video</Text>}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                accessibilityHint="Hold to record a video"
                testID="camera-shutter"
                delayLongPress={QUICKTAKE_HOLD_MS}
                onPress={() => {
                  void take();
                }}
                onLongPress={() => {
                  void record();
                }}
                onPressOut={lift}
              >
                <Shutter recording={recording} filled={filled} />
              </Pressable>
            </View>
            <View style={styles.side}>
              {phase.at === "live" && (
                <Round
                  symbol="arrow.triangle.2.circlepath"
                  label="Flip camera"
                  testID="camera-flip"
                  onPress={() => {
                    setFacing((now) => (now === "back" ? "front" : "back"));
                  }}
                />
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const Shutter = ({
  recording,
  filled,
}: {
  recording: boolean;
  filled: ReturnType<typeof useSharedValue<number>>;
}) => (
  <View style={styles.shutter}>
    {recording ? <Fill filled={filled} /> : <View style={[styles.track, styles.bright]} />}
    <View style={recording ? styles.stop : styles.disc} />
  </View>
);

const Fill = ({ filled }: { filled: ReturnType<typeof useSharedValue<number>> }) => {
  const first = useAnimatedStyle(() => ({
    transform: [{ rotate: `${Math.min(filled.get(), 0.5) * 360}deg` }],
  }));

  const second = useAnimatedStyle(() => ({
    transform: [{ rotate: `${Math.max(filled.get() - 0.5, 0) * 360}deg` }],
  }));

  return (
    <>
      <View style={styles.track} />
      <View style={[styles.half, styles.right]}>
        <Animated.View style={[styles.turning, styles.fromRight, first]}>
          <View style={[styles.half, styles.left]}>
            <View style={styles.red} />
          </View>
        </Animated.View>
      </View>
      <View style={[styles.half, styles.left]}>
        <Animated.View style={[styles.turning, second]}>
          <View style={[styles.half, styles.right]}>
            <View style={[styles.red, styles.fromRight]} />
          </View>
        </Animated.View>
      </View>
    </>
  );
};

const Timer = ({ since }: { since: number }) => {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const tick = setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => {
      clearInterval(tick);
    };
  }, []);

  return (
    <View style={styles.timer}>
      <View style={styles.dot} />
      <Text style={[styles.words, styles.strong, styles.digits]}>{clock(now - since)}</Text>
    </View>
  );
};

const Round = ({
  symbol,
  label,
  testID,
  bright = false,
  onPress,
}: {
  symbol: SFSymbol;
  label: string;
  testID: string;
  bright?: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    testID={testID}
    onPress={onPress}
    style={[styles.round, bright && styles.bright]}
  >
    <Glyph name={symbol} size={metrics.symbol.bar} color={bright ? film.black : film.ink} />
  </Pressable>
);

const half = shutter / 2;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: film.black },
  blocked: { alignItems: "center", justifyContent: "center", gap: space[3] },
  words: { ...textOf("body"), color: film.ink },
  strong: textOf("body", "medium"),
  digits: { fontVariant: ["tabular-nums"] },
  hint: { ...textOf("caption", "medium"), color: film.ink },
  foot: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: space[12],
    paddingHorizontal: space[6],
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  side: { width: metrics.tool, height: shutter, justifyContent: "center" },
  middle: { alignItems: "center", gap: space[3] },
  round: {
    ...circle(metrics.tool),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: film.glass,
  },
  bright: { backgroundColor: film.ink },
  retake: {
    height: metrics.tool,
    justifyContent: "center",
    paddingHorizontal: space[5],
    borderRadius: metrics.tool / 2,
    backgroundColor: film.glass,
  },
  shutter: { width: shutter, height: shutter, alignItems: "center", justifyContent: "center" },
  track: {
    ...StyleSheet.absoluteFill,
    borderRadius: half,
    borderWidth: ring,
    borderColor: film.glass,
  },
  red: {
    position: "absolute",
    top: 0,
    left: 0,
    width: shutter,
    height: shutter,
    borderRadius: half,
    borderWidth: ring,
    borderColor: film.recording,
  },
  disc: { ...circle(shutter - 4 * ring), backgroundColor: film.ink },
  stop: {
    width: shutter / 2.5,
    height: shutter / 2.5,
    borderRadius: radius.inner / 2,
    backgroundColor: film.recording,
  },
  half: { position: "absolute", top: 0, width: half, height: shutter, overflow: "hidden" },
  left: { left: 0 },
  right: { left: half },
  turning: { position: "absolute", top: 0, left: 0, width: shutter, height: shutter },
  fromRight: { left: -half },
  timer: {
    position: "absolute",
    top: space[6],
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    paddingHorizontal: space[3],
    height: space[8],
    borderRadius: space[4],
    backgroundColor: film.glass,
  },
  dot: { ...circle(space[2]), backgroundColor: film.recording },
});
