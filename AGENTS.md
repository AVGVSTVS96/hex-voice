# Development

Read https://docs.expo.dev/versions/v58.0.0/ before changing Expo code.

Build with Xcode 27.1 or newer: the iPhone Duo's fold and side column come from its SDK (`modules/pose`).

## How it works

The app is a phone for hex. It sends its WebRTC offer to hex's voice plugin (`EXPO_PUBLIC_HEX_URL`, reached over Tailscale), which starts the GPT-Live 1 session with hex's instructions and hands every request to hex's Claude Code session. The app holds the audio, the data channel for mute and End, and the captions; it has no server or API key of its own.

## Voice implementation

- Keep microphone audio active during replies and while iOS is backgrounded or locked.
- Preserve mute acknowledgments, explicit End, and unmount cleanup.
- Lock voice selection while connecting, connected, or ending. The voice is fixed at session creation.

## Shipping to the iPhone and iPad

```
push main ─┬─ npm run ship:js      JS only: over the air, on both devices in seconds
           └─ npm run ship:native  native changed: one warm Mac build, installed on both
```

- After you push main, run `npm run ship:js`. It publishes main's JS to the update server (`updates/store.mts`, the `hex-voice-updates` service on the server), and the app restarts into it the next time it comes to the front with no call live.
- `ship:js` refuses when main's native fingerprint (the runtime version) has no build yet: native packages, `app.json`, `app.config.ts`, `plugins/` or `modules/` changed. Then run `npm run ship:native`: the Mac builds main unsigned in its one shared build folder (`~/Developer/hex-voice-release`), so Xcode only rebuilds what changed, and xtool on the server signs it and installs it on the iPhone (over Wi-Fi) and the iPad (plugged into the Mac) once no call is live. A run that waited behind another ships the newest main, or nothing when both devices already run it.
- Sign for devices only with xtool on the server. The free Apple team holds one development certificate at a time, so Xcode signing for a device on the Mac revokes xtool's and breaks every app it signed, hex keyboard too. Simulator builds on the Mac are fine.
- Both ship what's on origin/main, from the release checkout `~/.local/share/hex-voice/release` and its `.env.local` (see `.env.example`), and both wait their turn, so any agent can run them at any time.
- The free Apple team's profile stops the app opening 7 days after a native install. Over-the-air updates don't renew it; `ship:native` does.

## Code

Keep the architecture and code clean, and bring each part you touch a step closer to pstack's principles (https://github.com/cursor/plugins/tree/main/pstack): clean organization and compartmentalization, clean call stacks, no indirection, workarounds or band-aids.

## Checks

Run `npm run check`. For build-script changes, also run `python3 -m unittest discover -s scripts/tests`.

## Commits

One line, lowercase, plain words, no conventional commit prefixes.
