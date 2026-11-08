import * as Updates from 'expo-updates';
import { useEffect, useEffectEvent } from 'react';
import { AppState } from 'react-native';

// New JS arrives over the air (scripts/ship-js). The app looks for it each time it comes to the
// front and downloads it in the background. It restarts into it only as you come back to the app
// from elsewhere with no call live, never while you're in it, so a restart can't take the page
// you're on from under you. Coming back from Control Center or a banner isn't coming back.
export const useAppUpdates = (callLive: boolean) => {
  const { isUpdatePending } = Updates.useUpdates();

  const apply = useEffectEvent(() => {
    if (isUpdatePending && !callLive) {
      void Updates.reloadAsync();
    }
  });

  useEffect(() => {
    if (!Updates.isEnabled) {
      return;
    }

    let last = AppState.currentState;

    const listener = AppState.addEventListener('change', (state) => {
      const back = last === 'background' && state === 'active';
      last = state;

      if (state !== 'active') {
        return;
      }

      if (back) {
        apply();
      }

      void download();
    });

    return () => {
      listener.remove();
    };
  }, []);
};

const download = async () => {
  const update = await Updates.checkForUpdateAsync().catch(() => null);

  if (update?.isAvailable === true) {
    await Updates.fetchUpdateAsync().catch(() => null);
  }
};
