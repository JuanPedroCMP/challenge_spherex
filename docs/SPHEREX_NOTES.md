# SPHEREx technical notes (shared reference for all agents)

Source: IRSA tutorials and SPHEREx archive docs, read 2026-11-14. Anything marked UNVERIFIED must be checked against a real file/query before relying on it.

Key URLs
- Tutorials: https://caltech-ipac.github.io/irsa-tutorials/spherex/ (intro, cutouts, PSF, source-discovery-tool, mosaic, HiPS cube)
- Archive docs: https://caltech-ipac.github.io/spherex-archive-documentation/ (data-access, data-products, data-releases)
- Mission page: https://irsa.ipac.caltech.edu/Missions/spherex.html
- Explanatory Supplement (flags table 16): https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp.pdf
- IRSA tools for inspiration/validation: Data Explorer https://irsa.ipac.caltech.edu/applications/spherex , MOST (moving objects) https://irsa.ipac.caltech.edu/applications/MOST , Spectrophotometry tool, Mosaic tool
- Model tool: WiseView http://byw.tools/wiseview

## 1. Finding images for an RA/Dec

Collections (SIA2): `spherex_dr1` (Wide), `spherex_dr1_deep`, `spherex_dr1_cube` (All-Sky Cube), `spherex_qr3`, `spherex_qr3_deep`. DR1 + QR3 supersede QR2 (QR2 not searchable). SIA2 lags ingestion ~1 day; TAP does not.

```python
from astropy.coordinates import SkyCoord
import astropy.units as u
from astroquery.ipac.irsa import Irsa
coord = SkyCoord(ra, dec, unit='deg')
res = Irsa.query_sia(pos=(coord, 1*u.arcsec), collection=['spherex_dr1', 'spherex_qr3'])
# columns: access_url, cloud_access, s_region, energy_bandpassname ('SPHEREx-D2'), t_min, t_max, t_exptime, obs_id, obs_release_date
```

Time-ordered cutout URLs via TAP (preferred for the flipbook):

```sql
SELECT 'https://irsa.ipac.caltech.edu/' || a.uri || '?center={ra},{dec}d&size={size_deg}' AS uri,
       p.time_bounds_lower, p.energy_bandpassname
FROM spherex.artifact a JOIN spherex.plane p ON a.planeid = p.planeid
WHERE 1 = CONTAINS(POINT('ICRS', {ra}, {dec}), p.poly)
  AND p.energy_bandpassname = 'SPHEREx-D2'
ORDER BY p.time_bounds_lower
```
Run with `Irsa.query_tap(query)` or `pyvo.dal.TAPService("https://irsa.ipac.caltech.edu/TAP").search(query)`.
`time_bounds_lower` is in days, almost certainly MJD (UNVERIFIED: confirm vs t_min / header DATE).

## 2. Cutouts

