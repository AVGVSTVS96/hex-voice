import { fetch } from 'expo/fetch';
import { File, UploadType } from 'expo-file-system';

import { createHex } from './api';
import { createClient } from './client';

export const hex = createHex(
  createClient({
    fetch,
    sendFile: async (url, { uri, type }, { headers, signal }) => {
      const { status, body } = await new File(uri).upload(url, {
        uploadType: UploadType.BINARY_CONTENT,
        mimeType: type,
        headers,
        sessionType: 'foreground',
        signal,
      });
      return { status, text: body };
    },
    url: process.env.EXPO_PUBLIC_HEX_URL,
    token: process.env.EXPO_PUBLIC_HEX_TOKEN,
  }),
);
