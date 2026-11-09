import type { ConfigContext, ExpoConfig } from "expo/config";

const withUpdates = ({ config }: ConfigContext): Partial<ExpoConfig> => {
  const env: Partial<Record<string, string>> = process.env;

  const url = env.HEX_UPDATES_URL;

  return { ...config, updates: { ...(url !== undefined && { url }) } };
};

export default withUpdates;
