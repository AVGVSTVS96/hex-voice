import { useState } from 'react';

import { useWatch } from '@/hooks/use-watch';
import { useFailures, failure } from '@/hooks/use-failures';
import { tasksAPI } from '@/live/api';
import { Refused } from '@/live/api-client';
import { arrived, newKey, type Sending } from '@/live/chat';
import type { Chat } from '@/live/tasks';

// One thread's chat, live while it's open, with your words showing the moment you send them. The
// app names each message it sends, and hex's chat says when it has one: waiting to be taken, or in
// the chat itself.
export function useChat(id: string | null) {
  const [seen, setSeen] = useState<{ id: string; chat: Chat }>();
  const [sending, setSending] = useState<Sending[]>([]);
  const tries = useFailures();
  useWatch<Chat>(
    id,
    (after, signal) => tasksAPI.chat(id!, after, signal),
    (chat) => setSeen({ id: id!, chat }),
  );

  const chat = seen && seen.id === id ? seen.chat : undefined;
  const pending = sending.filter((sent) => sent.id === id && !(chat && arrived(chat, sent)));

  const deliver = (sent: Sending) => {
    setSending((now) => [
      ...now.filter(({ key }) => key !== sent.key),
      { ...sent, failed: undefined },
    ]);
    tasksAPI.send(sent.id, sent.text, sent.key).catch((error: unknown) => {
      const failed = { why: failure('Not sent', error), again: !(error instanceof Refused) };
      setSending((now) => now.map((each) => (each.key === sent.key ? { ...each, failed } : each)));
    });
  };

  return {
    chat,
    pending,
    send: (text: string) => id && deliver({ id, key: newKey(), text, total: chat?.total ?? 0 }),
    retry: deliver,
    stop: () => id && tries.attempt(id, 'Not stopped', () => tasksAPI.stop(id)),
    failed: id ? tries.failed[id] : undefined,
  };
}
