# How SkyBlink works

This is the long version of the "How it works" section in the README: what each part does, and why we built it that way. If you only need the data format, see [`API.md`](API.md).

## The idea in one paragraph

Spotting something that moves on the sky is easy for a person if you show them two pictures of the same place, perfectly aligned and with the same brightness, one after the other. The eye catches the one dot that jumps. Almost all the work in SkyBlink goes into making those pictures truly comparable. The rest is a comfortable way to browse them.

## The pieces

```
AstroDevs-FP/  (browser)                    backend/  (Python)                    NASA / ESA
┌───────────────────────────┐   meta.json   ┌──────────────────────────┐   TAP / SIA2   ┌───────────────┐
│ SkyView  (Aladin Lite)    │ ◀──── + PNG ── │ main.py   FastAPI        │ ─────────────▶ │ IRSA SPHEREx  │
│ Workspace (PixiJS stage)  │                │ pipeline.py              │   cutouts      │ images        │
│ Timeline, Layers, Curve   │                │ imaging.py  irsa.py      │ ◀───────────── │               │
│ App.jsx (state + URL)     │                │ astro.py    targets.py   │   TAP          │ ESA Gaia DR3  │
└───────────────────────────┘                └──────────────────────────┘ ─────────────▶ └───────────────┘
        ▲  HiPS tiles (all-sky cube) straight from IRSA
```

The web app can run with no backend at all: the five test targets are prebaked as static files by `scripts/prebake.py`, using exactly the same pipeline. The backend only adds live cut-outs of any other position.

## The pipeline, step by step (`backend/`)

**1. Find the visits** (`irsa.py`). We ask IRSA which SPHEREx images contain the position, the same way IRSA's SPHEREx tutorial does: `Irsa.query_sia(pos=(coord, 1 arcsec), collection=[...])` over the Wide and Deep collections of DR1 and QR3. One search returns all six detectors, so we ask once per region and filter locally. If SIA does not answer we try TAP, and if IRSA is having a bad moment (it often returns a brief 502) we wait and try again. SPHEREx comes back to every part of the sky about every six months, and each visit is several exposures spread over a few days, so `pipeline.group_visits()` groups exposures closer than 30 days into one visit.

**2. Download small cutouts** (`irsa.py`). A full SPHEREx exposure is about 70 MB. IRSA can cut a square around a position on its side, so we only download a few hundred KB per exposure, a bit larger than the region, so nothing is lost when we rotate it onto our grid. Downloads run in parallel and are cached on disk.

**3. Clean each exposure** (`imaging.load_exposure`).
- Subtract the ZODI layer that ships with every image. The zodiacal light (sunlight scattered by dust in the solar system) changes with the season, so without this the background would jump between visits taken six months apart.
- Blank out pixels whose quality flags say they are bad. We follow the SPHEREx tutorials and keep only pixels with no flags, or with the harmless "source" and bit-1 flags. Everything else becomes empty (NaN) rather than a fake bright spot.
- Read the wavelength and bandwidth at the target from the image's spectral coordinate system (`key='W'`, with SIP switched off, as the IRSA tutorial explains). SPHEREx uses filters whose color changes across the detector, so the same detector can see a slightly different color from one visit to the next. We show both in the app.

**4. Put every frame on the same grid** (`imaging.make_grid`, `reproject_to`). Each region gets one north-up, east-left grid at SPHEREx's native 6.2″ per pixel, centred on the target where it is during the survey (not where it was in 2016). Every exposure is resampled onto that grid with `reproject_exact`, which conserves flux (the method used in IRSA's mosaic tutorial). This is what keeps the field still, so only real motion shows.

**5. Stack each visit** (`imaging.coadd`). The median of the exposures in a visit. It lowers the noise and removes one-off glitches such as cosmic rays.

**6. One brightness scale per band** (`imaging.stretch_limits`). This step is easy to get wrong. We pick one black level (just below the sky) and one white level (the brightest stars, but never closer than 25 noise units to the sky) from all visits together, and apply an asinh stretch, which shows faint and bright things at the same time. If each visit had its own scale, the image would flicker and hide the motion we want to show.

