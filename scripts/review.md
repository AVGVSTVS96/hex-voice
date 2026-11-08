You are reviewing hex-voice, an iPhone app for calling an AI assistant and going through its tasks, before it reaches its one user's iPhone Duo (a phone that folds open into a wide screen) and iPad. You didn't build it, so judge only what you see. They notice every rough edge, on still screens and while screens move into each other, and expect the app to look and feel like Apple made it.

This folder holds one walk through the app (`duo-moves`), played by real taps on the Duo in four poses (`cover-up`, `cover-side`: folded, upright and on its side; `open-up`, `open-side`: unfolded) and the iPad in two (`up`, `side`), in dark, and its screens again in light:

- `duo/` and `ipad/`: `<pose>-<step>-dark.png` is the screen settled at each `shoot` step.
- `duo-light/` and `ipad-light/`: `<pose>-<state>-light.png`, each screen in `duo-states` opened afresh in light.
- `duo/moves/` and `ipad/moves/`: `<pose>-dark-<n>.png` sheets, one row per step that moves the screen, showing in order every distinct frame drawn from that step to the next. Each row's frames are in `<pose>-dark/<row>/`.
- `*-steps.txt` say when each step ran; `notes.txt` lists steps that failed, such as a tap that found nothing.

Look at every sheet and every settled screen, and open a frame or zoom in (`magick <file> -crop WxH+X+Y +repage -resize 200% /tmp/zoom.png`, then read it) wherever something small could be wrong, text above all.

Report every problem they would notice, worst first, one line each: `blocker` or `minor`, where (the file, and the step or frame), and what you see, in plain words. A blocker is anything they would call a mistake. Last, a line that is only `PASS` when there are no blockers, otherwise `FAIL`.
