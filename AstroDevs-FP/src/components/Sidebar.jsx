// AI-Assisted: the sidebar component generated with Claude Code (Anthropic) and reviewed by the team.
/**
 * The right-hand column: tool bar, the region workspace, the timeline, tracking results and the
 * tabs (light curve, details, plain-language explanations).
 */
import { useMemo } from 'react'
import Workspace from './Workspace'
import Timeline from './Timeline'
import LightCurve from './LightCurve'
import { DETECTORS, detLabel, hasApi } from '../lib/data'
import { formatDec, formatRA } from '../lib/coords'
import { currentVisitIndex } from '../lib/playback'

const TOOLS = [
  ['pan', '✋', 'Move', 'Drag to pan, scroll to zoom, double-click to reset'],
  ['crop', '⬚', 'Cut out', 'Click on the sky map to open a region (C)'],
  ['track', '⌖', 'Track', 'Click a star to follow it through every visit (T)'],
  ['curve', '◐', 'Brightness', 'Click a star to plot its brightness over time'],
]
const FOVS = [[0.025, '1.5′'], [0.05, '3′'], [0.08, '4.8′'], [0.1, '6′'], [0.2, '12′']]

const EXPLAIN = [
  ['What am I looking at?', 'Real infrared images from NASA\'s SPHEREx space telescope, taken months apart. The colors are added by us: your eyes cannot see this light.'],
  ['Wavelengths', 'SPHEREx splits infrared light into 102 colors between 0.75 and 5 microns (µm), read by six detectors (D1–D6). Longer wavelengths reveal colder objects, like brown dwarfs.'],
  ['Why things move', 'Nearby stars drift across the sky as they orbit the galaxy, and Earth\'s yearly orbit makes close objects wobble (parallax). A dot that shifts between visits is close to us.'],
  ['The crosshair', 'It marks where Gaia and other catalogs predict the object should be on each date. If the dot follows the crosshair, the motion is real.'],
  ['Flagged pixels', 'Pixels the mission marked as unreliable (cosmic rays, saturation, ghosts) are blanked out so they do not look like new objects. A dot seen only once is usually noise.'],
]

