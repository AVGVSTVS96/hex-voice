import { useState } from 'react';

import { useWatch } from '@/hooks/use-watch';
import { tasksAPI } from '@/live/api';
import { arrived, newKey, type Sending } from '@/live/chat';
import type { Chat } from '@/live/tasks';

// One thread's chat, live while it's on screen, with your words showing the moment you send them.
// The app names each message it sends, and hex's chat says when it has one: waiting to be taken,
// or in the chat itself.
export function useChat(id: string) {
  const [chat, setChat] = useState<Chat>();
  const [offline, setOffline] = useState(false);
  const [sending, setSending] = useState<Sending[]>([]);
  useWatch<Chat>(true, (after, signal) => tasksAPI.chat(id, after, signal), setChat, setOffline);

  const pending = chat ? sending.filter((sent) => !arrived(chat, sent)) : sending;

  const deliver = (sent: Sending) => {
    setSending((now) => [...now.filter(({ key }) => key !== sent.key), { ...sent, failed: false }]);
    tasksAPI
      .send(id, sent.text, sent.key)
      .catch(() =>
        setSending((now) =>
          now.map((each) => (each.key === sent.key ? { ...each, failed: true } : each)),
        ),
      );
  };

  return {
    chat,
    offline,
    pending,
    send: (text: string) => deliver({ key: newKey(), text, total: chat?.total ?? 0 }),
    retry: deliver,
    stop: () => tasksAPI.stop(id).catch(() => {}),
  };
}
