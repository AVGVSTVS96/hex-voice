import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';

import { publish, serve } from '../updates/store.mjs';

const made: string[] = [];
after(() => Promise.all(made.map((dir) => rm(dir, { recursive: true, force: true }))));

async function scratch(prefix: string) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}

async function exported() {
  const dist = await scratch('dist-');
  await mkdir(join(dist, '_expo/static/js/ios'), { recursive: true });
  await mkdir(join(dist, 'assets'));
  await writeFile(join(dist, '_expo/static/js/ios/entry-1.hbc'), 'bundle');
  await writeFile(join(dist, 'assets/abc'), 'image');
  await writeFile(
    join(dist, 'metadata.json'),
    JSON.stringify({
      fileMetadata: {
        ios: {
          bundle: '_expo/static/js/ios/entry-1.hbc',
          assets: [{ path: 'assets/abc', ext: 'png' }],
        },
      },
    }),
  );
  return dist;
}

async function store() {
  const dir = await scratch('updates-');
  const server = serve(dir).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://localhost:${(server.address() as AddressInfo).port}`;
  return { dir, server, origin, expoConfig: { updates: { url: `${origin}/manifest` } } };
}

const manifest = (origin: string, runtime: string) =>
  fetch(`${origin}/manifest`, {
    headers: {
      'expo-protocol-version': '1',
      'expo-platform': 'ios',
      'expo-runtime-version': runtime,
    },
  });

test('serves the latest update for a runtime, with assets the app can verify', async (t) => {
  const { dir, server, origin, expoConfig } = await store();
  t.after(() => server.close());
  await mkdir(join(dir, 'ios/abc123'), { recursive: true });
  await publish({
    dir,
    dist: await exported(),
    platform: 'ios',
    runtimeVersion: 'abc123',
    expoConfig,
  });

  const response = await manifest(origin, 'abc123');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('expo-protocol-version'), '1');
  const update = await response.json();
  assert.equal(update.runtimeVersion, 'abc123');
  assert.match(update.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.deepEqual(update.extra.expoClient, expoConfig);

  for (const asset of [update.launchAsset, ...update.assets]) {
    const file = await fetch(asset.url);
    assert.equal(file.headers.get('content-type'), asset.contentType);
    const hash = createHash('sha256')
      .update(Buffer.from(await file.arrayBuffer()))
      .digest('base64url');
    assert.equal(hash, asset.hash);
  }
  assert.equal(update.assets[0].key, createHash('md5').update('image').digest('hex'));
});

test('has no update for a runtime without one', async (t) => {
  const { server, origin } = await store();
  t.after(() => server.close());
  const response = await manifest(origin, 'unknown');
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('expo-protocol-version'), '1');
});

test('refuses to publish for a runtime no native build has', async (t) => {
  const { dir, server, expoConfig } = await store();
  t.after(() => server.close());
  await assert.rejects(
    publish({ dir, dist: await exported(), platform: 'ios', runtimeVersion: 'new', expoConfig }),
    /no native build has runtime new/,
  );
});

test('publishing the same export again leaves the update as it was', async (t) => {
  const { dir, server, expoConfig } = await store();
  t.after(() => server.close());
  await mkdir(join(dir, 'ios/abc123'), { recursive: true });
  const dist = await exported();
  const update = { dir, dist, platform: 'ios', runtimeVersion: 'abc123', expoConfig };
  assert.equal((await publish(update)).published, true);
  const first = await readFile(join(dir, 'ios/abc123/manifest.json'), 'utf8');
  assert.equal((await publish(update)).published, false);
  assert.equal(await readFile(join(dir, 'ios/abc123/manifest.json'), 'utf8'), first);
});
