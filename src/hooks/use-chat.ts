import { useState } from 'react';
import * as z from 'zod/mini';

import { hex } from '@/hex';
import { Refused } from '@/hex/client';
import { useFailures, failure } from '@/hooks/use-failures';
import { useKept } from '@/hooks/use-kept';
import { useWatch } from '@/hooks/use-watch';
import { arrived, newKey, type Sending } from '@/live/chat';
import type { Picked } from '@/live/media';
import type { Chat, TaskId } from '@/live/tasks';

// One thread's chat, with your words showing the moment you send them, watched while `live`: once
// it isn't, the chat stays as it last was. The app names each message it sends, and hex's chat says
// when it has one: waiting to be taken, or in the chat itself. Whether each thread takes typed words
// is kept on this device, so its page opens with its field while its chat loads; a thread on the
// board nearly always does, so one never opened here starts with it too.
export const useChat = (id: TaskId | null, live: boolean) => {
  const [seen, setSeen] = useState<{ id: TaskId; chat: Chat }>();
  const [writable, keepWritable] = useKept('sends', z.record(z.string(), z.boolean()));
  const [sending, setSending] = useState<Sending[]>([]);
  const tries = useFailures();
  useWatch(
    live ? id : null,
    (after, signal, id) => hex.tasks.chat(id, after, signal),
    (chat, id) => {
      setSeen({ id, chat });
      if (writable?.[id] !== chat.sends) keepWritable({ ...writable, [id]: chat.sends });
    },
  );

  const chat = seen && seen.id === id ? seen.chat : undefined;
  const pending = sending.filter((sent) => sent.id === id && !(chat && arrived(chat, sent)));

  const deliver = (sent: Sending) => {
    setSending((now) => [
      ...now.filter(({ key }) => key !== sent.key),
      { ...sent, failed: undefined },
    ]);
    hex.tasks.send(sent.id, sent.text, sent.key, sent.media).catch((error: unknown) => {
      const failed = { why: failure('Not sent', error), again: !(error instanceof Refused) };
      setSending((now) => now.map((each) => (each.key === sent.key ? { ...each, failed } : each)));
    });
  };

  return {
    chat,
    sends: chat ? chat.sends : !!id && (writable?.[id] ?? true),
    pending,
    send: (text: string, media: Picked[] = []) =>
      id && deliver({ id, key: newKey(), text, media, total: chat?.total ?? 0 }),
    retry: deliver,
    stop: () => id && tries.attempt(id, 'Not stopped', () => hex.tasks.stop(id)),
    failed: id ? tries.failed[id] : undefined,
  };
};
