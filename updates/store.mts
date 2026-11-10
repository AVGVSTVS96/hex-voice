// The Expo Updates protocol `serve` answers: https://docs.expo.dev/technical-specs/expo-updates-1/
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, stat, watch, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

import * as z from "zod";

const CONTENT_TYPES = new Map([
  ["hbc", "application/javascript"],
  ["js", "application/javascript"],
  ["json", "application/json"],
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["svg", "image/svg+xml"],
  ["ttf", "font/ttf"],
  ["otf", "font/otf"],
  ["wav", "audio/wav"],
  ["mp3", "audio/mpeg"],
  ["m4a", "audio/mp4"],
  ["html", "text/html; charset=utf-8"],
  ["plist", "application/xml"],
]);

const contentType = (ext: string) => CONTENT_TYPES.get(ext) ?? "application/octet-stream";
const Name = z.string().regex(/^\w[\w.-]*$/u);

const ExportMetadata = z.object({
  fileMetadata: z.partialRecord(
    z.string(),
    z.object({
      bundle: z.string(),
      assets: z.array(z.object({ path: z.string(), ext: z.string() })),
    }),
  ),
});

const PublishedManifest = z.object({ id: z.string().optional() });

const ExpoConfig = z.looseObject({ updates: z.looseObject({ url: z.string() }) });

export interface Publish {
  dir: string;
  dist: string;
  platform: string;
  runtimeVersion: string;
  expoConfig: { updates: { url: string } };
}

const isExpoConfig = (value: unknown): value is Publish["expoConfig"] =>
  ExpoConfig.safeParse(value).success;

export const publish = async ({ dir, dist, platform, runtimeVersion, expoConfig }: Publish) => {
  const nativeBuild = path.join(dir, platform, runtimeVersion);

  if ((await stat(nativeBuild).catch(() => null)) === null) {
    throw new Error(`no native build has runtime ${runtimeVersion}`);
  }

  const metadata = await readFile(path.join(dist, "metadata.json"));
  const files = ExportMetadata.parse(JSON.parse(metadata.toString())).fileMetadata[platform];

  if (files === undefined) {
    throw new Error(`the export has no ${platform} bundle`);
  }

  await mkdir(path.join(dir, "assets"), { recursive: true });

  const add = async (file: string, ext: string) => {
    const data = await readFile(path.join(dist, file));
    const hash = createHash("sha256").update(data).digest("base64url");
    const name = `${hash}.${ext}`;
    await replace(path.join(dir, "assets", name), data);

    return {
      hash,
      key: createHash("md5").update(data).digest("hex"),
      contentType: contentType(ext),
      url: new URL(`assets/${name}`, expoConfig.updates.url).href,
    };
  };

  const hash = createHash("sha256").update(runtimeVersion).update(metadata).digest("hex");
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  const latest = path.join(nativeBuild, "manifest.json");
  const published = await readFile(latest, "utf-8").catch(() => "{}");

  if (PublishedManifest.parse(JSON.parse(published)).id === id) {
    return { id, published: false };
  }

  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    runtimeVersion,
    launchAsset: await add(files.bundle, "hbc"),
    assets: await Promise.all(
      files.assets.map(async (asset) => ({
        ...(await add(asset.path, asset.ext)),
        fileExtension: `.${asset.ext}`,
      })),
    ),
    metadata: {},
    extra: { expoClient: expoConfig },
  };

  await replace(latest, JSON.stringify(manifest));

  return { id, published: true };
};

const replace = async (file: string, data: string | Buffer) => {
  const temporary = `${file}.${process.pid}`;
  await writeFile(temporary, data);
  await rename(temporary, file);
};

const respond = async (dir: string, request: IncomingMessage, response: ServerResponse) => {
  const { pathname, searchParams } = new URL(request.url ?? "/", "http://localhost");

  try {
    if (pathname === "/manifest") {
      await sendManifest(dir, request, response);
    } else if (pathname === "/install/latest.json") {
      await sendLinkBuild(path.join(dir, "install"), searchParams.get("after"), response);
    } else {
      const file = pathname === "/install/" ? "/install/index.html" : pathname;
      await sendFile(dir, file, request, response);
    }
  } catch (error) {
    console.error(error);

    if (!response.headersSent) {
      response.writeHead(500);
    }

    response.end();
  }
};

const LinkBuild = z.object({ version: z.number() });

