import * as Updates from 'expo-updates';
import { useEffect, useEffectEvent } from 'react';
import { AppState } from 'react-native';

// New JS arrives over the air (scripts/ship-js). The app looks for it each time it comes to the
// front and downloads it in the background, then restarts into it only while no call is live:
// right away if the app is in front with no call, otherwise the next time it comes to the front.
export function useAppUpdates(callLive: boolean) {
  const { isUpdatePending } = Updates.useUpdates();

  const apply = useEffectEvent(() => {
    if (isUpdatePending && !callLive && AppState.currentState === 'active') {
      void Updates.reloadAsync();
    }
  });

  useEffect(() => {
    if (isUpdatePending) apply();
  }, [isUpdatePending]);

  useEffect(() => {
    if (!Updates.isEnabled) return;
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      apply();
      void download();
    });
    return () => listener.remove();
  }, []);
}

async function download() {
  try {
    if ((await Updates.checkForUpdateAsync()).isAvailable) await Updates.fetchUpdateAsync();
  } catch {}
}
