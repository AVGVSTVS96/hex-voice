import assert from "node:assert/strict";
import test from "node:test";

import * as z from "zod";

import { createHex } from "../src/hex/api";
import { RefusedError, createClient } from "../src/hex/client";
import { AskId } from "../src/live/asks";
import { CallId } from "../src/live/calls";
import { MediaId } from "../src/live/media";
import { TaskId } from "../src/live/tasks";
import { nth } from "./nth";

const hexUrl = "https://hex.example:8790";

const Json = z.json();

type Json = z.infer<typeof Json>;

type Fetch = typeof globalThis.fetch;

const hexAt = (fetch: Fetch, token?: string, at = hexUrl) =>
  createHex(createClient({ url: at, token, fetch }));

const urlOf = (input: RequestInfo | URL) => (input instanceof Request ? input.url : String(input));

const answering = (body: Json, seen?: { url: string; init: RequestInit | undefined }[]) =>
  hexAt(async (input, init) => {
    seen?.push({ url: urlOf(input), init });

    return body === null ? new Response(null, { status: 204 }) : Response.json(body);
  });

const sentText = (init?: RequestInit) => z.string().parse(init?.body);
const sentJson = (init?: RequestInit) => Json.parse(JSON.parse(sentText(init)));
const sentTextIfAny = (init?: RequestInit) => z.string().nullish().parse(init?.body) ?? "";

const answerWith = async (response: Response) =>
  await hexAt(async () => response).asks.answer(AskId.parse("a"), "Yes");

const live = CallId.parse("live_1");
const thread = TaskId.parse("telegram:-100:908");
const summary = { id: "live_1", started: "2026-10-14T06:00:00.000Z", from: "app" };

test("a build without the hex address says how to set it and asks nothing", async () => {
  await Promise.all(
    [undefined, "", "   "].map(async (missing) => {
      const hex = createHex(
        createClient({
          url: missing,
          fetch: async () => assert.fail("a build without the hex address asks nothing"),
        }),
      );

      await assert.rejects(hex.calls.list(), /EXPO_PUBLIC_HEX_URL/u);
      await assert.rejects(hex.session.create("offer"), /EXPO_PUBLIC_HEX_URL/u);
    }),
  );
});

test("sends the offer and voice to hex and reads OpenAI’s session back", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];

  const hex = hexAt(
    async (input, init) => {
      seen.push({ url: urlOf(input), init });

      return Response.json(
        { session: { id: "live_1", model: "gpt-live-1" }, transport: { sdp: "answer" } },
        { status: 201 },
      );
    },
    undefined,
    `${hexUrl}//`,
  );

  assert.deepEqual(await hex.session.create("offer", "cedar"), { sdp: "answer", sessionId: live });
  assert.equal(nth(seen, 0).url, `${hexUrl}/session`);
  assert.equal(nth(seen, 0).init?.method, "POST");
  assert.deepEqual(sentJson(nth(seen, 0).init), {
    sdp: "offer",
    voice: "cedar",
    from: "app",
  });
});

test("a call started from a task or for your asks tells hex which", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const hex = answering({ session: { id: "live_1" }, transport: { sdp: "answer" } }, seen);
  await hex.session.create("offer", "cedar", { task: thread });
  await hex.session.create("offer", "cedar", "asks");
  assert.deepEqual(
    seen.map(({ init }) => z.object({ about: z.string() }).parse(sentJson(init)).about),
    [thread, "asks"],
  );
});

test("ends a call, and marks when the phone takes its audio and gives it back", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const hex = answering(null, seen);
  await hex.session.close(live);
  await hex.session.mark?.(live, "paused");
  assert.deepEqual(
    seen.map(({ url, init }) => [init?.method, url, sentJson(init)]),
    [
      ["DELETE", `${hexUrl}/session`, { sessionId: "live_1" }],
      ["POST", `${hexUrl}/calls/live_1/moments`, { kind: "paused" }],
    ],
  );
});

