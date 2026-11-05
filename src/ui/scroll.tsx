import type { Ref } from 'react';
import {
  ScrollView as NativeScrollView,
  type ScrollViewInstance,
  type ScrollViewProps,
} from 'react-native';

// A drag down any of the app's scrolling content pulls the keyboard down with it, as iOS apps do,
// whichever field holds it: the call's words beside Tasks let go of Tasks' keyboard too.
export function ScrollView(props: ScrollViewProps & { ref?: Ref<ScrollViewInstance> }) {
  return <NativeScrollView keyboardDismissMode="interactive" {...props} />;
}
