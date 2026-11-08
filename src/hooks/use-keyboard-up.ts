import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import type { KeyboardEvent } from 'react-native';

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
