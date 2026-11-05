import type { Ref } from 'react';
import {
  ScrollView as NativeScrollView,
  type ScrollViewInstance,
  type ScrollViewProps,
} from 'react-native';

// Any drag of the app's scrolling content lets the keyboard go, whichever field holds it: the call's
// words beside Tasks let go of Tasks' keyboard too. Interactive dismissal would wait for the finger
// to reach the keyboard, which a drag beside it never does.
export function ScrollView(props: ScrollViewProps & { ref?: Ref<ScrollViewInstance> }) {
  return <NativeScrollView keyboardDismissMode="on-drag" {...props} />;
}
