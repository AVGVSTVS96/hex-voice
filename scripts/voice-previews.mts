import { execFileSync } from "node:child_process";
import path from "node:path";

import type { WebSocket as UndiciWebSocket } from "undici-types";
import * as z from "zod";

import { VOICES } from "../src/live/voices";
import type { LiveVoice } from "../src/live/voices";

const KEY = z.string().optional().parse(process.env.OPENAI_API_KEY);

if (KEY === undefined || KEY === "") {
  throw new Error("Set OPENAI_API_KEY.");
}

const OUT = path.join(import.meta.dirname, "..", "assets", "voices");
const RATE = 24_000;
const CHUNK_MS = 100;

const LINE_ENDS_AFTER_QUIET_MS = 1500;
const AUDIO_PAST_LAST_WORD_MS = 600;

const ServerEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("error"), error: z.unknown() }),
  z.object({ type: z.literal("session.started") }),
  z.object({
    type: z.literal("session.output_transcript.delta"),
    delta: z.string(),
    end_ms: z.optional(z.number()),
  }),
  z.object({ type: z.literal("session.output_audio.delta"), delta: z.string() }),
]);

// SAFETY: Node's global WebSocket is undici's, which takes headers.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the DOM lib types Node's global WebSocket without the headers undici's constructor takes, and this script needs them
const NodeWebSocket = WebSocket as typeof UndiciWebSocket;

const previewLine = (name: string) => `Hi, I'm ${name}. Whenever you need me, I'm right here.`;

const render = async (voice: LiveVoice, name: string) => {
  const socket = new NodeWebSocket("wss://api.openai.com/v1/live/sessions", {
    headers: { Authorization: `Bearer ${KEY}` },
  });

  const audio: Buffer[] = [];
  let transcript = "";
  let spokenUntil = 0;
  let received = 0;
  let quiet = false;
  let silence: NodeJS.Timeout | undefined;
  let pause: NodeJS.Timeout | undefined;

  const spoken = Promise.withResolvers<undefined>();

  const finish = () => {
    if (!quiet || received < spokenUntil + AUDIO_PAST_LAST_WORD_MS) {
      return;
    }

    quiet = false;
    clearInterval(silence);
    socket.send(JSON.stringify({ type: "session.close" }));
    setTimeout(() => {
      socket.close();
    }, 500);
    spoken.resolve(undefined);
  };

  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify({
        type: "session.start",
        session: {
          model: "gpt-live-1",
          instructions:
            "You are recording a short voice sample. Say only the line you are given, warmly and naturally, in English, then stay silent.",
          delegation: { type: "client" },
          audio: { format: { type: "audio/pcm", rate: RATE }, output: { voice } },
        },
      }),
    );
  });

  socket.addEventListener("message", ({ data }) => {
    const parsed = ServerEvent.safeParse(JSON.parse(String(data)));

    if (!parsed.success) {
      return;
    }

    const event = parsed.data;

    if (event.type === "error") {
      spoken.reject(new Error(`${voice}: ${JSON.stringify(event.error)}`));
    }

    if (event.type === "session.started") {
      const zeros = Buffer.alloc((RATE * 2 * CHUNK_MS) / 1000).toString("base64");
      silence = setInterval(() => {
        socket.send(JSON.stringify({ type: "session.input_audio.append", audio: zeros }));
      }, CHUNK_MS);
      socket.send(
        JSON.stringify({
          type: "session.instructions.append",
          delegation_id: null,
          content: `Immediately say exactly this, and nothing else: "${previewLine(name)}"`,
        }),
      );
    }

    if (event.type === "session.output_transcript.delta") {
      transcript += event.delta;
      spokenUntil = event.end_ms ?? spokenUntil;
      clearTimeout(pause);
      pause = setTimeout(() => {
        quiet = true;
        finish();
      }, LINE_ENDS_AFTER_QUIET_MS);
    }

    if (event.type === "session.output_audio.delta") {
      const chunk = Buffer.from(event.delta, "base64");
      audio.push(chunk);
      received += (chunk.length / 2 / RATE) * 1000;
      finish();
    }
  });

  socket.addEventListener("error", () => {
    spoken.reject(new Error(`${voice}: socket error`));
  });

  await spoken.promise;

  const trim = "silenceremove=start_periods=1:start_threshold=-50dB,areverse";
  const trimmedToOneLoudness = `${trim},${trim},loudnorm=I=-18:TP=-1.5`;
  execFileSync(
    "ffmpeg",
    [
      ...`-loglevel error -y -f s16le -ar ${RATE} -ac 1 -i pipe:0`.split(" "),
      "-af",
      trimmedToOneLoudness,
      ...`-ar ${RATE} -c:a aac -b:a 64k`.split(" "),
      path.join(OUT, `${voice}.m4a`),
    ],
    { input: Buffer.concat(audio) },
  );
  console.log(`${voice}: ${transcript.trim()}`);
};

const only = process.argv.slice(2);

for (const { id, label } of VOICES) {
  if (!only.length || only.includes(id)) {
    // oxlint-disable-next-line no-await-in-loop -- one live session at a time, so the voices render and log in order without hitting OpenAI's concurrent-session limit
    await render(id, label);
  }
}
