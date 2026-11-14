# SkyBlink: blink the infrared sky with SPHEREx

**NASA Space Apps Challenge 2026 · Challenge 12: Planet X and SPHEREx**

Live app: _coming soon (will be hosted on a `*.vercel.app` or `*.github.io` address)_
Demo: _coming soon_

![Status](https://img.shields.io/badge/data-simulated%20sample%20until%20IRSA%20is%20back-orange)

## In short

**What we built.** SkyBlink is a free web tool that turns NASA's SPHEREx images into short time-lapses. You type a position on the sky (or a name), and it plays every SPHEREx visit of that spot in a loop, like a little movie.

**How it answers the challenge.** SPHEREx photographs the whole sky every six months in 102 infrared colors. Things that are close to us, like nearby stars, brown dwarfs, asteroids and comets, shift a little between those photos. SkyBlink lines the photos up perfectly and keeps their brightness consistent, so the only thing that changes on screen is what really changed in the sky. On top of that, it blinks two dates, shows differences, and stacks infrared colors.

**Why it matters.** Pluto was found by blinking two photographs. Most known brown dwarfs were found by volunteers doing the same thing with older NASA data. SPHEREx will image more than a billion objects, far more than scientists can check alone. SkyBlink lets anyone with a browser look, measure and share what they find.

## What you can do with it

| You want to… | How |
| --- | --- |
| Look at the whole sky | The big map shows the real SPHEREx all-sky image. Drag to move, scroll to zoom. Pick any of the 102 bands, or switch to 2MASS (infrared) or DSS2 (visible light). |
| Go to a place on the sky | Click the search bar (or press `/`) and type a name like *WISE 0855* or coordinates like `08h55m10.8s -7d14m42s` or `133.795 -7.245`. |
| See the sky above a city | In search, open *Sky from a place on Earth* and type an address or latitude/longitude and a time. The map turns to show what is overhead. |
| Cut out a patch to study | Choose **Cut out** (`C`), pick a size (1.5′ to 12′) and click the map. |
| Watch it change | Press play (`space`). Change speed, step with `←` `→`, or pick a period with *From / to*. |
| Compare two dates | **Blink** (`B`) flips between two visits. **Difference** (`D`) paints what got fainter in blue and what got brighter in orange, so a moving star becomes a blue-orange pair. |
| Mix colors and dates | Open the menu (☰ or `L`). Each layer is one infrared band at one date. Stack them, change their color, opacity and contrast. Try the presets: *One band*, *False color* and *Then vs now* (first visit in blue, the current one in orange). |
| Follow a star | **Track** (`T`), then click a star. SkyBlink follows it through every visit and compares how far it moved with what Gaia predicts. |
| Measure brightness | **Brightness**, then click a star to get its light curve. Variable stars like R Draconis rise and fall. |
| Share it | Every view has its own link, for example `?target=wise-0855&mode=blink`. Use **⤓ GIF** to download the loop as an animation. |

The five test objects from the challenge are built in: Barnard's Star, Epsilon Indi B, WISE 0855-0714, RW Aurigae and R Draconis.

## How it works

```
 IRSA (NASA)                   backend (Python)                      web app (browser)
 ───────────                   ────────────────                      ─────────────────
 SPHEREx images  ──search──▶  find visits of the spot
                 ──cutouts─▶  remove zodiacal glow, mask bad pixels
                              line every frame up on one grid
                              stack each visit, same contrast for all
                              predict positions with Gaia DR3   ──▶  PNG frames + meta.json ──▶ PixiJS workspace
 SPHEREx all-sky HiPS  ────────────────────────────────────────────────────────────────────▶ Aladin Lite sky map
```

1. **Find.** For a position, we ask IRSA which SPHEREx exposures cover it, and group them into survey visits (about six months apart).
2. **Download only what we need.** IRSA cuts a small square around the position, a few hundred KB instead of a 70 MB image, and we cache it.
3. **Clean.** We subtract the zodiacal light (glow from dust in our solar system) and hide pixels the mission flagged as unreliable.
4. **Line up and stack.** Every exposure is reprojected onto one north-up grid, and the exposures of each visit are median-combined to reduce noise.
5. **Same contrast everywhere.** All visits of a band share one brightness scale. Without this, frames flicker and hide real motion.
6. **Predict.** Positions from Gaia DR3 are moved to each visit's date using proper motion and parallax, so the app can show where each star *should* be.
7. **Show.** The browser stacks the frames as colored layers with PixiJS, and draws the whole sky with Aladin Lite.

There is a longer walk-through, including the science reasons for each step, in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Data: what is real right now

We would rather be clear about this than have a judge find out:

- **The sky map is real.** It is the SPHEREx DR1 all-sky cube served by NASA/IPAC IRSA.
- **The time-lapses of the five test targets are a simulated sample for now.** On 14 November 2026, IRSA's SPHEREx image search returned errors (HTTP 502) all day, so we could not download real visits. To keep building, we made a sample from real Gaia DR3 star positions, moved to plausible visit dates. It is marked `"simulated": true` and `"generated_by_ai": true` in its metadata, and the app shows a *Simulated* badge and a watermark on it.
- **Switching to real data is one command** (`scripts/prebake.py`). The app picks it up automatically and the warnings disappear.
- **Live cut-outs of any other position** need the backend, which is in beta.

## NASA data and resources used

- **SPHEREx Level 2 spectral images (DR1 and QR3)**, NASA/IPAC Infrared Science Archive (IRSA), searched with IRSA TAP and SIA2 and downloaded through the IRSA cutout service. https://irsa.ipac.caltech.edu/Missions/spherex.html
- **SPHEREx DR1 all-sky data cube (HiPS)**, IRSA. https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube
- **IRSA SPHEREx tutorial notebooks.** https://caltech-ipac.github.io/irsa-tutorials/spherex/
- **2MASS color sky map**, a NASA-funded survey (UMass and IPAC/Caltech), via IRSA.

## Other resources and tools

- **Gaia DR3** (European Space Agency), for star positions and motions.
- Aladin Lite (CDS Strasbourg), PixiJS, React, Vite, gifenc, astropy, reproject, NumPy, FastAPI and others. Full list with versions, licenses and links: [`SOURCES.md`](SOURCES.md).

## Built with

- **Front end:** JavaScript, React 19, Vite, PixiJS 8 (WebGL) for the region workspace, Aladin Lite 3 for the sky map.
- **Back end:** Python, FastAPI, astropy, reproject, NumPy, Pillow.
- **Hardware:** none beyond a laptop. The app runs in any modern desktop browser with WebGL2.

## Design choices

- **Accessibility.** Keyboard shortcuts for every main action, ARIA labels on controls, high-contrast dark theme, plain-language explanations ("What am I looking at?") next to the data.
- **Cost.** Free to use and to host. The front end is a static site, the five test targets need no server, and the backend only runs when someone asks for a new region.
- **Energy and bandwidth.** We download small cutouts instead of full images, cache everything, and draw the screen only when something changes.
- **Easy to update.** A new SPHEREx data release is one line in `backend/config.py`.
- **Desktop first.** The tool is built for a mouse, a keyboard and a large screen.

## Run it yourself

You need Node.js 20+ and Python 3.11+.

**Web app**

```bash
cd AstroDevs-FP
npm install
npm run dev          # open http://localhost:5173
```

To use live search, start the backend (below) and run `VITE_API_URL=http://localhost:8010 npm run dev` instead. In PowerShell: `$env:VITE_API_URL="http://localhost:8010"; npm run dev`.

**Backend (optional, for live search)**

```bash
python -m venv .venv
.venv/Scripts/pip install -r backend/requirements.txt     # macOS/Linux: .venv/bin/pip
cd backend
../.venv/Scripts/python -m uvicorn main:app --port 8010
```

**Data**

```bash
.venv/Scripts/python scripts/prebake.py            # real SPHEREx data for the 5 targets (needs IRSA online)
.venv/Scripts/python scripts/prebake.py wise-0855  # just one target
.venv/Scripts/python scripts/make_mock.py          # simulated sample, for development only
```

**Publish**

`npm run build` inside `AstroDevs-FP` produces a static site in `dist/`. Host it on Vercel, Netlify or GitHub Pages, not on a newly registered domain: evaluators often sit behind corporate firewalls that block new or uncategorized domains. The backend has a `Dockerfile` for Hugging Face Spaces or Render.

## Project layout

```
AstroDevs-FP/            web app
  src/App.jsx            app state and main flows
  src/components/        navbar, search, sky map, sidebar, timeline, layers, light curve
  src/lib/stage.js       PixiJS workspace (layers, blending, overlays)
  src/lib/               coordinates, data loading, contrast, measurements, GIF
  public/data/           prebaked test targets (frames + meta.json + datapackage.json)
backend/                 Python API and image pipeline
  config.py              all settings (data releases, sizes, limits)
  irsa.py                search IRSA and download cutouts
  imaging.py             clean, reproject, stack, stretch, difference, photometry
  pipeline.py            builds one region folder
  astro.py, targets.py   coordinates, Gaia, motion prediction, test targets
scripts/                 prebake (real data) and make_mock (simulated sample)
docs/                    ARCHITECTURE.md, API.md, SPHEREX_NOTES.md, challenge text and rules
```

## AI Usage & Attribution

We used AI, and we want to be specific about where.

- **Claude Code (Anthropic)** helped write most of the source code (web app, backend, image pipeline and scripts), the documentation, and the simulated development sample. Every file it helped with starts with an `AI-Assisted:` comment.
- **The team** chose the idea, the interface layout and the features, picked the test targets and the processing approach, ran and checked the results, and is responsible for every claim in this project.
- **Synthetic data.** The simulated sample in `AstroDevs-FP/public/data/` was produced by an AI-assisted script (`scripts/make_mock.py`). It is labelled `"generated_by_ai": true` in `meta.json` and `datapackage.json`, and the app shows it with a visible *Simulated* watermark.
- **No AI-generated images, audio or video** are part of the app. No NASA logos, insignia or mission identifiers are used anywhere in it.

## License

Aladin Lite is released under GPL-3.0, so this project must use a GPL-3.0-compatible license. The team still has to add the license file.
