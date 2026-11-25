import * as z from "zod/mini";

const Address = z.optional(z.string());

export interface Server {
  id: string;
  label: string;
  url: string | undefined;
  token: string | undefined;
  tasks: "hex" | "sessions";
  kept: string;
  reach: string;
}

export const SERVERS: readonly [Server, ...Server[]] = [
  {
    id: "hex",
    label: "hex",
    url: Address.parse(process.env.EXPO_PUBLIC_HEX_URL),
    token: Address.parse(process.env.EXPO_PUBLIC_HEX_TOKEN),
    tasks: "hex",
    kept: "",
    reach: "Check that Tailscale is on",
  },
  {
    id: "hex-next",
    label: "hex-next",
    url: Address.parse(process.env.EXPO_PUBLIC_HEX_NEXT_URL),
    token: Address.parse(process.env.EXPO_PUBLIC_HEX_NEXT_TOKEN),
    tasks: "sessions",
    kept: "hex-next:",
    reach: "Check your connection",
  },
];

const set = (value: string | undefined) => (value ?? "").trim() !== "";

export const offered = ([first, ...rest]: readonly [Server, ...Server[]]): [
  Server,
  ...Server[],
] => [first, ...rest.filter(({ url, token }) => set(url) && set(token))];

const DEFAULT = "hex-next";

export const chosen = (servers: readonly [Server, ...Server[]], saved: string) =>
  servers.find(({ id }) => id === saved) ?? servers.find(({ id }) => id === DEFAULT) ?? servers[0];

export interface Kept {
  exists: boolean;
  textSync: () => string;
  writeSync: (text: string) => void;
}

export const savedIn = (file: Kept) => {
  try {
    return file.exists ? file.textSync().trim() : "";
  } catch {
    return "";
  }
};

export const switchIn = async (file: Kept, id: string, restart: () => Promise<void>) => {
  file.writeSync(id);
  await restart();
};
