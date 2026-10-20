import { useState } from 'react';

import { useWatch } from '@/hooks/use-watch';
import { tasksAPI } from '@/live/api';
import { arrived, newKey, type Sending } from '@/live/chat';
import type { Chat } from '@/live/tasks';

// One thread's chat, live while it's open, with your words showing the moment you send them. The
// app names each message it sends, and hex's chat says when it has one: waiting to be taken, or in
// the chat itself.
export function useChat(id: string | null) {
  const [seen, setSeen] = useState<{ id: string; chat: Chat }>();
  const [sending, setSending] = useState<Sending[]>([]);
  useWatch<Chat>(
    id,
    (after, signal) => tasksAPI.chat(id!, after, signal),
    (chat) => setSeen({ id: id!, chat }),
  );

  const chat = seen && seen.id === id ? seen.chat : undefined;
  const pending = sending.filter((sent) => sent.id === id && !(chat && arrived(chat, sent)));

  const deliver = (sent: Sending) => {
    setSending((now) => [...now.filter(({ key }) => key !== sent.key), { ...sent, failed: false }]);
    tasksAPI
      .send(sent.id, sent.text, sent.key)
      .catch(() =>
        setSending((now) =>
          now.map((each) => (each.key === sent.key ? { ...each, failed: true } : each)),
        ),
      );
  };

  return {
    chat,
    pending,
    send: (text: string) => id && deliver({ id, key: newKey(), text, total: chat?.total ?? 0 }),
    retry: deliver,
    stop: () => id && tasksAPI.stop(id).catch(() => {}),
  };
}