Append `?center=RA,DEC[d]&size=SIZE` to an on-prem MEF URL. `size` in degrees in all examples (0.1 = 6 arcmin) (UNVERIFIED unit doc: https://irsa.ipac.caltech.edu/ibe/cutouts.html). Cutout keeps all HDUs; IMAGE/FLAGS/VARIANCE/ZODI cropped, WCS-WAVE remapped, PSF untouched.

## 3. Level-2 spectral image MEF

Filename `level2_<ObsID>D<det>_spx_l2b-v<ver>-<procdate>.fits`. One MEF per detector per pointing, ~70 MB full (use cutouts!).

| HDU | Content |
| --- | --- |
| 0 PRIMARY | header, VERSION |
| 1 IMAGE | 2040x2040 float32, MJy/sr, zodi NOT subtracted |
| 2 FLAGS | int32 bitmask |
| 3 VARIANCE | (MJy/sr)^2 |
| 4 ZODI | modeled zodiacal light, MJy/sr (subtract IMAGE - ZODI for display) |
| 5 EPSF | PSF table (21x21 zones, 33x33 oversampled 5x) |
| 6 WCS-WAVE | per-pixel wavelength/bandwidth lookup |

Spatial WCS: `WCS(h['IMAGE'].header)` (RA---TAN-SIP). Wavelength per pixel:
```python
sw = WCS(header=h['IMAGE'].header, fobj=h, key='W'); sw.sip = None
wl, bw = sw.pixel_to_world(x, y)   # microns
```
SPHEREx uses linear variable filters: wavelength varies across each detector, so the 102 "bands" come from position on the detector, not separate filters. Each sky point is observed at many wavelengths across different exposures.

Detectors: D1 0.75-1.09 um (R~39) · D2 1.10-1.62 (R~41) · D3 1.63-2.41 (R~41) · D4 2.42-3.82 (R~35) · D5 3.83-4.41 (R~112) · D6 4.42-5.00 (R~128).
Brown dwarfs (e.g. WISE 0855) are very red: faint in D1-D2, bright in D4-D6 outside the CH4 absorption ~3.3 um. Pick the detector per target.

Flags (bit n = 2^n): 0 TRANSIENT, 1 OVERFLOW, 2 SUR_ERROR, 6 NONFUNC, 7 DICHROIC, 9 MISSING_DATA, 10 HOT, 11 COLD, 12 FULLSAMPLE, 14 PHANMISS, 15 NONLINEAR, 17 PERSIST, 19 OUTLIER, 20 CROSSTALK, 21 SOURCE, 22 GHOST, 23 GHOST_FPA, 24 GHOST_EXT, 25 STREAK, 26 BLOOM, 27 SNOWBALL, 28 HALO. Header MSKNnnnn/MSKDnnnn give names. Tutorial "good pixel" rule: FLAGS in {0, 2, 2097152}.

Flux per pixel: MJy/sr -> uJy/arcsec^2 times Solid Angle Pixel Map (S3 `dr1/solid_angle_pixel_map/...`).

## 4. Cloud

Public S3 `nasa-irsa-spherex` (us-east-1, anonymous): prefixes `dr1/`, `qr3/`, `qr2/`. `cloud_access` column in SIA2 gives bucket+key; `fits.open('s3://...', fsspec_kwargs={'anon': True})` supports section reads.

## 5. Releases (design for easy update: release list must be a config value)

QR2 Oct 2025 (weekly) · QR3 weekly since Sept 2026 · DR1 November 2026 (Surveys 1-2 reprocessed + All-Sky Cube) · DR2 planned Dec 2027.
SPHEREx maps the full sky every ~6 months, so a given field has visits clustered at ~6-month intervals (each visit = several exposures over days).

## 6. Test targets (resolve names with `SkyCoord.from_name` / SIMBAD; never hardcode guessed coordinates)

- Barnard's Star: highest proper motion star (~10.4"/yr). Should move visibly between 6-month visits.
- Epsilon Indi B (Ba/Bb): brown dwarf pair, high proper motion (~4.7"/yr).
- WISE 0855-0714: RA 08h55m10.831s, Dec -07d14m42.53s (given by the challenge), ~8"/yr, extremely red/faint; large parallax (~0.44").
- RW Aurigae, R Draconis: variable stars, show brightness change, not motion.
Positions move with time: for overlays, propagate Gaia DR3 positions (epoch 2016.0) to the image epoch using pm and parallax (`SkyCoord.apply_space_motion`).

## 7. Overlays and display

- Aladin Lite v3 (CDS) for embedding; HiPS surveys of WISE/2MASS/DSS for context; Gaia DR3 catalog via VizieR `I/355/gaiadr3` or Gaia TAP.
- Display stretch: subtract ZODI, mask bad flags (set NaN), asinh or zscale stretch with the SAME limits across all frames (otherwise flicker hides motion).
- Moving-object aids: per-visit coadds (median of exposures within a visit), difference image (visit N - visit 1), blink.
