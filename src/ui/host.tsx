import { Host as SwiftUIHost } from '@expo/ui/swift-ui';
import type { HostProps } from '@expo/ui/swift-ui';

// Where a SwiftUI view sits is React Native's to decide, so by default a Host keeps clear of
// nothing iOS reserves. One the keyboard covered would otherwise shorten what it holds by the
// keyboard and center it, half off its top: the call's buttons, marks and icons jumping up as you
// type in Tasks. A Host that holds a field keeps above the `keyboard`, so the field and its send
// button stay over it. A sheet's Host only presents its sheet, which iOS lays out as the `system`
// does, keyboard and all.
const ignoredSafeArea = {
  nothing: 'all',
  keyboard: 'container',
  system: undefined,
} as const satisfies Record<string, HostProps['ignoreSafeArea']>;

export const Host = ({
  avoids = 'nothing',
  ...props
}: Omit<HostProps, 'ignoreSafeArea'> & { avoids?: keyof typeof ignoredSafeArea }) => (
  <SwiftUIHost {...props} ignoreSafeArea={ignoredSafeArea[avoids]} />
);
