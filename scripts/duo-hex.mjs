// Stands in for hex's voice server while scripts/duo checks the app, on the Mac beside the
// simulator. Reads go to the real server, so the screens show his real tasks. Every write
// (answering, undoing, acting, starting a call) is answered here and dropped, so a check can
// never answer or act for him. The app under check only knows this address and a dummy token.
import { createServer } from 'node:http';

const { DUO_HEX_PORT, EXPO_PUBLIC_HEX_URL, EXPO_PUBLIC_HEX_TOKEN } = process.env;

createServer(async (request, response) => {
  if (request.method !== 'GET') {
    request.resume();
    response.writeHead(204).end();
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