export default function Sidebar({ s, dispatch, set, stageRef, onPick, onTrackTarget, onExportGif, onTarget, onCancel }) {
  const r = s.region
  const idx = r ? currentVisitIndex(s) : 0
  const visit = r?.visits[idx]
  const renderState = useMemo(() => r && ({
    visitId: visit.id, layers: s.layers, mode: s.mode, overlays: s.overlays,
    track: s.track, curvePoint: s.curvePoint, blend: s.blend,
  }), [r, visit, s.layers, s.mode, s.overlays, s.track, s.curvePoint, s.blend])

  const primary = s.layers.filter((l) => l.visible).at(-1) || s.layers.at(-1)
  const frameInfo = r && primary ? r.detectors.find((d) => d.det === primary.det)?.frames[visit.id] : null
  const trackStats = r && s.track ? trackSummary(r, s.track) : null

  return (
    <aside className="sidebar">
      <div className="toolbar" role="toolbar" aria-label="Tools">
        {TOOLS.map(([k, icon, label, tip]) => (
          <button key={k} className={s.tool === k ? 'on' : ''} onClick={() => set({ tool: k })} title={tip} aria-pressed={s.tool === k}>
            <span aria-hidden="true">{icon}</span>{label}
          </button>
        ))}
        <label className="fov" title="Size of the region to cut out. Bigger = slower to load live.">
          Size
          <select value={s.cropFov} onChange={(e) => set({ cropFov: +e.target.value })}>
            {FOVS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      {!r && s.status !== 'loading' && (
        <div className="empty">
          <h2>Pick a patch of sky</h2>
          <p>Search above, use <b>Cut out</b> on the sky map, or start with a test target:</p>
          <div className="chips">
            {s.index.map((t) => <button key={t.slug} className="chip" onClick={() => onTarget(t.slug)} title={t.blurb}>{t.name}</button>)}
          </div>
          {!hasApi && <p className="muted small">Live search of any position needs the API (beta). The five test targets always work.</p>}
        </div>
      )}
      {s.status === 'loading' && (
        <div className="empty"><div className="spinner" /><p>Loading SPHEREx visits… live regions can take a minute.</p>
          <button onClick={onCancel}>Cancel</button></div>
      )}
      {s.status === 'error' && <div className="empty error"><p>{s.error}</p></div>}

      {r && s.status !== 'loading' && (
        <>
          <div className="region-head">
            <div>
              <h2>{r.name}</h2>
              <p className="muted small">{formatRA(r.ra)} {formatDec(r.dec)} · {(r.fov_deg * 60).toFixed(1)}′ field</p>
            </div>
            {r.simulated && <span className="pill warn" title={r.notes?.[0]}>Simulated</span>}
          </div>
          {r.simulated && (
            <p className="sim-note">Simulated sample: real Gaia star positions, not SPHEREx pixels. The NASA archive was unavailable when this was built; it is replaced automatically when the real data is prebaked.</p>
          )}

          <div className="ws-wrap">
            <Workspace meta={r} frames={s.frames} renderState={renderState} tool={s.tool} onPick={onPick} stageRef={stageRef} />
            <div className="ws-caption">
              <span><i className="dot" style={{ background: primary ? DETECTORS[primary.det].color : '#fff' }} />{primary ? detLabel(primary.det) : ''}{frameInfo?.wl_um ? ` · λ ${frameInfo.wl_um} µm` : ''}</span>
              <span>{s.layers.filter((l) => l.visible).length} layer(s) · <button className="link" onClick={() => set({ drawer: true })}>edit</button></span>
            </div>
          </div>

          <Timeline s={s} set={set} dispatch={dispatch} onExportGif={onExportGif} />

          <div className="track-box">
            <button onClick={onTrackTarget} disabled={!r.target?.px}>⌖ Track {r.target?.name || 'target'}</button>
            {trackStats ? (
              <span>Moved <b>{trackStats.measured}″</b> in {trackStats.years} yr{trackStats.predicted !== null && <> · predicted <b>{trackStats.predicted}″</b></>}
                {' '}<button className="link" onClick={() => set({ track: null })}>clear</button></span>
            ) : <span className="muted small">or pick the Track tool and click any star</span>}
          </div>

          <div className="tabs small">
            {[['curve', 'Light curve'], ['details', 'Details'], ['explain', 'What am I looking at?']].map(([k, l]) => (
              <button key={k} className={s.tab === k ? 'on' : ''} onClick={() => set({ tab: k })}>{l}</button>
            ))}
          </div>
          {s.tab === 'curve' && <LightCurve s={s} set={set} />}
          {s.tab === 'details' && <Details r={r} visit={visit} frameInfo={frameInfo} primary={primary} />}
          {s.tab === 'explain' && (
            <dl className="explain">{EXPLAIN.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
          )}
        </>
      )}
      <footer className="credits">
        Data: NASA SPHEREx via NASA/IPAC IRSA · ESA Gaia DR3 · sky map Aladin Lite (CDS). Built for NASA Space Apps 2026.
      </footer>
    </aside>
  )
}

function trackSummary(r, track) {
  const ids = r.visits.map((v) => v.id).filter((id) => track[id])
  if (ids.length < 2) return null
  const a = track[ids[0]], b = track[ids.at(-1)]
  const measured = Math.hypot(b[0] - a[0], b[1] - a[1]) * r.pixscale_arcsec
  const va = r.visits.find((v) => v.id === ids[0]), vb = r.visits.find((v) => v.id === ids.at(-1))
  let predicted = null
  const tp = r.target?.px
  if (tp?.[ids[0]] && Math.hypot(tp[ids[0]][0] - a[0], tp[ids[0]][1] - a[1]) < 2) {
    predicted = Math.hypot(tp[ids.at(-1)][0] - tp[ids[0]][0], tp[ids.at(-1)][1] - tp[ids[0]][1]) * r.pixscale_arcsec
  } else {
    const star = r.gaia.find((g) => g.px[ids[0]] && Math.hypot(g.px[ids[0]][0] - a[0], g.px[ids[0]][1] - a[1]) < 1.5)
    if (star) predicted = Math.hypot(star.px[ids.at(-1)][0] - star.px[ids[0]][0], star.px[ids.at(-1)][1] - star.px[ids[0]][1]) * r.pixscale_arcsec
  }
  return {
    measured: measured.toFixed(1),
    predicted: predicted === null ? null : predicted.toFixed(1),
    years: ((vb.mjd - va.mjd) / 365.25).toFixed(1),
  }
}

function Details({ r, visit, frameInfo, primary }) {
  const t = r.target
  const rows = [
    ['Visit date', `${visit.date} (MJD ${visit.mjd.toFixed(2)})`],
    ['Detector', primary ? detLabel(primary.det) : '–'],
    ['Wavelength at target', frameInfo?.wl_um ? `${frameInfo.wl_um} µm${frameInfo.bw_um ? ` (band width ${frameInfo.bw_um} µm)` : ''}` : 'n/a'],
    ['Exposures stacked', frameInfo?.n_exp ?? 'no data this visit'],
    ['Flagged pixels', frameInfo ? `${(frameInfo.flag_frac * 100).toFixed(1)}% per exposure; ${((frameInfo.masked_frac || 0) * 100).toFixed(1)}% flagged in every exposure (filled in for display, shown with "Flagged pixels")` : '–'],
    ['Pixel scale', `${r.pixscale_arcsec}″ per pixel`],
    ['Data', r.release],
    ['Built', r.generated_utc],
  ]
  const ph = primary && r.photometry?.[String(primary.det)]?.[visit.id]
  const mode = primary && r.photometry_mode?.[String(primary.det)]
  if (ph) rows.push(['Target brightness', `${ph.flux.toFixed(3)} ± ${ph.err.toFixed(3)} ${r.photometry_unit || ''} (${mode ? `saturated star, ${mode}` : '2 px aperture'}, this band and visit)`])
  if (t) {
    rows.push(['Target motion', `${(Math.hypot(t.pmra, t.pmdec) / 1000).toFixed(2)}″/yr · parallax ${t.plx.toFixed(1)} mas`])
    rows.push(['Predicted shift', `${t.predicted_shift_arcsec}″ (${t.predicted_shift_px} px) over the visits`])
    rows.push(['Astrometry', t.source])
  }
  return (
    <table className="details"><tbody>
      {rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
    </tbody></table>
  )
}
