import { useState } from 'react';

import { hex } from '@/hex';
import { Refused } from '@/hex/client';
import { useFailures, failure } from '@/hooks/use-failures';
import { useWatch } from '@/hooks/use-watch';
import { arrived, newKey, type Sending } from '@/live/chat';
import type { Chat, TaskId } from '@/live/tasks';

// One thread's chat, with your words showing the moment you send them, watched while `live`: once
// it isn't, the chat stays as it last was. The app names each message it sends, and hex's chat says
// when it has one: waiting to be taken, or in the chat itself.
export function useChat(id: TaskId | null, live: boolean) {
  const [seen, setSeen] = useState<{ id: TaskId; chat: Chat }>();
  const [sending, setSending] = useState<Sending[]>([]);
  const tries = useFailures();
  useWatch(
    live ? id : null,
    (after, signal, id) => hex.tasks.chat(id, after, signal),
    (chat, id) => setSeen({ id, chat }),
  );

  const chat = seen && seen.id === id ? seen.chat : undefined;
  const pending = sending.filter((sent) => sent.id === id && !(chat && arrived(chat, sent)));

  const deliver = (sent: Sending) => {
    setSending((now) => [
      ...now.filter(({ key }) => key !== sent.key),
      { ...sent, failed: undefined },
    ]);
    hex.tasks.send(sent.id, sent.text, sent.key).catch((error: unknown) => {
      const failed = { why: failure('Not sent', error), again: !(error instanceof Refused) };
      setSending((now) => now.map((each) => (each.key === sent.key ? { ...each, failed } : each)));
    });
  };

  return {
    chat,
    pending,
    send: (text: string) => id && deliver({ id, key: newKey(), text, total: chat?.total ?? 0 }),
    retry: deliver,
    stop: () => id && tries.attempt(id, 'Not stopped', () => hex.tasks.stop(id)),
    failed: id ? tries.failed[id] : undefined,
  };
}
