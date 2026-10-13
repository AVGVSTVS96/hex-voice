import { fetch } from 'expo/fetch';

import { createSessionAPI } from './api-client';

export const sessionAPI = createSessionAPI({ fetch, hexUrl: process.env.EXPO_PUBLIC_HEX_URL });
