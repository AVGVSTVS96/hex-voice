import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';

import { createHex } from './api';
import { createClient } from './client';

export const hex = createHex(
  createClient({
    fetch,
    open: (uri) => new File(uri),
    url: process.env.EXPO_PUBLIC_HEX_URL,
    token: process.env.EXPO_PUBLIC_HEX_TOKEN,
  }),
);
