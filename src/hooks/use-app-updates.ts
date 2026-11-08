import * as Updates from 'expo-updates';
import { useEffect, useEffectEvent } from 'react';
import { AppState } from 'react-native';

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
      const fromBackground = last === 'background' && state === 'active';
      last = state;

      if (state !== 'active') {
        return;
      }

      if (fromBackground) {
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
