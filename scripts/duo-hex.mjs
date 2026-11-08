// Stands in for hex's voice server while scripts/duo checks the app, on the Mac beside the
// simulator. Reads go to the real server, so the screens show his real tasks, and each answer is
// kept in DUO_HEX_ANSWERS by path. With DUO_HEX_REPLAY set, reads are answered from that file
// instead, so both sides of a before/after see the same lists and a check runs while hex is slow;
// a watch (?after=) then gets no answer, as hex gives none until something changes. DUO_HEX_ALSO
// names a file of a run's own answers by path, which replay gives ahead of the kept ones. While
// the file DUO_HEX_DOWN exists, every read is dropped, as when hex can't be reached. Every write
// (answering, noting, undoing, acting, starting a call) is answered here and dropped, so a check can
// never answer or act for him. The app under check only knows this address and a dummy token.
// It speaks HTTPS with HTTP/2, as hex does, under a root only the simulator trusts (DUO_HEX_TLS):
// the app keeps several watches open at once, and over HTTP/1.1 iOS gives a host 4 connections, so
// every other read would wait behind them. Photos and clips sent to /media stay here, in memory,
// under hex's rules: only its types (415 for any other), a JPEG or PNG back as it came and any
// other photo or a clip as a JPEG, here duo-media.jpg; an id it never saw, like one a kept
// chat names, comes back as duo-media.jpg too. A call (one id or several) or a thread sent an
// id it never gave out answers 400, as hex does.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createSecureServer } from 'node:http2';

const { DUO_HEX_PORT, DUO_HEX_ANSWERS, DUO_HEX_REPLAY, DUO_HEX_ALSO, DUO_HEX_DOWN, DUO_HEX_TLS } =
  process.env;

const { EXPO_PUBLIC_HEX_URL, EXPO_PUBLIC_HEX_TOKEN } = process.env;

// hex says what an answer, a note or a not needed reached; a dropped one reached nothing.
const SAYS_WHAT_IT_REACHED = /^\/asks\/[^/?]+\/(?:answer|note|dismiss)(?:\?|$)/u;
const REACHED_NOTHING = JSON.stringify({ thread: '', topic: '', settled: 0, missed: 0 });

const answers = existsSync(DUO_HEX_ANSWERS)
  ? JSON.parse(readFileSync(DUO_HEX_ANSWERS, 'utf-8'))
  : {};

const ownAnswers = Object.fromEntries(
  Object.entries(DUO_HEX_ALSO ? JSON.parse(readFileSync(DUO_HEX_ALSO, 'utf-8')) : {}).map(
    ([path, answer]) => [path, JSON.stringify(answer)],
  ),
);

const standInJpeg = {
  type: 'image/jpeg',
  body: readFileSync(new URL('duo-media.jpg', import.meta.url)),
};

const media = new Map();
const MEDIA = /^\/media(?:\/(?<id>[^/?]+))?(?:\?|$)/u;

const HEX_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/gif',
  'image/webp',
  'image/tiff',
  'image/avif',
  'video/mp4',
  'video/quicktime',
];

const KEPT_AS_SENT = new Set(['image/jpeg', 'image/png']);
const SENDS_MEDIA = /^\/(?:calls|tasks)\/[^/?]+\/(?:media|chat)(?:\?|$)/u;

const bodyOf = async (request) => {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
};

// The ids a call's or a thread's write names: { media: id } or { media: [ids] }.
const mediaIdsNamed = (body) => {
  try {
    const { media: ids } = JSON.parse(body.toString());

    return ids === undefined ? [] : [ids].flat();
  } catch {
    return [];
  }
};

const tls = {
  key: readFileSync(`${DUO_HEX_TLS}/key.pem`),
  cert: readFileSync(`${DUO_HEX_TLS}/cert.pem`),
  allowHTTP1: true,
};

const keepMedia = async (request, response) => {
  const body = await bodyOf(request);
  const type = request.headers['content-type'] ?? '';

  if (!HEX_MEDIA_TYPES.includes(type)) {
    response
      .writeHead(415)
      .end(`hex takes ${HEX_MEDIA_TYPES.join(', ')}, not ${type === '' ? 'no type' : type}`);

    return;
  }

  const kind = type.startsWith('video/') ? 'video' : 'photo';
  const id = `duo-${media.size + 1}`;
  media.set(id, KEPT_AS_SENT.has(type) ? { type, body } : standInJpeg);
  response.writeHead(201, { 'content-type': 'application/json' }).end(JSON.stringify({ id, kind }));
};

const giveMedia = (id, response) => {
  const { type, body } = media.get(decodeURIComponent(id)) ?? standInJpeg;
  response.writeHead(200, { 'content-type': type }).end(body);
};

const checkMediaNamed = async (request, response) => {
  const neverGivenOut = mediaIdsNamed(await bodyOf(request)).filter((id) => !media.has(id));

  if (neverGivenOut.length) {
    response.writeHead(400).end(`no media ${neverGivenOut.join(', ')}`);
  } else {
    response.writeHead(204).end();
  }
};

const dropWrite = (request, response) => {
  request.resume();

  if (SAYS_WHAT_IT_REACHED.test(request.url ?? '')) {
    response.writeHead(200, { 'content-type': 'application/json' }).end(REACHED_NOTHING);
  } else {
    response.writeHead(204).end();
  }
};

const replay = (url, response) => {
  const waitsForChange = url.searchParams.has('after');

  if (waitsForChange) {
    return;
  }

  const kept = ownAnswers[url.pathname] ?? answers[url.pathname];

  if (kept === undefined) {
    response.writeHead(404).end();
  } else {
    response.writeHead(200, { 'content-type': 'application/json' }).end(kept);
  }
};

const forward = async (request, url, response) => {
  try {
    const upstream = await fetch(EXPO_PUBLIC_HEX_URL + request.url, {
      headers: { authorization: `Bearer ${EXPO_PUBLIC_HEX_TOKEN}` },
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    });
    response.end(body);

    if (upstream.ok && !url.searchParams.has('after')) {
      answers[url.pathname] = body.toString();
      writeFileSync(DUO_HEX_ANSWERS, JSON.stringify(answers));
    }
  } catch {
    response.writeHead(502).end();
  }
};

const respond = async (request, response) => {
  const mediaPath = MEDIA.exec(request.url ?? '')?.groups;

  if (mediaPath && request.method === 'POST' && !mediaPath.id) {
    await keepMedia(request, response);

    return;
  }

  if (mediaPath?.id && request.method === 'GET') {
    giveMedia(mediaPath.id, response);

    return;
  }

  if (request.method === 'POST' && SENDS_MEDIA.test(request.url ?? '')) {
    await checkMediaNamed(request, response);

    return;
  }

  if (request.method !== 'GET') {
    dropWrite(request, response);

    return;
  }

  if (DUO_HEX_DOWN && existsSync(DUO_HEX_DOWN)) {
    request.socket.destroy();

    return;
  }

  const url = new URL(request.url, 'http://hex');

  if (DUO_HEX_REPLAY) {
    replay(url, response);

    return;
  }

  await forward(request, url, response);
};

createSecureServer(tls, (request, response) => {
  void respond(request, response);
}).listen(Number(DUO_HEX_PORT), '127.0.0.1');
