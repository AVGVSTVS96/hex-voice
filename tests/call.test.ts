import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buttonsOf,
  callIdOf,
  callOf,
  errorOf,
  footerOf,
  personaOf,
  showsWords,
  statusOf,
  voiceLocked,
  wakeOf,
  wordsOf,
  type Call,
} from '../src/call/call';
import { CallId, type CallRecord } from '../src/live/calls';
import type { LiveSnapshot, TranscriptEntry } from '../src/live/types';

const words: TranscriptEntry[] = [{ id: 'user-0', role: 'user', text: 'Hi hex', startMs: 0 }];

function session(change: Partial<LiveSnapshot> = {}): LiveSnapshot {
  return {
    status: 'idle',
    error: null,
    muted: false,
    inputLevel: 0,
    outputLevel: 0,
    elapsedSeconds: 0,
    transcript: [],
    callId: null,
    ending: null,
    interrupted: false,
    ...change,
  };
}

const sess = CallId.parse('sess_1');

function record(change: Partial<CallRecord> = {}): CallRecord {
  return {
    id: CallId.parse('phone_1'),
    from: 'phone-out',
    started: '2026-11-03T08:00:00.000Z',
    turns: [{ who: 'voice', at: 0, text: 'Hey, it is hex' }],
    tasks: [],
    ...change,
  };
}

const nobody = { leaving: false };
const live = (change: Partial<LiveSnapshot> = {}) =>
  callOf(session({ status: 'connected', callId: sess, transcript: words, ...change }), nobody);
const seen = (call: Call, viewing = false) => ({
  persona: personaOf(call, false),
  wake: wakeOf(call),
  status: statusOf(call),
  buttons: buttonsOf(call),
  words: showsWords(call, { viewing, cards: 0 }),
  footer: footerOf(call, viewing),
  error: errorOf(call),
  voiceLocked: voiceLocked(call),
});

test('before any call the orb rests asleep and alone, ready to start', () => {
  assert.deepEqual(seen(callOf(session(), nobody)), {
    persona: 'idle',
    wake: 0,
    status: 'Ready to start a conversation',
    buttons: { call: 'start', mute: undefined },
    words: false,
    footer: undefined,
    error: undefined,
    voiceLocked: false,
  });
});

test('connecting here locks the voice, thinks, and offers to cancel', () => {
  assert.deepEqual(seen(callOf(session({ status: 'connecting' }), nobody)), {
    persona: 'thinking',
    wake: 0.5,
    status: 'Connecting',
    buttons: { call: 'cancel', mute: { muted: false, enabled: false } },
    words: true,
    footer: undefined,
    error: undefined,
    voiceLocked: true,
  });
});

test('a live call here listens, speaks while hex talks, and goes quiet when muted', () => {
  assert.equal(personaOf(live(), false), 'listening');
  assert.equal(personaOf(live(), true), 'speaking');
  assert.equal(personaOf(live({ muted: true }), false), 'idle');
  assert.equal(personaOf(live({ muted: true }), true), 'speaking');
  assert.equal(statusOf(live()), 'Conversation active');
  assert.equal(statusOf(live({ muted: true })), 'Microphone muted');
  assert.deepEqual(buttonsOf(live()), { call: 'end', mute: { muted: false, enabled: true } });
  assert.deepEqual(buttonsOf(live({ muted: true })).mute, { muted: true, enabled: true });
  assert.equal(wakeOf(live()), 1);
  assert.deepEqual(wordsOf(live()), words);
  assert.equal(footerOf(live(), false), undefined);
});

test('iOS taking the audio shows the microphone off and says the call is paused', () => {
  const paused = live({ interrupted: true });
  assert.deepEqual(buttonsOf(paused).mute, { muted: true, enabled: true });
  assert.equal(personaOf(paused, false), 'listening');
  assert.equal(statusOf(paused), 'Conversation active');
  assert.deepEqual(footerOf(paused, false), {
    kind: 'paused',
    text: 'Paused while another app has the audio',
  });
});

test('ending a call here thinks, keeps the microphone as it was, and lets nothing be tapped', () => {
  const ending = callOf(
    session({ status: 'disconnecting', muted: true, transcript: words }),
    nobody,
  );
  assert.deepEqual(seen(ending), {
    persona: 'thinking',
    wake: 0.5,
    status: 'Ending conversation',
    buttons: { call: 'ending', mute: { muted: true, enabled: false } },
    words: true,
    footer: undefined,
    error: undefined,
    voiceLocked: true,
  });
});

test('a call that ended here says how and how long, and its words stay', () => {
  const ended = callOf(
    session({ callId: sess, ending: 'you', elapsedSeconds: 125, transcript: words }),
    nobody,
  );
  assert.deepEqual(seen(ended), {
    persona: 'idle',
    wake: 0,
    status: 'Ready to start a conversation',
    buttons: { call: 'start', mute: undefined },
    words: true,
    footer: { kind: 'ended', id: 'sess_1', text: 'You hung up · 2 min', bad: false },
    error: undefined,
    voiceLocked: false,
  });
  assert.deepEqual(wordsOf(ended), words);
});

