# Development

Read https://docs.expo.dev/versions/v58.0.0/ before changing Expo code.

Build with Xcode 27.1 or newer: the iPhone Duo's fold and side column come from its SDK (`modules/pose`). `ship:native` builds with Xcode 27.3, whose SDK is the first where Siri can use Ask hex (`plugins/siri`); older ones build it as a plain intent Siri ignores.

## How it works

The app is a phone for hex. It sends its WebRTC offer to hex's voice plugin (`EXPO_PUBLIC_HEX_URL`, reached over Tailscale), which starts the GPT-Live 1 session with hex's instructions and hands every request to hex's Claude Code session. The app holds the audio, the data channel for mute and End, and the captions; it has no server or API key of its own.

## Voice implementation

- Keep microphone audio active during replies and while iOS is backgrounded or locked.
- Preserve mute acknowledgments, explicit End, and unmount cleanup.
- Lock voice selection while connecting, connected, or ending. The voice is fixed at session creation.

## Shipping to the iPhone and iPad

```
push main ─┬─ npm run ship:js -- <commit>   JS only: over the air, on both devices in seconds
           └─ npm run ship:native           native changed: one warm Mac build, installed on both
```

- After you push main, run `npm run ship:js -- <commit>`, naming the commit you pushed: it refuses unless main holds it, so a merge or push that failed never ships the rest of main. It publishes main's JS to the update server (`updates/store.mts`, the `hex-voice-updates` service on the server), and the app restarts into it the next time it comes to the front with no call live.
- `ship:js` refuses when main's native fingerprint (the runtime version) has no build yet: native packages, `app.json`, `app.config.ts`, `plugins/`, `modules/` or `patches/` changed. Then run `npm run ship:native`: the Mac builds main unsigned in its one shared build folder (`~/Developer/hex-voice-release`), so Xcode only rebuilds what changed, and signs it (below) and installs it with `devicectl` on the iPhone (over Wi-Fi) and the iPad (plugged into the Mac) once no call is live. A run that waited behind another ships the newest main, or nothing when both devices already run it.
- The app is signed by Bassim's paid Apple team with the Mac's development certificate (its key is in the Mac's login keychain), so xtool never makes its own: that could revoke the Mac's and break every app Xcode signed, hex keyboard too. `ship:native` has xtool on the server (Bassim's fork, whose `xtool sign` provisions an app for a certificate it holds without the key and signs ad hoc) make the profiles, then `scripts/resign` signs on the Mac with the keychain identity that has the certificate's serial, the frameworks, the Live Activity extension and the app, each with its profile's entitlements. The keychain opens only in the login session, so that runs as a one-off launch agent. Simulator builds on the Mac are fine.
- Both ship what's on origin/main, from the release checkout `~/.local/share/hex-voice/release` and its `.env.local` (see `.env.example`), and both wait their turn, so any agent can run them at any time.
- The paid team's profile stops the app opening a year after a native install. Over-the-air updates don't renew it; `ship:native` does.

## Checking on the Duo

One agent, the verifier, runs the simulator and installs to his iPhone Duo; builders commit and hand it the commit. Checks run in lanes, each a Duo simulator on iOS 27.1 and an iPad on 27.3 with its own Mac folder, stand-in port and lock, one of the pair booted at a time and kept booted between checks: a check takes whichever of lanes 1 ("hexvoice Duo") and 2 ("2 hexvoice Duo") is free, and `scripts/duo verify` has its own ("verify hexvoice Duo"), so it never waits behind them. Checks wait for a lane, and for the Mac's simulator turn, in the order they came; `FIRST=1 scripts/duo …` puts the check he's waiting on ahead of the rest. All lanes install the simulator builds lane 1 makes. Stopping a check here (TERM or Ctrl-C) stops all of it on the Mac at once, its UI tests and recorder included, and on the Mac a check holds its lane's own lock while it runs. After a swipe or a change of Split View, a tap script's `settle` waits until the screen holds still. Never copy the app to the Mac.

```
scripts/duo shoot [ref] [states]  each state (scripts/duo-states) × the Duo's 4 poses × dark and light
scripts/duo tap [ref] [taps]      a tap script (scripts/duo-taps) played by XCUITest: real taps, folds
scripts/duo verify [ref]          check, scripts/duo-moves filmed, judged by a fresh reviewer
scripts/duo fold [ref] [states]   films Tasks through FOLDS, counts each move's wrong frames
scripts/duo phone [update]        a screenshot of his real Duo, once hex runs that OTA update
```

- UI changes pass `scripts/duo shoot` and `scripts/duo tap` before shipping, and get a `scripts/duo phone` screenshot after. A report says which of these didn't happen ("not seen on your Duo: …") and labels faked states, like the demo call.
- A change to layout, the toolbar or poses also passes `POSES=open-up scripts/duo tap <ref> scripts/duo-fold-taps`, which folds and turns the Duo with Tasks open and checks the toolbar stays off the Tasks page.
- A change to what opens and closes (Calls, Tasks, settings) also passes `scripts/duo tap <ref> scripts/duo-calls-taps`.
- A change meant to make folding, opening or turning smoother proves it with `scripts/duo fold` before and after: it counts the frames the app shows a wrong layout once iOS's own part of each move has landed, timed by a plain UIKit app filmed alongside (`FOLD_PROBE`, its simulator build on the Mac), into `fold/table.md` with a sheet per move.
- `scripts/duo phone` shoots whatever is on his screen, so delete a shot that isn't hex as soon as you've looked, and never pass one on.
- Checks never reach hex: the app under check talks to `scripts/duo-hex.mjs` on the Mac, which reads his real tasks and drops every write, so no shot or tap can answer, act or call for him.
- iOS's Split View can't be started on the simulator: add `&split=first` or `&split=second` to a state's URL to lay the app out in one half of the screen, with its own safe area and the pose in its coordinates. Sheets still present from the whole screen.
- A state is a line in `scripts/duo-states` (or the file you pass): its name, a URL that opens the app straight into it, and any launch arguments. Shots show the simulator's real status bar.
- The JS is bundled on the server and dropped into a simulator build of the commit's native fingerprint, so a JS change never rebuilds native code. Shots land in `~/.local/share/hex-voice/shots/<commit>/`, with one sheet per pose.

## Code

Keep the architecture and code clean, and bring each part you touch a step closer to pstack's principles (https://github.com/cursor/plugins/tree/main/pstack): clean organization and compartmentalization, clean call stacks, no indirection, workarounds or band-aids.

Layout breaks here when JS and SwiftUI both place the same view, so where iOS already places something, let it:

- Every Host is `@/ui/host`'s (lint holds it). It keeps clear of nothing unless it holds a field (`avoids="keyboard"`, Tasks' pages) or presents a sheet (`avoids="system"`), so the keyboard never moves a view it covers.
- Every React Native ScrollView is `@/ui/scroll`'s (lint holds it), so a drag down any scrolling content lets the keyboard go, as Tasks' SwiftUI scroll views do (`scrollDismissesKeyboard`).
- A SwiftUI view's height is the most it may take (`maxHeight`, `upTo()` in `tasks-view.tsx`), never a fixed size. The keyboard shortens the Host it covers, and a view taller than its Host is centered, half off the top with its foot under the keyboard.
- Never move a view that holds a Host with a React Native transform. SwiftUI never hears about it, so accessibility and tap tests keep the old spot. Move it by layout, or inside SwiftUI.
- Where something sits decides only where it goes, never how it looks. A component's corners, surfaces and spacing come from `src/ui/tokens.ts` (`radius`, `metrics`, `space`) and `circle` in `theme.ts`, so it has one look on every screen and pose; `tests/look.test.ts` fails on a raw corner.
- Layout reads the window's `Room` (`src/screens/window.ts`), never the device's pose: iOS reports the fold and the bar's side for the device, and in Split View they lie outside the window. `tests/window.test.ts` keeps the pose to that one module and lays out every window size with the fold anywhere.
- Folding moves nothing: the room's fold is only the line where it divides the window, with no angle, state or thickness, so partly open lays out exactly as open flat.
- A size flows one way: the container gives it and the content fills it, or the content states it and the container fits it. Never measure a view to size the thing that sizes it; the settings sheet opened at a different width each time that way.
- Prove layout on the real renderer: `scripts/duo tap` can `type` into a field, check it's `above-keyboard` or that there's `no-keyboard`, and `mark` a view then check it holds `still`, same place and size.

## Checks

Run `npm run check`.
