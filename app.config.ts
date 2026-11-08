import type { ConfigContext, ExpoConfig } from 'expo/config';

const withUpdates = ({ config }: ConfigContext): Partial<ExpoConfig> => {
  const env: Partial<Record<string, string>> = process.env;

  return { ...config, updates: { url: env.HEX_UPDATES_URL } };
};

export default withUpdates;
