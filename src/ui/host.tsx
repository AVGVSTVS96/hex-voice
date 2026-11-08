import { Host as SwiftUIHost } from '@expo/ui/swift-ui';
import type { HostProps } from '@expo/ui/swift-ui';

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
