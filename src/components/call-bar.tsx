import { NativeTabs } from 'expo-router/native-tabs';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VoiceControl } from '@/components/voice-control';
import { useLiveSession } from '@/hooks/use-live-session';
import { callLength } from '@/live/calls';
import { theme } from '@/theme';

// The call you're on, over the tabs while you chat or look at Activity: how it's going, mute and
// End, and a tap back to it. Folded into the tab bar, it keeps only what it says.
export function CallBar() {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  const router = useRouter();
  const session = useLiveSession();
  const connected = session.status === 'connected';
  const line =
    session.status === 'connecting'
      ? 'Connecting'
      : session.status === 'disconnecting'
        ? 'Ending'
        : session.muted
          ? `Muted · ${callLength(session.elapsedSeconds)}`
          : `On a call · ${callLength(session.elapsedSeconds)}`;
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Opens the call"
        onPress={() => router.navigate('/call')}
        style={styles.open}
      >
        <View style={[styles.dot, !connected && styles.waiting]} />
        <Text numberOfLines={1} style={styles.line}>
          {line}
        </Text>
      </Pressable>
      {placement === 'regular' && (
        <>
          <VoiceControl
            icon={session.muted ? 'mic-off' : 'mic'}
            label={session.muted ? 'Unmute microphone' : 'Mute microphone'}
            testID="bar-mute-button"
            size={34}
            disabled={!connected}
            selected={session.muted}
            onPress={session.toggleMute}
          />
          <VoiceControl
            icon="close"
            label="End conversation"
            testID="bar-end-button"
            size={34}
            onPress={() => void session.stop()}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.switchOn },
  waiting: { backgroundColor: theme.tertiary },
  line: {
    flex: 1,
    color: theme.text,
    fontSize: 15,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
