import * as z from 'zod/mini';

import { AgentActivity } from '../live/agents';
import { AskList, Check, type AskId } from '../live/asks';
import { CallId, CallList, CallRecord } from '../live/calls';
import { Chat, TaskCounts, TaskList, TaskOrPage, type TaskId } from '../live/tasks';
import type { SessionAPI } from '../live/types';

import type { Client } from './client';

// OpenAI's session, as hex hands it back for the app's offer.
const Opened = z.object({
  session: z.object({ id: CallId }),
  transport: z.object({ sdp: z.string() }),
});

const enc = encodeURIComponent;

// Every request the app makes to hex's voice plugin, each one answered in the app's own types.
export function createHex({ request, send }: Client) {
  const session: SessionAPI = {
    create: async (sdp, voice, about) => {
      const { session, transport } = await request('/session', Opened, {
        method: 'POST',
        body: { sdp, voice, from: 'app', about: about === 'asks' ? about : about?.task },
      });
      return { sdp: transport.sdp, sessionId: session.id };
    },
    close: (sessionId) => send('/session', { method: 'DELETE', body: { sessionId } }),
    mark: (sessionId, kind) => send(`/calls/${enc(sessionId)}/moments`, { body: { kind } }),
  };
  return {
    session,
    activity: {
      watch: (after: number | undefined, signal: AbortSignal) =>
        request('/activity', AgentActivity, { after, signal }),
    },
    calls: {
      list: (after?: number, signal?: AbortSignal) =>
        request('/calls', CallList, { after, signal }),
      get: (id: CallId, after?: number, signal?: AbortSignal) =>
        request(`/calls/${enc(id)}`, CallRecord, { after, signal }),
      remove: (id: CallId) => send(`/calls/${enc(id)}`, { method: 'DELETE' }),
    },
    tasks: {
      list: (after?: number, signal?: AbortSignal) =>
        request('/tasks', TaskList, { after, signal }),
      counts: (after?: number, signal?: AbortSignal) =>
        request('/tasks/summary', TaskCounts, { after, signal }),
      get: (id: TaskId) => request(`/tasks/${enc(id)}`, TaskOrPage),
      chat: (id: TaskId, after?: number, signal?: AbortSignal) =>
        request(`/tasks/${enc(id)}/chat`, Chat, { after, signal }),
      talk: (id: TaskId) => send(`/tasks/${enc(id)}/talk`),
      send: (id: TaskId, text: string, key: string) =>
        send(`/tasks/${enc(id)}/chat`, { body: { text, key } }),
      stop: (id: TaskId) => send(`/tasks/${enc(id)}/stop`),
    },
    asks: {
      list: (after?: number, signal?: AbortSignal) => request('/asks', AskList, { after, signal }),
      check: () => request('/asks/check', Check),
      answer: (id: AskId, label: string) => send(`/asks/${enc(id)}/answer`, { body: { label } }),
      undo: (id: AskId) => send(`/asks/${enc(id)}/undo`),
      act: (id: string) => send(`/stuck/${enc(id)}/act`),
      read: (id: string) => send(`/fresh/${enc(id)}/read`),
      talk: () => send('/asks/talk'),
    },
  };
}
