import * as z from "zod/mini";

const Address = z.optional(z.string());

export interface Server {
  id: string;
  label: string;
  url: string | undefined;
  token: string | undefined;
  tasks: boolean;
  kept: string;
  reach: string;
}

export const SERVERS: readonly [Server, ...Server[]] = [
  {
    id: "hex",
    label: "hex",
    url: Address.parse(process.env.EXPO_PUBLIC_HEX_URL),
    token: Address.parse(process.env.EXPO_PUBLIC_HEX_TOKEN),
    tasks: true,
    kept: "",
    reach: "Check that Tailscale is on",
  },
  {
    id: "hex-next",
    label: "hex-next",
    url: Address.parse(process.env.EXPO_PUBLIC_HEX_NEXT_URL),
    token: Address.parse(process.env.EXPO_PUBLIC_HEX_NEXT_TOKEN),
    tasks: false,
    kept: "hex-next:",
    reach: "Check your connection",
  },
];

export const offered = ([first, ...rest]: readonly [Server, ...Server[]]): [
  Server,
  ...Server[],
] => [first, ...rest.filter(({ url }) => (url ?? "").trim() !== "")];

export const chosen = (servers: readonly [Server, ...Server[]], saved: string | undefined) =>
  servers.find(({ id }) => id === saved) ?? servers[0];
