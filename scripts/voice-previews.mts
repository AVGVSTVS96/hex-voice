import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { VOICES, type LiveVoice } from '../src/live/voices';

const KEY = process.env.OPENAI_API_KEY;
const OUT = join(import.meta.dirname, '..', 'assets', 'voices');
const RATE = 24000;
const CHUNK_MS = 100;
// Output audio streams silence between turns and has no done event, so the transcript marks where
// the line ends: no new words for QUIET_MS, then audio up to the last word's end plus TAIL_MS.
const QUIET_MS = 1500;
const TAIL_MS = 600;

const previewLine = (name: string) => `Hi, I'm ${name}. Whenever you need me, I'm right here.`;

async function render(voice: LiveVoice, name: string) {
  // Node's WebSocket (undici) takes headers, which the DOM type it shares doesn't list.
  const socket = new WebSocket('wss://api.openai.com/v1/live/sessions', {
    headers: { Authorization: `Bearer ${KEY}` },
  } as unknown as string[]);
  const audio: Buffer[] = [];
  let transcript = '';
  let spokenUntil = 0;
  let received = 0;
  let quiet = false;
  let silence: NodeJS.Timeout | undefined;
  let pause: NodeJS.Timeout | undefined;

  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      if (!quiet || received < spokenUntil + TAIL_MS) return;
      quiet = false;
      clearInterval(silence);
      socket.send(JSON.stringify({ type: 'session.close' }));
      setTimeout(() => socket.close(), 500);
      resolve();
    };
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          type: 'session.start',
          session: {
            model: 'gpt-live-1',
            instructions:
              'You are recording a short voice sample. Say only the line you are given, warmly and naturally, in English, then stay silent.',
            delegation: { type: 'client' },
            audio: { format: { type: 'audio/pcm', rate: RATE }, output: { voice } },
          },
        }),
      );
    socket.onmessage = ({ data }) => {
      const event = JSON.parse(String(data));
      if (event.type === 'error') reject(new Error(`${voice}: ${JSON.stringify(event.error)}`));
      if (event.type === 'session.started') {
        const zeros = Buffer.alloc((RATE * 2 * CHUNK_MS) / 1000).toString('base64');
        silence = setInterval(
          () => socket.send(JSON.stringify({ type: 'session.input_audio.append', audio: zeros })),
          CHUNK_MS,
        );
        socket.send(
          JSON.stringify({
            type: 'session.instructions.append',
            delegation_id: null,
            content: `Immediately say exactly this, and nothing else: "${previewLine(name)}"`,
          }),
        );
      }
      if (event.type === 'session.output_transcript.delta') {
        transcript += event.delta;
        spokenUntil = event.end_ms;
        clearTimeout(pause);
        pause = setTimeout(() => {
          quiet = true;
          finish();
        }, QUIET_MS);
      }
      if (event.type === 'session.output_audio.delta') {
        const chunk = Buffer.from(event.delta, 'base64');
        audio.push(chunk);
        received += (chunk.length / 2 / RATE) * 1000;
        finish();
      }
    };
    socket.onerror = () => reject(new Error(`${voice}: socket error`));
  });

  const trim = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse';
  execFileSync(
    'ffmpeg',
    [
      ...`-loglevel error -y -f s16le -ar ${RATE} -ac 1 -i pipe:0`.split(' '),
      // Trim the silence around the line and match loudness, so swiping compares voices, not volume.
      ...['-af', `${trim},${trim},loudnorm=I=-18:TP=-1.5`],
      ...`-ar ${RATE} -c:a aac -b:a 64k`.split(' '),
      join(OUT, `${voice}.m4a`),
    ],
    { input: Buffer.concat(audio) },
  );
  console.log(`${voice}: ${transcript.trim()}`);
}

if (!KEY) throw new Error('Set OPENAI_API_KEY.');
const only = process.argv.slice(2);
for (const { id, label } of VOICES) if (!only.length || only.includes(id)) await render(id, label);
