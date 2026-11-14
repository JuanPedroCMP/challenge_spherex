// AI-Assisted: the timeline component generated with Claude Code (Anthropic) and reviewed by the team.
/**
 * The timeline under the workspace: view mode (time-lapse, blink, difference), play/pause,
 * the visit slider with real dates, the period (from/to), speed, overlays and GIF export.
 */
import { currentVisitIndex, showLabel } from '../lib/playback'

export default function Timeline({ s, set, dispatch, onExportGif }) {
  const visits = s.region.visits
  const n = visits.length
  const idx = currentVisitIndex(s)
  const [from, to] = s.range
  const yrs = (visits[n - 1].mjd - visits[0].mjd) / 365.25

  return (
    <div className="timeline">
      <div className="seg" role="tablist" aria-label="View mode">
        {[['animate', 'Time-lapse', 'A'], ['blink', 'Blink', 'B'], ['diff', 'Difference', 'D']].map(([k, label, key]) => (
          <button key={k} role="tab" aria-selected={s.mode === k} className={s.mode === k ? 'on' : ''}
            onClick={() => set({ mode: k, playing: k === 'diff' ? s.playing : true })} title={`${label} (${key})`}>{label}</button>
        ))}
      </div>

      <div className="transport">
        <button onClick={() => dispatch({ type: 'step', d: -1 })} aria-label="Previous visit" disabled={s.mode === 'blink'}>◀</button>
        <button className="play" onClick={() => set({ playing: !s.playing })} aria-label={s.playing ? 'Pause' : 'Play'} title="Play / pause (space)">
          {s.playing ? '❚❚' : '▶'}
        </button>
        <button onClick={() => dispatch({ type: 'step', d: 1 })} aria-label="Next visit" disabled={s.mode === 'blink'}>▶</button>
        <div className="now">
          <strong>{visits[idx].date}</strong>
          <span>visit {idx + 1} of {n}{n > 1 ? ` · ${yrs.toFixed(1)} years covered` : ''}</span>
        </div>
      </div>

      <div className="track">
        <input type="range" min={0} max={Math.max(0, n - 1)} step={1} value={s.frame} disabled={s.mode === 'blink' || n < 2}
          onChange={(e) => set({ frame: +e.target.value, playing: false })} aria-label="Visit" />
        <div className="ticks">
          {visits.map((v, i) => (
            <span key={v.id} className={`${i < from || i > to ? 'out' : ''} ${i === idx ? 'cur' : ''}`}
              style={{ left: n > 1 ? `${(i / (n - 1)) * 100}%` : '50%' }}>{showLabel(i, n) || i === idx ? v.date.slice(0, 7) : ''}</span>
          ))}
        </div>
      </div>

      {s.mode === 'blink' ? (
        <div className="controls">
          <label>A <select value={s.blinkA} onChange={(e) => set({ blinkA: +e.target.value })}>{visits.map((v, i) => <option key={v.id} value={i}>{v.date}</option>)}</select></label>
          <label>B <select value={s.blinkB} onChange={(e) => set({ blinkB: +e.target.value })}>{visits.map((v, i) => <option key={v.id} value={i}>{v.date}</option>)}</select></label>
          <label className="grow">Every <input type="range" min={150} max={1500} step={50} value={s.blinkMs} onChange={(e) => set({ blinkMs: +e.target.value })} /> {(s.blinkMs / 1000).toFixed(2)} s</label>
        </div>
      ) : (
        <div className="controls">
          <label>From <select value={from} onChange={(e) => { const a = +e.target.value; set({ range: [a, Math.max(a, to)], frame: a }) }}>{visits.map((v, i) => <option key={v.id} value={i}>{v.date}</option>)}</select></label>
          <label>to <select value={to} onChange={(e) => { const b = +e.target.value; set({ range: [Math.min(from, b), b], frame: Math.min(from, b) }) }}>{visits.map((v, i) => <option key={v.id} value={i}>{v.date}</option>)}</select></label>
          <label className="grow">Speed <input type="range" min={0.5} max={8} step={0.5} value={s.fps} onChange={(e) => set({ fps: +e.target.value })} /> {s.fps} fps</label>
        </div>
      )}

      <div className="controls">
        <label><input type="checkbox" checked={s.overlays.target} onChange={(e) => dispatch({ type: 'overlay', patch: { target: e.target.checked } })} /> Predicted position</label>
        <label><input type="checkbox" checked={s.overlays.gaia} onChange={(e) => dispatch({ type: 'overlay', patch: { gaia: e.target.checked } })} /> Gaia stars ({s.region.gaia.length})</label>
        <label title="Pixels the mission flagged as unreliable (saturated star cores, cosmic rays, dead pixels). In the picture they are filled in from their neighbours."><input type="checkbox" checked={s.overlays.mask} onChange={(e) => dispatch({ type: 'overlay', patch: { mask: e.target.checked } })} /> Flagged pixels</label>
        <button className="ghost" onClick={onExportGif} disabled={n < 2} title="Download this loop as an animated GIF">⤓ GIF</button>
      </div>
      {s.mode === 'diff' && (
        <p className="legend"><i className="sw blue" /> fainter now (where it was) <i className="sw orange" /> brighter now (where it is) · compared with the first visit</p>
      )}
    </div>
  )
}