test('a call that never connected says so in red, with why, and offers to retry', () => {
  const failed = callOf(
    session({ status: 'error', ending: 'no-connect', error: 'Cannot reach hex.' }),
    nobody,
  );
  assert.deepEqual(footerOf(failed, false), {
    kind: 'ended',
    id: undefined,
    text: 'Couldn’t connect',
    bad: true,
  });
  assert.equal(errorOf(failed), 'Cannot reach hex.');
  assert.equal(buttonsOf(failed).call, 'retry');
  assert.equal(showsWords(failed, { viewing: false, cards: 0 }), false);
});

test('a dropped call shows its length in red', () => {
  const dropped = callOf(
    session({
      status: 'error',
      callId: sess,
      ending: 'dropped',
      error: 'Connection lost.',
      elapsedSeconds: 45,
      transcript: words,
    }),
    nobody,
  );
  assert.deepEqual(footerOf(dropped, false), {
    kind: 'ended',
    id: 'sess_1',
    text: 'Call dropped · 45 sec',
    bad: true,
  });
});

test('a past call on screen opens the words and hides how the last call ended', () => {
  const ended = callOf(session({ callId: sess, ending: 'hex', elapsedSeconds: 30 }), nobody);
  assert.equal(footerOf(ended, true), undefined);
  assert.equal(showsWords(ended, { viewing: true, cards: 0 }), true);
});

test('a call hex holds elsewhere shows as the call, with its words and where it is', () => {
  const away = callOf(session(), { record: record(), leaving: false });
  assert.deepEqual(seen(away), {
    persona: 'listening',
    wake: 1,
    status: 'hex called you, on your phone',
    buttons: { call: 'end', mute: { muted: false, enabled: false } },
    words: true,
    footer: { kind: 'elsewhere', text: 'On your phone · hex called you' },
    error: undefined,
    voiceLocked: false,
  });
  assert.deepEqual(
    wordsOf(away).map(({ role, text }) => [role, text]),
    [['assistant', 'Hey, it is hex']],
  );
});

test('hanging up a call elsewhere shows it ending until hex confirms', () => {
  const leaving = callOf(session(), { record: record({ from: 'web' }), leaving: true });
  assert.equal(personaOf(leaving, false), 'thinking');
  assert.equal(statusOf(leaving), 'Ending conversation');
  assert.equal(buttonsOf(leaving).call, 'ending');
  assert.deepEqual(footerOf(leaving, false), {
    kind: 'elsewhere',
    text: 'On the web page · You called from the web page',
  });
});

test('a call elsewhere that ended stays on screen with how it ended and its words', () => {
  const ended = callOf(session(), {
    record: record({ ended: '2026-11-03T08:03:00.000Z', end: 'hex' }),
    leaving: false,
  });
  assert.equal(ended.kind, 'none');
  assert.deepEqual(footerOf(ended, false), {
    kind: 'ended',
    id: 'phone_1',
    text: 'hex hung up · 3 min',
    bad: false,
  });
  assert.equal(showsWords(ended, { viewing: false, cards: 0 }), true);
  assert.equal(wakeOf(ended), 0);
});

test('with nothing said and no call, the words never open beside the orb', () => {
  const unanswered = callOf(session(), {
    record: record({ turns: [], ended: '2026-11-03T08:00:30.000Z', end: 'no-answer' }),
    leaving: false,
  });
  assert.equal(showsWords(unanswered, { viewing: false, cards: 0 }), false);
  assert.equal(footerOf(unanswered, false)?.text, 'No answer · 30 sec');
  const cancelled = callOf(session({ callId: sess }), nobody);
  assert.equal(showsWords(cancelled, { viewing: false, cards: 0 }), false);
});

test('an ask hex put on the call opens the words before anything is said', () => {
  assert.equal(showsWords(callOf(session(), nobody), { viewing: false, cards: 1 }), true);
});

test('the call going on now is named by hex once it answers, wherever it is', () => {
  assert.equal(callIdOf(callOf(session({ status: 'connecting' }), nobody)), undefined);
  assert.equal(callIdOf(live()), 'sess_1');
  assert.equal(callIdOf(callOf(session(), { record: record(), leaving: false })), 'phone_1');
  assert.equal(callIdOf(callOf(session({ callId: sess, ending: 'you' }), nobody)), undefined);
});

test('a call here wins over the one hex says it holds', () => {
  const both = callOf(session({ status: 'connected', callId: sess }), {
    record: record(),
    leaving: false,
  });
  assert.equal(both.kind, 'here');
  assert.equal(statusOf(both), 'Conversation active');
});

test('an error from this phone’s last call goes once a call elsewhere is the last one', () => {
  const after = callOf(session({ status: 'error', error: 'Connection lost.', ending: 'dropped' }), {
    record: record({ ended: '2026-11-03T08:01:00.000Z', end: 'you' }),
    leaving: false,
  });
  assert.equal(errorOf(after), undefined);
  assert.equal(buttonsOf(after).call, 'start');
});
