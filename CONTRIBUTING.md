# Contributing to Dub Booth

## Keep the README current

The [README](README.md) is the user guide. It has to describe the app as it is now, so **every change to the app updates it in the same pull request**:

- **New feature:** add it to the right section of the README (or a new section), with a screenshot if it has its own controls.
- **Changed behaviour, renamed button or setting:** update every place the README mentions it, using the app's own wording.
- **Removed feature:** take it out of the README.
- **A screen looks different:** run `node docs/screenshots.js` and commit the new images. If the change adds a new state or screen worth showing, add a step to `docs/screenshots.js`.
- **The way something works changed** (recording, takes and clips, the rhythmo band, transcription, export): update the matching diagram in `docs/images/*.svg`. They're plain SVG, edited by hand.
- **Keyboard shortcuts or remote keys changed:** update the table in the README.

A check on every pull request fails when `dub-booth.html`, `sw.js` or `manifest.webmanifest` change but `README.md` doesn't. If a change really doesn't affect anything a user sees (a refactor, a comment), write `[docs not needed]` in the pull request description.

## Making a change

- Branch names start with `feature/`.
- Bump `APP_VERSION` in `dub-booth.html` with every change to the app, so Settings shows which copy is running.
- The app is one file with no build step. Serve the folder (`npx serve .`, `python3 -m http.server`, or any static server) and open `dub-booth.html`. The microphone needs `https://` or `localhost`.
- Test on a phone as well as a computer. Safari on iPhone, and the Home Screen app in particular, behaves differently from desktop browsers (audio contexts, memory limits, the on-screen keyboard).

## Screenshots

`docs/screenshots.js` opens the app in Chromium with a fake microphone, loads the sample clips, records two takes, adds lines and marks, and saves the PNGs in `docs/images`. Speech recognition is replaced by a stand-in, so it needs no network.

```sh
npm install --no-save playwright
npx playwright install chromium
node docs/screenshots.js
```
