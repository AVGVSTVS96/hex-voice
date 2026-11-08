import assert from 'node:assert/strict';
import test from 'node:test';

import { CallId } from '../src/live/calls';
import { MediaId } from '../src/live/media';
import type { Picked } from '../src/live/media';
import { batchOf, deliver, retrying, settle } from '../src/live/shares';
import type { ShareAPI } from '../src/live/shares';

const call = CallId.parse('live_1');
const photo: Picked = { uri: 'file:///router.jpg', kind: 'photo', type: 'image/jpeg' };
const clip: Picked = { uri: 'file:///cable.mov', kind: 'video', type: 'video/quicktime' };

interface HexThat {
  first?: number;
  refuse?: string[];
  callFails?: Error;
}

const hexThat = ({ first = 1, refuse = [], callFails }: HexThat = {}) => {
  const asked: string[] = [];
  let kept = first - 1;

  const api: ShareAPI = {
    upload: async ({ uri, kind }) => {
      asked.push(`upload ${uri}`);

      if (refuse.includes(uri)) {
        throw new Error('Cannot reach hex');
      }

      kept += 1;

      return { id: MediaId.parse(`m${kept}`), kind };
    },
    media: async (to, ids) => {
      asked.push(`call ${to} ${ids.join(',')}`);

      if (callFails) {
        throw callFails;
      }
    },
  };

  return { api, asked };
};

test('a batch goes up item by item, then to the call in one request, and a clip shows hex’s still', async () => {
  const batch = batchOf(call, 4000, [photo, clip], 'k');
  const { api, asked } = hexThat();
  const outcome = await deliver(call, batch, api);
  assert.deepEqual(asked, [
    'upload file:///router.jpg',
    'upload file:///cable.mov',
    'call live_1 m1,m2',
  ]);
  const sent = settle(batch, batch, outcome);
  assert.deepEqual(
    sent.map(({ id, entry }) => [id, entry.sending, entry.failed, entry.media]),
    [
      ['m1', false, undefined, photo],
      ['m2', false, undefined, { id: 'm2', kind: 'video' }],
    ],
  );
});

test('when one item doesn’t go up, the batch never reaches the call, and trying again sends only that item before the batch', async () => {
  const batch = batchOf(call, 4000, [photo, clip], 'k');
  const first = hexThat({ refuse: ['file:///cable.mov'] });
  const sent = settle(batch, batch, await deliver(call, batch, first.api));
  assert.deepEqual(first.asked, ['upload file:///router.jpg', 'upload file:///cable.mov']);
  assert.deepEqual(
    sent.map(({ id, entry }) => [id, entry.failed]),
    [
      ['m1', 'Cannot reach hex'],
      [undefined, 'Cannot reach hex'],
    ],
  );

  const again = retrying(sent, sent[0].entry.id);
  assert.deepEqual(
    again.map(({ entry }) => [entry.sending, entry.failed]),
    [
      [true, undefined],
      [true, undefined],
    ],
  );
  const second = hexThat({ first: 2 });
  await deliver(call, again, second.api);
  assert.deepEqual(second.asked, ['upload file:///cable.mov', 'call live_1 m1,m2']);
});

test('a call that ended turns the batch down, and each item says why', async () => {
  const batch = batchOf(call, 4000, [photo], 'k');
  const ended = Object.assign(new Error('That call isn’t live'), { status: 409 });
  const outcome = await deliver(call, batch, hexThat({ callFails: ended }).api);
  assert.equal(outcome.error, ended);
  assert.deepEqual(
    settle(batch, batch, outcome).map(({ id, entry }) => [id, entry.failed]),
    [['m1', 'That call isn’t live']],
  );
});

test('trying again takes only what didn’t go, from that batch alone', () => {
  const done = settle(batchOf(call, 1000, [photo], 'a'), batchOf(call, 1000, [photo], 'a'), {
    shared: [{ id: MediaId.parse('m1'), kind: 'photo' }],
  });

  const lost = batchOf(call, 2000, [photo, clip], 'b').map((one) => ({
    ...one,
    entry: { ...one.entry, sending: false, failed: 'Cannot reach hex' },
  }));

  const all = [...done, ...lost];
  assert.deepEqual(retrying(all, done[0].entry.id), []);
  assert.deepEqual(
    retrying(all, lost[1].entry.id).map(({ entry }) => entry.id),
    lost.map(({ entry }) => entry.id),
  );
});
