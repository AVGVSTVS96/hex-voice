# Development

Read https://docs.expo.dev/versions/v57.0.0/ before changing Expo code.

## How it works

The app is a phone for hex. It sends its WebRTC offer to hex's voice plugin (`EXPO_PUBLIC_HEX_URL`, reached over Tailscale), which starts the GPT-Live 1 session with hex's instructions and hands every request to hex's Claude Code session. The app holds the audio, the data channel for mute and End, and the captions; it has no server or API key of its own.

## Voice implementation

- Keep microphone audio active during replies and while iOS is backgrounded or locked.
- Preserve mute acknowledgments, explicit End, and unmount cleanup.
- Lock voice selection while connecting, connected, or ending. The voice is fixed at session creation.

## Checks

Run `npm run check`. For build-script changes, also run `python3 -m unittest discover -s scripts/tests`.

## Commits

One line, lowercase, plain words, no conventional commit prefixes.
