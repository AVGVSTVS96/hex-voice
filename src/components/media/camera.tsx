import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useMicHeld } from '@/call/use-call';
import { Glyph } from '@/components/glyph';
import { CLIP_SECONDS, type Picked } from '@/live/media';
import { clock } from '@/live/calls';
import { circle, radius, theme } from '@/theme';
import { metrics, space, textOf } from '@/ui/tokens';

type Phase = { at: 'live' } | { at: 'recording'; since: number } | { at: 'review'; shot: Picked };

const { shutter, ring } = metrics.media;
// How long a press is a tap before it's a hold, as iOS Camera's QuickTake waits.
const HOLD_MS = 280;

// The live camera, to its edges: tap the shutter for a photo, hold it for a clip with a ring
// filling to a minute, flip to the other camera, then Retake or keep the shot. While a call here
// holds the microphone, a clip records without sound.
export function Camera({ keep, onShot }: { keep: string; onShot: (shot: Picked) => void }) {
  const camera = useRef<CameraView>(null);
  const [permission, ask] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [phase, setPhase] = useState<Phase>({ at: 'live' });
  const quiet = useMicHeld();
  const filled = useSharedValue(0);
  const recording = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void ask();
  }, [permission?.granted, permission?.canAskAgain]);

  const take = async () => {
    const photo = await camera.current?.takePictureAsync({ quality: 0.8 });
    if (photo)
      setPhase({ at: 'review', shot: { uri: photo.uri, kind: 'photo', type: 'image/jpeg' } });
  };
  const record = async () => {
    recording.current = true;
    setPhase({ at: 'recording', since: Date.now() });
    filled.set(withTiming(1, { duration: CLIP_SECONDS * 1000, easing: Easing.linear }));
    const clip = await camera.current
      ?.recordAsync({ maxDuration: CLIP_SECONDS })
      .catch(() => undefined);
    recording.current = false;
    cancelAnimation(filled);
    filled.set(0);
    setPhase(
      clip
        ? { at: 'review', shot: { uri: clip.uri, kind: 'video', type: 'video/quicktime' } }
        : { at: 'live' },
    );
  };

  if (!permission?.granted)
    return permission && !permission.canAskAgain ? (
      <View style={[styles.fill, styles.blocked]}>
        <Text style={styles.words}>Allow hex to use the camera in Settings.</Text>
        <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()}>
          <Text style={[styles.words, styles.strong]}>Open Settings</Text>
        </Pressable>
      </View>
    ) : (
      <View style={styles.fill} />
    );

  return (
    <View style={styles.fill}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode="video"
        videoQuality="720p"
        mute={quiet}
        active={phase.at !== 'review'}
      />
      {phase.at === 'review' && phase.shot.kind === 'photo' && (
        <Image
          source={{ uri: phase.shot.uri }}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      )}
      {phase.at === 'recording' && <Timer since={phase.since} />}
      <View style={styles.foot}>
        {phase.at === 'review' ? (
          <>
            <Pressable
              accessibilityRole="button"
              testID="camera-retake"
              onPress={() => setPhase({ at: 'live' })}
              style={styles.retake}
            >
              <Text style={[styles.words, styles.strong]}>Retake</Text>
            </Pressable>
            <Round
              symbol="arrow.up"
              label={keep}
              testID="camera-keep"
              bright
              onPress={() => onShot(phase.shot)}
            />
          </>
        ) : (
          <>
            <View style={styles.side} />
            <View style={styles.middle}>
              {phase.at === 'live' && <Text style={styles.hint}>Hold for video</Text>}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take photo"
                accessibilityHint="Hold to record a video"
                testID="camera-shutter"
                delayLongPress={HOLD_MS}
                onPress={() => void take()}
                onLongPress={() => void record()}
                onPressOut={() => {
                  if (recording.current) camera.current?.stopRecording();
                }}
              >
                <Shutter recording={phase.at === 'recording'} filled={filled} />
              </Pressable>
            </View>
            <View style={styles.side}>
              {phase.at === 'live' && (
                <Round
                  symbol="arrow.triangle.2.circlepath"
                  label="Flip camera"
                  testID="camera-flip"
                  onPress={() => setFacing((now) => (now === 'back' ? 'front' : 'back'))}
                />
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// iOS Camera's shutter: a white disc in a ring; holding it, a red square in the ring as it fills.
function Shutter({
  recording,
  filled,
}: {
  recording: boolean;
  filled: ReturnType<typeof useSharedValue<number>>;
}) {
  return (
    <View style={styles.shutter}>
      {recording ? <Fill filled={filled} /> : <View style={[styles.track, styles.bright]} />}
      <View style={recording ? styles.stop : styles.disc} />
    </View>
  );
}

// The ring filling clockwise from the top: each half of it is half the red ring, turned into the
// half of the shutter that shows it.
function Fill({ filled }: { filled: ReturnType<typeof useSharedValue<number>> }) {
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
}

function Timer({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);
  return (
    <View style={styles.timer}>
      <View style={styles.dot} />
      <Text style={[styles.words, styles.strong, styles.digits]}>{clock(now - since)}</Text>
    </View>
  );
}

function Round({
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
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={[styles.round, bright && styles.bright]}
    >
      <Glyph name={symbol} size={metrics.symbol.bar} color={bright ? theme.media : theme.onMedia} />
    </Pressable>
  );
}

const half = shutter / 2;

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.media },
  blocked: { alignItems: 'center', justifyContent: 'center', gap: space[3] },
  words: { ...textOf('callout'), color: theme.onMedia },
  strong: textOf('callout', 'semibold'),
  digits: { fontVariant: ['tabular-nums'] },
  hint: { ...textOf('footnote', 'medium'), color: theme.onMedia },
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: space[8],
    paddingHorizontal: space[6],
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  side: { width: metrics.tool, height: shutter, justifyContent: 'center' },
  middle: { alignItems: 'center', gap: space[3] },
  round: {
    ...circle(metrics.tool),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.overMedia,
  },
  bright: { backgroundColor: theme.onMedia },
  retake: {
    height: metrics.tool,
    justifyContent: 'center',
    paddingHorizontal: space[5],
    borderRadius: metrics.tool / 2,
    backgroundColor: theme.overMedia,
  },
  shutter: { width: shutter, height: shutter, alignItems: 'center', justifyContent: 'center' },
  track: {
    ...StyleSheet.absoluteFill,
    borderRadius: half,
    borderWidth: ring,
    borderColor: theme.overMedia,
  },
  red: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: shutter,
    height: shutter,
    borderRadius: half,
    borderWidth: ring,
    borderColor: theme.recording,
  },
  disc: { ...circle(shutter - 4 * ring), backgroundColor: theme.onMedia },
  stop: {
    width: shutter / 2.5,
    height: shutter / 2.5,
    borderRadius: radius.inner / 2,
    backgroundColor: theme.recording,
  },
  half: { position: 'absolute', top: 0, width: half, height: shutter, overflow: 'hidden' },
  left: { left: 0 },
  right: { left: half },
  turning: { position: 'absolute', top: 0, left: 0, width: shutter, height: shutter },
  fromRight: { left: -half },
  timer: {
    position: 'absolute',
    top: space[6],
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    paddingHorizontal: space[3],
    height: space[8],
    borderRadius: space[4],
    backgroundColor: theme.overMedia,
  },
  dot: { ...circle(space[2]), backgroundColor: theme.recording },
});
