// The app's over-the-air update store: `publish` adds an `expo export` to it, `serve` answers the
// app over the Expo Updates protocol (https://docs.expo.dev/technical-specs/expo-updates-1/).
//
//   <dir>/assets/<sha256>.<ext>          every published file, content-addressed and immutable
//   <dir>/<platform>/<runtime>/          a runtime with a native build (made by ship-native)
//   <dir>/<platform>/<runtime>/manifest.json   its latest update
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

const CONTENT_TYPES: Record<string, string> = {
  hbc: 'application/javascript',
  js: 'application/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  otf: 'font/otf',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
};
const contentType = (ext: string) => CONTENT_TYPES[ext] ?? 'application/octet-stream';
const NAME = /^\w[\w.-]*$/;

type ExportMetadata = {
  fileMetadata: Record<string, { bundle: string; assets: { path: string; ext: string }[] }>;
};

export type Publish = {
  dir: string;
  dist: string;
  platform: string;
  runtimeVersion: string;
  expoConfig: { updates: { url: string } };
};

export async function publish({ dir, dist, platform, runtimeVersion, expoConfig }: Publish) {
  const runtime = join(dir, platform, runtimeVersion);
  if (!(await stat(runtime).catch(() => null))) {
    throw new Error(`no native build has runtime ${runtimeVersion}`);
  }
  const metadata = await readFile(join(dist, 'metadata.json'));
  const { bundle, assets } = (JSON.parse(metadata.toString()) as ExportMetadata).fileMetadata[
    platform
  ];
  await mkdir(join(dir, 'assets'), { recursive: true });

  const add = async (path: string, ext: string) => {
    const data = await readFile(join(dist, path));
    const hash = createHash('sha256').update(data).digest('base64url');
    const name = `${hash}.${ext}`;
    await replace(join(dir, 'assets', name), data);
    return {
      hash,
      key: createHash('md5').update(data).digest('hex'),
      contentType: contentType(ext),
      url: new URL(`assets/${name}`, expoConfig.updates.url).href,
    };
  };

  const id = createHash('sha256').update(runtimeVersion).update(metadata).digest('hex');
  const manifest = {
    id: [
      id.slice(0, 8),
      id.slice(8, 12),
      id.slice(12, 16),
      id.slice(16, 20),
      id.slice(20, 32),
    ].join('-'),
    createdAt: new Date().toISOString(),
    runtimeVersion,
    launchAsset: await add(bundle, 'hbc'),
    assets: await Promise.all(
      assets.map(async ({ path, ext }) => ({
        ...(await add(path, ext)),
        fileExtension: `.${ext}`,
      })),
    ),
    metadata: {},
    extra: { expoClient: expoConfig },
  };
  await replace(join(runtime, 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}

async function replace(path: string, data: string | Buffer) {
  const temporary = `${path}.${process.pid}`;
  await writeFile(temporary, data);
  await rename(temporary, path);
}

export function serve(dir: string) {
  return createServer(async (request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    try {
      if (pathname === '/manifest') await sendManifest(dir, request, response);
      else await sendAsset(dir, pathname, request, response);
    } catch (error) {
      console.error(error);
      if (!response.headersSent) response.writeHead(500);
      response.end();
    }
  });
}

async function sendManifest(dir: string, request: IncomingMessage, response: ServerResponse) {
  const headers = {
    'expo-protocol-version': '1',
    'expo-sfv-version': '0',
    'cache-control': 'private, max-age=0',
  };
  const platform = request.headers['expo-platform'];
  const runtime = request.headers['expo-runtime-version'];
  if (typeof platform !== 'string' || !NAME.test(platform)) return response.writeHead(400).end();
  if (typeof runtime !== 'string' || !NAME.test(runtime)) return response.writeHead(400).end();
  const manifest = await readFile(join(dir, platform, runtime, 'manifest.json')).catch(() => null);
  if (!manifest) return response.writeHead(204, headers).end();
  response.writeHead(200, { ...headers, 'content-type': 'application/json' }).end(manifest);
}

async function sendAsset(
  dir: string,
  pathname: string,
  request: IncomingMessage,
  response: ServerResponse,
) {
  const name = pathname.match(/^\/assets\/([^/]+)$/)?.[1];
  const path = name && NAME.test(name) ? join(dir, 'assets', name) : undefined;
  if (!path || !(await stat(path).catch(() => null))) return response.writeHead(404).end();
  const gzip = /\bgzip\b/.test(request.headers['accept-encoding'] ?? '');
  response.writeHead(200, {
    'content-type': contentType(path.split('.').pop()!),
    'cache-control': 'public, max-age=31536000, immutable',
    ...(gzip && { 'content-encoding': 'gzip' }),
  });
  const file = createReadStream(path);
  await (gzip ? pipeline(file, createGzip(), response) : pipeline(file, response));
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const dir = process.env.HEX_UPDATES_DIR;
  if (!dir) throw new Error('HEX_UPDATES_DIR is not set');
  if (command === 'serve') {
    const port = Number(process.env.PORT ?? 8791);
    serve(dir).listen(port, '127.0.0.1', () => console.log(`serving ${dir} on :${port}`));
  } else if (command === 'publish') {
    const [dist, platform, runtimeVersion, configPath] = args;
    const expoConfig = JSON.parse(await readFile(configPath, 'utf8'));
    const { id, launchAsset } = await publish({ dir, dist, platform, runtimeVersion, expoConfig });
    console.log(`published update ${id} (${launchAsset.url})`);
  } else {
    throw new Error('usage: store.mts serve | publish <dist> <platform> <runtime> <config.json>');
  }
}

if (import.meta.main) void main();
