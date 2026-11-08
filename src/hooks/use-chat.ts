import { useState } from "react";
import * as z from "zod/mini";

import { hex } from "@/hex";
import { RefusedError } from "@/hex/client";
import { useFailures, failure } from "@/hooks/use-failures";
import { useKept } from "@/hooks/use-kept";
import { useWatch } from "@/hooks/use-watch";
import { arrived, newKey } from "@/live/chat";
import type { Sending } from "@/live/chat";
import type { Picked } from "@/live/media";
import type { Chat, TaskId } from "@/live/tasks";

export const useChat = (id: TaskId | null, live: boolean) => {
  const [seen, setSeen] = useState<{ id: TaskId; chat: Chat }>();
  const [writable, keepWritable] = useKept("sends", z.record(z.string(), z.boolean()));
  const [sending, setSending] = useState<Sending[]>([]);
  const tries = useFailures();
  useWatch(
    live ? id : null,
    async (after, signal, thread) => await hex.tasks.chat(thread, after, signal),
    (chat, thread) => {
      setSeen({ id: thread, chat });

      if (writable?.[thread] !== chat.sends) {
        keepWritable({ ...writable, [thread]: chat.sends });
      }
    },
  );

  const chat = seen && seen.id === id ? seen.chat : undefined;
  const pending = sending.filter((sent) => sent.id === id && !(chat && arrived(chat, sent)));

  const deliver = (sent: Sending) => {
    setSending((now) => [
      ...now.filter(({ key }) => key !== sent.key),
      { ...sent, failed: undefined },
    ]);
    void (async () => {
      try {
        await hex.tasks.send(sent.id, sent.text, sent.key, sent.media);
      } catch (error) {
        const failed = { why: failure("Not sent", error), again: !(error instanceof RefusedError) };
        setSending((now) =>
          now.map((each) => (each.key === sent.key ? { ...each, failed } : each)),
        );
      }
    })();
  };

  return {
    chat,
    sends: chat ? chat.sends : !!id && (writable?.[id] ?? true),
    pending,
    send: (text: string, media: Picked[] = []) => {
      if (id) {
        deliver({ id, key: newKey(), text, media, total: chat?.total ?? 0 });
      }
    },
    retry: deliver,
    stop: async () => {
      if (id) {
        await tries.attempt(id, "Not stopped", async () => {
          await hex.tasks.stop(id);
        });
      }
    },
    failed: id ? tries.failed[id] : undefined,
  };
};
