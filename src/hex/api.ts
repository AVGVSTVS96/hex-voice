import * as z from 'zod/mini';

import { AgentActivity } from '../live/agents';
import { AskList, Check, Sent, Words, type AskId } from '../live/asks';
import { CallId, CallList, CallRecord } from '../live/calls';
import { Shared, type MediaId, type Picked } from '../live/media';
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
export function createHex({ request, send, upload, image }: Client) {
  const media = {
    // hex keeps the file and answers with the id it goes by.
    upload: (picked: Picked) => upload('/media', Shared, picked),
    // The photo, or for a clip a still from it.
    image: (id: MediaId) => image(`/media/${enc(id)}`),
  };
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
    media,
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
      // The photo or clip goes up, then to the call by the id hex gave it, which comes back.
      share: async (id: CallId, picked: Picked) => {
        const shared = await media.upload(picked);
        await send(`/calls/${enc(id)}/media`, { body: { media: shared.id } });
        return shared;
      },
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
      // Media goes up first, then the words with the ids hex gave it.
      send: async (id: TaskId, text: string, key: string, picked: Picked[] = []) => {
        const shared = await Promise.all(picked.map(media.upload));
        const ids = shared.map((one) => one.id);
        await send(`/tasks/${enc(id)}/chat`, {
          body: ids.length ? { text, key, media: ids } : { text, key },
        });
      },
      stop: (id: TaskId) => send(`/tasks/${enc(id)}/stop`),
    },
    asks: {
      list: (after?: number, signal?: AbortSignal) => request('/asks', AskList, { after, signal }),
      check: () => request('/asks/check', Check),
      words: (id: AskId) => request(`/asks/${enc(id)}/words`, Words),
      answer: (id: AskId, label: string) =>
        request(`/asks/${enc(id)}/answer`, Sent, { method: 'POST', body: { label } }),
      note: (id: AskId, text: string) =>
        request(`/asks/${enc(id)}/note`, Sent, { method: 'POST', body: { text } }),
      dismiss: (id: AskId) => request(`/asks/${enc(id)}/dismiss`, Sent, { method: 'POST' }),
      undo: (id: AskId) => send(`/asks/${enc(id)}/undo`),
      act: (id: string) => send(`/stuck/${enc(id)}/act`),
      read: (id: string) => send(`/fresh/${enc(id)}/read`),
      talk: () => send('/asks/talk'),
    },
  };
}
