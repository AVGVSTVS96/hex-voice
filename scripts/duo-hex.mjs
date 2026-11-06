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
// and come back from /media/<id> (a clip as duo-media.jpg, standing in for its still); an id it
// never saw, like one a kept chat names, comes back as duo-media.jpg too.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createSecureServer } from 'node:http2';

const { DUO_HEX_PORT, DUO_HEX_ANSWERS, DUO_HEX_REPLAY, DUO_HEX_ALSO, DUO_HEX_DOWN, DUO_HEX_TLS } =
  process.env;
const { EXPO_PUBLIC_HEX_URL, EXPO_PUBLIC_HEX_TOKEN } = process.env;
// hex says what an answer, a note or a not needed reached; a dropped one reached nothing.
const SAYS_WHAT_IT_REACHED = /^\/asks\/[^/?]+\/(answer|note|dismiss)(\?|$)/;
const NOTHING = JSON.stringify({ thread: '', topic: '', settled: 0, missed: 0 });
const answers = existsSync(DUO_HEX_ANSWERS)
  ? JSON.parse(readFileSync(DUO_HEX_ANSWERS, 'utf8'))
  : {};
const also = Object.fromEntries(
  Object.entries(DUO_HEX_ALSO ? JSON.parse(readFileSync(DUO_HEX_ALSO, 'utf8')) : {}).map(
    ([path, answer]) => [path, JSON.stringify(answer)],
  ),
);

const sample = {
  type: 'image/jpeg',
  body: readFileSync(new URL('duo-media.jpg', import.meta.url)),
};
const media = new Map();
const MEDIA = /^\/media(?:\/([^/?]+))?(?:\?|$)/;

const tls = {
  key: readFileSync(`${DUO_HEX_TLS}/key.pem`),
  cert: readFileSync(`${DUO_HEX_TLS}/cert.pem`),
  allowHTTP1: true,
};

createSecureServer(tls, async (request, response) => {
  const shared = (request.url ?? '').match(MEDIA);
  if (shared && request.method === 'POST' && !shared[1]) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const type = request.headers['content-type'] ?? 'image/jpeg';
    const kind = type.startsWith('video/') ? 'video' : 'photo';
    const id = `duo-${media.size + 1}`;
    media.set(id, kind === 'video' ? sample : { type, body: Buffer.concat(chunks) });
    response
      .writeHead(201, { 'content-type': 'application/json' })
      .end(JSON.stringify({ id, kind }));
    return;
  }
  if (shared?.[1] && request.method === 'GET') {
    const { type, body } = media.get(decodeURIComponent(shared[1])) ?? sample;
    response.writeHead(200, { 'content-type': type }).end(body);
    return;
  }
  if (request.method !== 'GET') {
    request.resume();
    if (SAYS_WHAT_IT_REACHED.test(request.url ?? ''))
      response.writeHead(200, { 'content-type': 'application/json' }).end(NOTHING);
    else response.writeHead(204).end();
    return;
  }
  if (DUO_HEX_DOWN && existsSync(DUO_HEX_DOWN)) {
    request.socket.destroy();
    return;
  }
  const url = new URL(request.url, 'http://hex');
  const watch = url.searchParams.has('after');
  if (DUO_HEX_REPLAY) {
    if (watch) return;
    const kept = also[url.pathname] ?? answers[url.pathname];
    if (kept === undefined) response.writeHead(404).end();
    else response.writeHead(200, { 'content-type': 'application/json' }).end(kept);
    return;
  }
  try {
    const upstream = await fetch(EXPO_PUBLIC_HEX_URL + request.url, {
      headers: { authorization: `Bearer ${EXPO_PUBLIC_HEX_TOKEN}` },
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    });
    response.end(body);
    if (upstream.ok && !watch) {
      answers[url.pathname] = body.toString();
      writeFileSync(DUO_HEX_ANSWERS, JSON.stringify(answers));
    }
  } catch {
    response.writeHead(502).end();
  }
}).listen(Number(DUO_HEX_PORT), '127.0.0.1');