test("shows hex’s and OpenAI’s errors as they are", async () => {
  const plain = hexAt(async () => new Response("Set OPENAI_API_KEY", { status: 503 }));
  await assert.rejects(plain.session.create("offer"), /Set OPENAI_API_KEY/u);

  const openai = hexAt(async () =>
    Response.json({ error: { message: "Invalid voice" } }, { status: 400 }),
  );

  await assert.rejects(openai.session.create("offer"), /^RefusedError: Invalid voice$/u);
});

test("an answer this app can’t read names where, instead of reaching the screen", async () => {
  await assert.rejects(
    answering({ session: {} }).session.create("offer"),
    /hex sent \/session in a shape this app can’t read \(session\.id\)/u,
  );
  await assert.rejects(answering({ version: 1, calls: [{ id: 3 }] }).calls.list(), /calls\.0/u);
});

test("hex turning a request down is a refusal in its own words; its own failure is not", async () => {
  await assert.rejects(
    answerWith(new Response("that question is already answered or settled", { status: 409 })),
    (error) =>
      error instanceof RefusedError &&
      error.status === 409 &&
      error.message === "That question is already answered or settled",
  );
  await assert.rejects(
    answerWith(new Response("hub is down", { status: 502 })),
    (error) =>
      !(error instanceof RefusedError) && error instanceof Error && error.message === "Hub is down",
  );
});

test("a thread hex has no steps for is refused as not there, so it isn't asked for again", async () => {
  const hex = hexAt(async () => new Response("no such task", { status: 404 }));
  await assert.rejects(
    hex.tasks.get(thread),
    (error) => error instanceof RefusedError && error.status === 404,
  );
});

test("an unreachable hex points at Tailscale", async () => {
  const hex = hexAt(async () => {
    throw new TypeError("Network request failed");
  });

  await assert.rejects(hex.session.create("offer"), /Tailscale/u);
  await assert.rejects(hex.activity.watch(undefined, new AbortController().signal), /Tailscale/u);
});

test("every request carries the hex token when the app has one", async () => {
  const seen: (string | null)[] = [];

  const fetch: Fetch = async (_input, init) => {
    seen.push(new Headers(init?.headers).get("authorization"));

    return Response.json({ version: 1, call: null, tasks: [] });
  };

  const { signal } = new AbortController();
  await hexAt(fetch, "secret").session.close(live);
  await hexAt(fetch, "secret").activity.watch(undefined, signal);
  await hexAt(fetch).session.close(live);
  assert.deepEqual(seen, ["Bearer secret", "Bearer secret", null]);
});

test("lists are asked for, then waited on from the version they last saw", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const { signal } = new AbortController();
  await answering({ version: 7, live: "live_2", calls: [] }, seen).calls.list();
  await answering({ version: 7, calls: [] }, seen).calls.list(7);
  await answering({ version: 8, turns: [], tasks: [], ...summary }, seen).calls.get(live, 8);
  await answering({ version: 7, call: "live_1", tasks: [] }, seen).activity.watch(7, signal);
  await answering({ version: 7, tasks: [] }, seen).tasks.list(7);
  await answering({ version: 3, needs: 1, working: 2 }, seen).tasks.counts(2);
  await answering({ version: 4, sends: true, total: 0, turns: [], waiting: [] }, seen).tasks.chat(
    thread,
    4,
  );
  await answering({ version: 5, asks: [], stuck: [], fresh: [], check: null }, seen).asks.list(5);
  assert.deepEqual(
    seen.map(({ url }) => url.slice(url.indexOf("/", 8))),
    [
      "/calls",
      "/calls?after=7",
      "/calls/live_1?after=8",
      "/activity?after=7",
      "/tasks?after=7",
      "/tasks/summary?after=2",
      "/tasks/telegram%3A-100%3A908/chat?after=4",
      "/asks?after=5",
    ],
  );
});

test("closing a list stops its waiting request as it is", async () => {
  const controller = new AbortController();

  const hex = hexAt(async (_input, init) => {
    const aborted = Promise.withResolvers<Response>();
    init?.signal?.addEventListener("abort", () => {
      aborted.reject(new DOMException("", "AbortError"));
    });

    return await aborted.promise;
  });

  const waiting = hex.calls.list(7, controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: "AbortError" });
});

