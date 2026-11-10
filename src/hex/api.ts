import * as z from "zod/mini";

import { AgentActivity } from "../live/agents";
import { AskList, Check, Sent, Words } from "../live/asks";
import type { AskId } from "../live/asks";
import { CallId, CallList, CallRecord } from "../live/calls";
import { Shared } from "../live/media";
import type { MediaId, Picked } from "../live/media";
import { Talk } from "../live/talk";
import type { TalkChange } from "../live/talk";
import { Chat, TaskCounts, TaskList, TaskOrPage } from "../live/tasks";
import type { TaskId } from "../live/tasks";
import type { SessionAPI } from "../live/types";
import type { Client } from "./client";

const Opened = z.object({
  session: z.object({ id: CallId }),
  transport: z.object({ sdp: z.string() }),
});

const enc = encodeURIComponent;

export const createHex = ({ request, send, source, upload }: Client) => {
  const media = {
    upload: async (picked: Picked) => await upload("/media", Shared, picked),
    image: (id: MediaId) => source(`/media/${enc(id)}`),
  };

  const session: SessionAPI = {
    create: async (sdp, voice, about) => {
      const { session: opened, transport } = await request("/session", Opened, {
        method: "POST",
        body: { sdp, voice, from: "app", about: about === "asks" ? about : about?.task },
      });

      return { sdp: transport.sdp, sessionId: opened.id };
    },
    close: async (sessionId) => {
      await send("/session", { method: "DELETE", body: { sessionId } });
    },
    mark: async (sessionId, kind) => {
      await send(`/calls/${enc(sessionId)}/moments`, { body: { kind } });
    },
  };

  return {
    session,
    media,
    talk: {
      get: async () => await request("/settings", Talk),
      change: async (change: TalkChange) =>
        await request("/settings", Talk, { method: "PUT", body: change }),
    },
    activity: {
      watch: async (after: number | undefined, signal: AbortSignal) =>
        await request("/activity", AgentActivity, { after, signal }),
    },
    calls: {
      list: async (after?: number, signal?: AbortSignal) =>
        await request("/calls", CallList, { after, signal }),
      get: async (id: CallId, after?: number, signal?: AbortSignal) =>
        await request(`/calls/${enc(id)}`, CallRecord, { after, signal }),
      remove: async (id: CallId) => {
        await send(`/calls/${enc(id)}`, { method: "DELETE" });
      },
      media: async (id: CallId, shared: MediaId[]) => {
        await send(`/calls/${enc(id)}/media`, { body: { media: shared } });
      },
    },
    tasks: {
      list: async (after?: number, signal?: AbortSignal) =>
        await request("/tasks", TaskList, { after, signal }),
      counts: async (after?: number, signal?: AbortSignal) =>
        await request("/tasks/summary", TaskCounts, { after, signal }),
      get: async (id: TaskId) => await request(`/tasks/${enc(id)}`, TaskOrPage),
      chat: async (id: TaskId, after?: number, signal?: AbortSignal) =>
        await request(`/tasks/${enc(id)}/chat`, Chat, { after, signal }),
      talk: async (id: TaskId) => {
        await send(`/tasks/${enc(id)}/talk`);
      },
      send: async (id: TaskId, text: string, key: string, picked: Picked[] = []) => {
        const shared = await Promise.all(picked.map(media.upload));
        const ids = shared.map((one) => one.id);
        await send(`/tasks/${enc(id)}/chat`, {
          body: ids.length ? { text, key, media: ids } : { text, key },
        });
      },
      stop: async (id: TaskId) => {
        await send(`/tasks/${enc(id)}/stop`);
      },
    },
    asks: {
      list: async (after?: number, signal?: AbortSignal) =>
        await request("/asks", AskList, { after, signal }),
      check: async () => await request("/asks/check", Check),
      shot: (id: AskId, n: number) => source(`/asks/${enc(id)}/shots/${n}`),
      words: async (id: AskId) => await request(`/asks/${enc(id)}/words`, Words),
      answer: async (id: AskId, label: string) =>
        await request(`/asks/${enc(id)}/answer`, Sent, { method: "POST", body: { label } }),
      note: async (id: AskId, text: string) =>
        await request(`/asks/${enc(id)}/note`, Sent, { method: "POST", body: { text } }),
      dismiss: async (id: AskId) =>
        await request(`/asks/${enc(id)}/dismiss`, Sent, { method: "POST" }),
      undo: async (id: AskId) => {
        await send(`/asks/${enc(id)}/undo`);
      },
      act: async (id: string) => {
        await send(`/stuck/${enc(id)}/act`);
      },
      read: async (id: string) => {
        await send(`/fresh/${enc(id)}/read`);
      },
      talk: async () => {
        await send("/asks/talk");
      },
    },
  };
};
