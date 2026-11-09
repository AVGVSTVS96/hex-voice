import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";

import * as z from "zod";

import { publish, serve } from "../updates/store.mjs";
import { nth } from "./nth";

const Asset = z.object({
  url: z.string(),
  contentType: z.string(),
  hash: z.string(),
  key: z.string(),
});

const Manifest = z.object({
  id: z.string(),
  runtimeVersion: z.string(),
  launchAsset: Asset,
  assets: z.array(Asset),
  extra: z.object({ expoClient: z.unknown() }),
});

const made: string[] = [];

after(
  async () =>
    await Promise.all(
      made.map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
      }),
    ),
);

const scratch = async (prefix: string) => {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  made.push(dir);

  return dir;
};

const exported = async () => {
  const dist = await scratch("dist-");
  await mkdir(path.join(dist, "_expo/static/js/ios"), { recursive: true });
  await mkdir(path.join(dist, "assets"));
  await writeFile(path.join(dist, "_expo/static/js/ios/entry-1.hbc"), "bundle");
  await writeFile(path.join(dist, "assets/abc"), "image");
  await writeFile(
    path.join(dist, "metadata.json"),
    JSON.stringify({
      fileMetadata: {
        ios: {
          bundle: "_expo/static/js/ios/entry-1.hbc",
          assets: [{ path: "assets/abc", ext: "png" }],
        },
      },
    }),
  );

  return dist;
};

const store = async () => {
  const dir = await scratch("updates-");
  const server = serve(dir).listen(0);
  await once(server, "listening");
  const { port } = z.object({ port: z.number() }).parse(server.address());
  const origin = `http://localhost:${port}`;

  return { dir, server, origin, expoConfig: { updates: { url: `${origin}/manifest` } } };
};

const manifest = async (origin: string, runtime: string) =>
  await fetch(`${origin}/manifest`, {
    headers: {
      "expo-protocol-version": "1",
      "expo-platform": "ios",
      "expo-runtime-version": runtime,
    },
  });

test("serves the latest update for a runtime, with assets the app can verify", async (t) => {
  const { dir, server, origin, expoConfig } = await store();
  t.after(() => server.close());
  await mkdir(path.join(dir, "ios/abc123"), { recursive: true });
  await publish({
    dir,
    dist: await exported(),
    platform: "ios",
    runtimeVersion: "abc123",
    expoConfig,
  });

  const response = await manifest(origin, "abc123");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("expo-protocol-version"), "1");
  const update = Manifest.parse(await response.json());
  assert.equal(update.runtimeVersion, "abc123");
  assert.match(update.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
  assert.deepEqual(update.extra.expoClient, expoConfig);

  await Promise.all(
    [update.launchAsset, ...update.assets].map(async (asset) => {
      const file = await fetch(asset.url);
      assert.equal(file.headers.get("content-type"), asset.contentType);

      const hash = createHash("sha256")
        .update(Buffer.from(await file.arrayBuffer()))
        .digest("base64url");

      assert.equal(hash, asset.hash);
    }),
  );

  assert.equal(nth(update.assets, 0).key, createHash("md5").update("image").digest("hex"));
});

test("has no update for a runtime without one", async (t) => {
  const { server, origin } = await store();
  t.after(() => server.close());
  const response = await manifest(origin, "unknown");
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("expo-protocol-version"), "1");
});

test("refuses to publish for a runtime no native build has", async (t) => {
  const { dir, server, expoConfig } = await store();
  t.after(() => server.close());
  await assert.rejects(
    publish({ dir, dist: await exported(), platform: "ios", runtimeVersion: "new", expoConfig }),
    /no native build has runtime new/u,
  );
});

test("publishing the same export again leaves the update as it was", async (t) => {
  const { dir, server, expoConfig } = await store();
  t.after(() => server.close());
  await mkdir(path.join(dir, "ios/abc123"), { recursive: true });
  const dist = await exported();
  const update = { dir, dist, platform: "ios", runtimeVersion: "abc123", expoConfig };
  const firstPublish = await publish(update);
  assert.equal(firstPublish.published, true);
  const first = await readFile(path.join(dir, "ios/abc123/manifest.json"), "utf-8");
  const again = await publish(update);
  assert.equal(again.published, false);
  assert.equal(await readFile(path.join(dir, "ios/abc123/manifest.json"), "utf-8"), first);
});
