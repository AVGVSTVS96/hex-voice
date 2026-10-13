import assert from 'node:assert/strict';
import test from 'node:test';

import { createSessionAPI } from '../src/live/api-client';

const hexUrl = 'https://hex.example:8790';

test('needs the hex address before making a request', async () => {
  for (const missing of [undefined, '', '   ']) {
    const api = createSessionAPI({ hexUrl: missing, fetch: assert.fail });
    assert.throws(() => api.prepare?.(), /EXPO_PUBLIC_HEX_URL/);
  }
});

test('sends the offer and voice to hex and reads OpenAI’s session back', async () => {
  const api = createSessionAPI({
    hexUrl: `${hexUrl}//`,
    fetch: async (url, init) => {
      assert.equal(url, `${hexUrl}/session`);
      assert.equal(init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(init?.body)), {
        sdp: 'offer',
        voice: 'cedar',
        from: 'app',
      });
      return Response.json({
        session: { id: 'live_1', model: 'gpt-live-1' },
        transport: { sdp: 'answer' },
      });
    },
  });
  assert.deepEqual(await api.create('offer', 'cedar'), { sdp: 'answer', sessionId: 'live_1' });
});

test('ends a call with DELETE', async () => {
  const api = createSessionAPI({
    hexUrl,
    fetch: async (_url, init) => {
      assert.equal(init?.method, 'DELETE');
      assert.deepEqual(JSON.parse(String(init?.body)), { sessionId: 'live_1' });
      return new Response(null, { status: 204 });
    },
  });
  await api.close('live_1');
});

test('shows hex’s and OpenAI’s errors as they are', async () => {
  const plain = createSessionAPI({
    hexUrl,
    fetch: async () => new Response('Set OPENAI_API_KEY', { status: 503 }),
  });
  await assert.rejects(plain.create('offer'), /Set OPENAI_API_KEY/);
  const openai = createSessionAPI({
    hexUrl,
    fetch: async () => Response.json({ error: { message: 'Invalid voice' } }, { status: 400 }),
  });
  await assert.rejects(openai.create('offer'), /^Error: Invalid voice$/);
  const incomplete = createSessionAPI({
    hexUrl,
    fetch: async () => Response.json({ session: {} }),
  });
  await assert.rejects(incomplete.create('offer'), /invalid connection/);
});

test('an unreachable hex points at Tailscale', async () => {
  const api = createSessionAPI({
    hexUrl,
    fetch: async () => {
      throw new TypeError('Network request failed');
    },
  });
  await assert.rejects(api.create('offer'), /Tailscale/);
});
