import { fetch } from 'expo/fetch';

import { createAgentsAPI } from './agents';
import { createCallsAPI, createSessionAPI, createTasksAPI } from './api-client';

const options = {
  fetch,
  hexUrl: process.env.EXPO_PUBLIC_HEX_URL,
  token: process.env.EXPO_PUBLIC_HEX_TOKEN,
};
export const sessionAPI = createSessionAPI(options);
export const callsAPI = createCallsAPI(options);
export const agentsAPI = createAgentsAPI(options);
export const tasksAPI = createTasksAPI(options);
