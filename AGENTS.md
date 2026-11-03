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
- `ship:js` refuses when main's native fingerprint (the runtime version) has no build yet: native packages, `app.json`, `app.config.ts`, `plugins/`, `modules/` or `package.json`'s scripts changed. Then run `npm run ship:native`: the Mac builds main unsigned in its one shared build folder (`~/Developer/hex-voice-release`), so Xcode only rebuilds what changed, and xtool on the server signs it and installs it on the iPhone (over Wi-Fi) and the iPad (plugged into the Mac) once no call is live. A run that waited behind another ships the newest main, or nothing when both devices already run it.
- Sign for devices only with xtool on the server. The free Apple team holds one development certificate at a time, so Xcode signing for a device on the Mac revokes xtool's and breaks every app it signed, hex keyboard too. Simulator builds on the Mac are fine.
- Both ship what's on origin/main, from the release checkout `~/.local/share/hex-voice/release` and its `.env.local` (see `.env.example`), and both wait their turn, so any agent can run them at any time.
- The free Apple team's profile stops the app opening 7 days after a native install. Over-the-air updates don't renew it; `ship:native` does.

## Checking on the Duo

One agent, the verifier, runs the simulator and installs to his iPhone Duo; builders commit and hand it the commit. It keeps one simulator on the Mac, "hexvoice Duo" on iOS 27.1. Never boot another or copy the app to the Mac.

```
scripts/duo shoot [ref] [states]  each state (scripts/duo-states) × the Duo's 4 poses × dark and light
scripts/duo tap [ref] [taps]      a tap script (scripts/duo-taps) played by XCUITest: real taps, folds
scripts/duo phone [update]        a screenshot of his real Duo, once hex runs that OTA update
```

- UI changes pass `scripts/duo shoot` and `scripts/duo tap` before shipping, and get a `scripts/duo phone` screenshot after. A report says which of these didn't happen ("not seen on your Duo: …") and labels faked states, like the demo call.
- Checks never reach hex: the app under check talks to `scripts/duo-hex.mjs` on the Mac, which reads his real tasks and drops every write, so no shot or tap can answer, act or call for him.
- A state is a line in `scripts/duo-states` (or the file you pass): its name, a URL that opens the app straight into it, and any launch arguments. Shots show the simulator's real status bar.
- The JS is bundled on the server and dropped into a simulator build of the commit's native fingerprint, so a JS change never rebuilds native code. Shots land in `~/.local/share/hex-voice/shots/<commit>/`, with one sheet per pose.

## Code

Keep the architecture and code clean, and bring each part you touch a step closer to pstack's principles (https://github.com/cursor/plugins/tree/main/pstack): clean organization and compartmentalization, clean call stacks, no indirection, workarounds or band-aids.

Layout breaks here when JS and SwiftUI both place the same view, so where iOS already places something, let it:

- A SwiftUI view's height is the most it may take (`maxHeight`, `upTo()` in `tasks-view.tsx`), never a fixed size. The keyboard shortens the Host it covers, and a view taller than its Host is centered, half off the top with its foot under the keyboard.
- Never move a view that holds a Host with a React Native transform. SwiftUI never hears about it, so accessibility and tap tests keep the old spot. Move it by layout, or inside SwiftUI.
- A size flows one way: the container gives it and the content fills it, or the content states it and the container fits it. Never measure a view to size the thing that sizes it; the settings sheet opened at a different width each time that way.
- Prove layout on the real renderer: `scripts/duo tap` can `type` into a field, check it's `above-keyboard` or that there's `no-keyboard`, and `mark` a view then check it holds `still`, same place and size.

## Checks

Run `npm run check`. For build-script changes, also run `python3 -m unittest discover -s scripts/tests`.
