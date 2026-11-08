import { Host as SwiftUIHost, type HostProps } from '@expo/ui/swift-ui';

// Where a SwiftUI view sits is React Native's to decide, so by default a Host keeps clear of
// nothing iOS reserves. One the keyboard covered would otherwise shorten what it holds by the
// keyboard and center it, half off its top: the call's buttons, marks and icons jumping up as you
// type in Tasks. A Host that holds a field keeps above the `keyboard`, so the field and its send
// button stay over it. A sheet's Host only presents its sheet, which iOS lays out as the `system`
// does, keyboard and all.
export const Host = ({
  avoids,
  ...props
}: Omit<HostProps, 'ignoreSafeArea'> & { avoids?: 'keyboard' | 'system' }) => (
  <SwiftUIHost
    {...props}
    ignoreSafeArea={avoids === 'keyboard' ? 'container' : avoids === 'system' ? undefined : 'all'}
  />
);
