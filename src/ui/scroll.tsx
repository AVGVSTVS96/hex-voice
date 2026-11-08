import type { Ref } from 'react';
import { ScrollView as NativeScrollView } from 'react-native';
import type { ScrollViewInstance, ScrollViewProps } from 'react-native';

export const ScrollView = (props: ScrollViewProps & { ref?: Ref<ScrollViewInstance> }) => (
  <NativeScrollView keyboardDismissMode="on-drag" {...props} />
);