**7. Differences** (`imaging.save_diff`). Each visit minus the first one, in a color scale people can read: blue where something got fainter, orange where it got brighter, black where nothing changed. A star that moved leaves a blue-orange pair.

**8. Predictions** (`astro.propagate`). For the target and for Gaia DR3 stars around it, we move the catalogue position to the date of each visit. Two effects matter:
- *proper motion*: the star's own drift across the sky (Barnard's Star moves about 10″ per year);
- *parallax*: the yearly wobble caused by the Earth going around the Sun (WISE 0855 wobbles by almost half an arcsecond).

The result is drawn as a crosshair. If the dot follows the crosshair, the motion is real.

**9. Photometry** (`imaging.aperture_flux`). The light inside a 2-pixel circle at the predicted position, minus the sky measured in a ring around it (a sigma-clipped mean, so other stars in the ring do not bias it), converted from surface brightness to millijansky with the formula from IRSA's mosaic tutorial: mJy = MJy/sr × 23.5045 × (pixel size in arcsec)² / 1000. It feeds the light curve and works best for the variable stars.

**10. Write it out** (`pipeline.write_region`). PNG frames, difference frames and a `meta.json` that holds everything else. See [`API.md`](API.md).

## What to expect in the frames

SPHEREx pixels are large (6.2″). Between two visits six months apart, even the fastest targets move less than one pixel: Barnard's Star about 5″, WISE 0855 about 4″. Over the full span of the surveys the motion becomes clear. That is why the app opens the blink on the **first and last** visits, shows the predicted crosshair by default, and offers the difference view. RW Aurigae and R Draconis do not move. They change brightness, so the light curve is the right tool for them.

## The web app (`AstroDevs-FP/src/`)

- **`App.jsx`** holds all the state in one reducer and runs the main flows: search, cut-out, playback timer, keyboard shortcuts, GIF export. It also writes the state into the URL, so any view can be shared or embedded.
- **`components/SkyView.jsx`** is the sky map (Aladin Lite). One quirk: Aladin Lite 3.8 assumes cube frames are evenly spaced in frequency, but the SPHEREx cube is ordered by wavelength, so asking for "band 8" would load the wrong band. `aladinSlice()` reverses Aladin's formula so the band you pick is the band you get.
- **`lib/stage.js`** is the PixiJS workspace. Each layer is one detector at one date, painted through its own contrast curve and color, and layers are mixed with additive blending, like colored projectors on the same wall. Overlays (crosshair, Gaia stars, tracked path, photometry circle) are drawn on top. It only redraws when something changes.
- **`lib/tone.js`** handles per-layer contrast (black point, white point, midtones) with a 256-entry lookup table on the CPU. The frames are tiny, so it is instant.
- **`lib/measure.js`** finds stars (centroids), follows one through every visit (`trackSource`) and measures brightness in the browser. It first undoes the server's stretch, so the numbers compare visits fairly. They are relative, not calibrated fluxes.
- **`lib/coords.js`** reads coordinates in the formats people actually type, and converts between the region's pixels and the sky.
- **`lib/earth.js`** computes the zenith for "sky from a place on Earth". Addresses go through OpenStreetMap's geocoder.

## Updating to a new data release

Add the new collection name to the front of `RELEASES` in `backend/config.py`, then run `scripts/prebake.py` again. TAP searches already see new data as soon as IRSA ingests it.

## Known limits

- IRSA's image search was down on 2026-11-14, so the time-lapses currently use a clearly labelled simulated sample (see the README).
- The reference epoch we use for WISE 0855's position (~2010.5) is an estimate, so its predicted track is approximate.
- Brightness measured by clicking in the browser comes from the displayed frames. It is good for comparing visits, not for science-grade fluxes.
- Live cut-outs depend on IRSA's response time, and the first request for a region can take a minute or more.
