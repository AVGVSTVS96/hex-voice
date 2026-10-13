This fork is the maintained line of the app now. It started as David Mokos's
expo-gpt-live, an Expo voice app template, and became hex-voice: an iPhone app
for calling hex. Calls go to hex's voice plugin over Tailscale instead of the
template's own OpenAI server, tools and web app, which are gone. On top of
that it adopts the iOS 27 scene life cycle and adds pull-down-to-transcript
that follows new words, an orb that sleeps visibly, springs awake and swells
with your voice, persona colors, call chimes and haptics, voice previews,
music that keeps playing during calls, a Live Activity with the orb, and a
reworked settings screen. This patch is all of that, and main is where it
keeps growing.

If upstream ever updates, treat it as a new fork rather than the line this one
follows: bring in anything clearly valuable, judged by what these
customizations show this app cares about, like fixes, Expo and dependency
updates, and better audio, call handling or Persona animations. Leave out
what only serves the template's server, tools or web app.

Where upstream's opinions differ from ours, weigh ours more heavily: keep
hex-voice's behavior and design, and take upstream's change only where it
doesn't undo them. Upstream having its own version of something here is a
reason to look at it, not to drop ours.