const readLinkBuild = async (folder: string) =>
  await readFile(path.join(folder, "latest.json"), "utf-8").catch(() => '{"version":0}');

const versionOf = (build: string) => String(LinkBuild.safeParse(JSON.parse(build)).data?.version);

const sendLinkBuild = async (folder: string, after: string | null, response: ServerResponse) => {
  await mkdir(folder, { recursive: true });
  const build = await readLinkBuild(folder);

  response
    .writeHead(200, { "content-type": "application/json", "cache-control": "no-cache" })
    .end(versionOf(build) === after ? await nextLinkBuild(folder, after) : build);
};

const nextLinkBuild = async (folder: string, after: string) => {
  const done = new AbortController();

  try {
    for await (const { filename } of watch(folder, {
      signal: AbortSignal.any([done.signal, AbortSignal.timeout(60_000)]),
    })) {
      const build = filename === "latest.json" ? await readLinkBuild(folder) : undefined;

      if (build !== undefined && versionOf(build) !== after) {
        return build;
      }
    }
  } catch {
    return await readLinkBuild(folder);
  } finally {
    done.abort();
  }

  return await readLinkBuild(folder);
};

export const serve = (dir: string) =>
  createServer((request, response) => {
    void respond(dir, request, response);
  });

const sendManifest = async (dir: string, request: IncomingMessage, response: ServerResponse) => {
  const headers = {
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
    "cache-control": "private, max-age=0",
  };

  const platform = Name.safeParse(request.headers["expo-platform"]);
  const runtime = Name.safeParse(request.headers["expo-runtime-version"]);

  if (!platform.success || !runtime.success) {
    response.writeHead(400).end();

    return;
  }

  const runningUpdate = String(request.headers["expo-current-update-id"]);
  console.log(`${platform.data} ${runtime.data} runs ${runningUpdate}`);

  const manifest = await readFile(
    path.join(dir, platform.data, runtime.data, "manifest.json"),
  ).catch(() => null);

  if (manifest === null) {
    response.writeHead(204, headers).end();

    return;
  }

  response.writeHead(200, { ...headers, "content-type": "application/json" }).end(manifest);
};

const sendFile = async (
  dir: string,
  pathname: string,
  request: IncomingMessage,
  response: ServerResponse,
) => {
  const { folder, name } =
    /^\/(?<folder>assets|install)\/(?<name>[^/]+)$/u.exec(pathname)?.groups ?? {};

  const file =
    folder !== undefined && Name.safeParse(name).success
      ? path.join(dir, folder, String(name))
      : undefined;

  if (file === undefined || (await stat(file).catch(() => null)) === null) {
    response.writeHead(404).end();

    return;
  }

  const asset = folder === "assets";

  const gzip = asset && /\bgzip\b/u.test(request.headers["accept-encoding"] ?? "");
  response.writeHead(200, {
    "content-type": contentType(file.slice(file.lastIndexOf(".") + 1)),
    "cache-control": asset ? "public, max-age=31536000, immutable" : "no-cache",
    ...(gzip && { "content-encoding": "gzip" }),
  });
  const stream = createReadStream(file);
  await (gzip ? pipeline(stream, createGzip(), response) : pipeline(stream, response));
};

const main = async () => {
  const [command, ...args] = process.argv.slice(2);
  const dir = z.string().optional().parse(process.env.HEX_UPDATES_DIR);

  if (dir === undefined || dir === "") {
    throw new Error("HEX_UPDATES_DIR is not set");
  }

  if (command === "serve") {
    const port = Number(process.env.PORT ?? 8791);
    serve(dir).listen(port, "127.0.0.1", () => {
      console.log(`serving ${dir} on :${port}`);
    });
  } else if (command === "publish") {
    const [dist, platform, runtimeVersion, configPath] = z
      .tuple([z.string(), z.string(), z.string(), z.string()])
      .parse(args);

    const expoConfig: unknown = JSON.parse(await readFile(configPath, "utf-8"));

    if (!isExpoConfig(expoConfig)) {
      throw new Error(`${configPath} has no updates.url`);
    }

    const { id, published } = await publish({ dir, dist, platform, runtimeVersion, expoConfig });
    console.log(published ? `published update ${id}` : `update ${id} was already published`);
  } else {
    throw new Error("usage: store.mts serve | publish <dist> <platform> <runtime> <config.json>");
  }
};

if (import.meta.main) {
  void main();
}