test("each tap goes to hex where it belongs, by id", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const hex = answering(null, seen);
  await hex.calls.remove(live);
  await hex.tasks.talk(thread);
  await hex.tasks.send(thread, "Ship it", "app-1");
  await hex.tasks.stop(thread);
  await hex.asks.undo(AskId.parse("check:music"));
  await hex.asks.act("t3-limit");
  await hex.asks.read("fresh-1");
  await hex.asks.talk();
  assert.deepEqual(
    seen.map(({ url, init }) =>
      `${init?.method} ${url.slice(url.indexOf("/", 8))} ${sentTextIfAny(init)}`.trim(),
    ),
    [
      "DELETE /calls/live_1",
      "POST /tasks/telegram%3A-100%3A908/talk",
      'POST /tasks/telegram%3A-100%3A908/chat {"text":"Ship it","key":"app-1"}',
      "POST /tasks/telegram%3A-100%3A908/stop",
      "POST /asks/check%3Amusic/undo",
      "POST /stuck/t3-limit/act",
      "POST /fresh/fresh-1/read",
      "POST /asks/talk",
    ],
  );
});

test("an answer, a note and a not needed each go to their ask and say what they reached", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];
  const reached = { thread: "telegram:-100:1", topic: "hex", settled: 2, missed: 1 };
  const hex = answering(reached, seen);
  const ask = AskId.parse("telegram:-100:1:7");
  assert.deepEqual(await hex.asks.answer(ask, "Deep"), reached);
  assert.deepEqual(await hex.asks.note(ask, "Only if it ships today"), reached);
  assert.deepEqual(await hex.asks.dismiss(ask), reached);
  assert.deepEqual(
    seen.map(({ url, init }) =>
      `${init?.method} ${url.slice(url.indexOf("/", 8))} ${sentTextIfAny(init)}`.trim(),
    ),
    [
      'POST /asks/telegram%3A-100%3A1%3A7/answer {"label":"Deep"}',
      'POST /asks/telegram%3A-100%3A1%3A7/note {"text":"Only if it ships today"}',
      "POST /asks/telegram%3A-100%3A1%3A7/dismiss",
    ],
  );
  await assert.rejects(answering(null).asks.note(ask, "x"), /asks\/.*note/u);
});

test("a photo goes to hex as its bytes, and to a call or a thread by the ids hex gave it", async () => {
  const seen: { url: string; init: RequestInit | undefined }[] = [];

  const hex = createHex(
    createClient({
      url: hexUrl,
      token: "secret",
      sendFile: async (to, file, { headers }) => {
        seen.push({ url: to, init: { headers, body: `file ${file.uri}` } });

        return { status: 201, text: JSON.stringify({ id: `m${seen.length}`, kind: "photo" }) };
      },
      fetch: async (input, init) => {
        seen.push({ url: urlOf(input), init });

        return new Response(null, { status: 204 });
      },
    }),
  );

  const photo = { uri: "file:///shot.jpg", kind: "photo" as const, type: "image/jpeg" };
  assert.deepEqual(await hex.media.upload(photo), { id: "m1", kind: "photo" });
  await hex.calls.media(live, [MediaId.parse("m2")]);
  await hex.tasks.send(thread, "", "app-2", [photo, photo]);
  assert.deepEqual(
    await Promise.all(
      seen.map(async ({ url, init }) => [
        url.slice(url.indexOf("/", 8)),
        new Headers(init?.headers).get("content-type"),
        init?.body,
      ]),
    ),
    [
      ["/media", "image/jpeg", "file file:///shot.jpg"],
      ["/calls/live_1/media", "application/json", '{"media":["m2"]}'],
      ["/media", "image/jpeg", "file file:///shot.jpg"],
      ["/media", "image/jpeg", "file file:///shot.jpg"],
      [
        "/tasks/telegram%3A-100%3A908/chat",
        "application/json",
        '{"text":"","key":"app-2","media":["m3","m4"]}',
      ],
    ],
  );
  assert.deepEqual(hex.media.image(MediaId.parse("m1")), {
    uri: `${hexUrl}/media/m1`,
    headers: { Authorization: "Bearer secret" },
  });
});
