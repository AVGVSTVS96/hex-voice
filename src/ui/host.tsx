import { Host as SwiftUIHost } from "@expo/ui/swift-ui";
import type { HostProps } from "@expo/ui/swift-ui";

const ignoredSafeArea = {
  nothing: { ignoreSafeArea: "all" },
  keyboard: { ignoreSafeArea: "container" },
  system: {},
} as const satisfies Record<string, Pick<HostProps, "ignoreSafeArea">>;

export const Host = ({
  avoids = "nothing",
  ...props
}: Omit<HostProps, "ignoreSafeArea"> & { avoids?: keyof typeof ignoredSafeArea }) => (
  <SwiftUIHost {...props} {...ignoredSafeArea[avoids]} />
);
