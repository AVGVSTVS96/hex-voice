import { fetch } from 'expo/fetch';

import { createAgentsAPI } from './agents';
import { createSessionAPI } from './api-client';

export const sessionAPI = createSessionAPI({ fetch, hexUrl: process.env.EXPO_PUBLIC_HEX_URL });
export const agentsAPI = createAgentsAPI({ fetch, hexUrl: process.env.EXPO_PUBLIC_HEX_URL });
