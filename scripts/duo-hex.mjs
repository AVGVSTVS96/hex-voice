// Stands in for hex's voice server while scripts/duo checks the app, on the Mac beside the
// simulator. Reads go to the real server, so the screens show his real tasks. Every write
// (answering, noting, undoing, acting, starting a call) is answered here and dropped, so a check can
// never answer or act for him. The app under check only knows this address and a dummy token.
import { createServer } from 'node:http';

const { DUO_HEX_PORT, EXPO_PUBLIC_HEX_URL, EXPO_PUBLIC_HEX_TOKEN } = process.env;
// hex says what an answer, a note or a not needed reached; a dropped one reached nothing.
const SAYS_WHAT_IT_REACHED = /^\/asks\/[^/?]+\/(answer|note|dismiss)(\?|$)/;
const NOTHING = JSON.stringify({ thread: '', topic: '', settled: 0, missed: 0 });

createServer(async (request, response) => {
  if (request.method !== 'GET') {
    request.resume();
    if (SAYS_WHAT_IT_REACHED.test(request.url ?? ''))
      response.writeHead(200, { 'content-type': 'application/json' }).end(NOTHING);
    else response.writeHead(204).end();
    return;
  }
  try {
    const upstream = await fetch(EXPO_PUBLIC_HEX_URL + request.url, {
      headers: { authorization: `Bearer ${EXPO_PUBLIC_HEX_TOKEN}` },
    });
    response.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    });
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    response.writeHead(502).end();
  }
}).listen(Number(DUO_HEX_PORT), '127.0.0.1');
