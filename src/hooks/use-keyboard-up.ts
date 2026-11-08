import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import type { KeyboardEvent } from 'react-native';

// Whether this app's keyboard is up. iOS tells every app in Split View about the other's keyboard
// too, which sits over that app, not this one.
export const useKeyboardUp = () => {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardWillShow', (event) => {
      if (ours(event)) {
        setUp(true);
      }
    });

    const hidden = Keyboard.addListener('keyboardWillHide', (event) => {
      if (ours(event)) {
        setUp(false);
      }
    });

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return up;
};

const ours = (event: KeyboardEvent) => !('isEventFromThisApp' in event) || event.isEventFromThisApp;
