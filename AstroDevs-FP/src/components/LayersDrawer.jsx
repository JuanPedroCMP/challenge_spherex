// AI-Assisted: the layers drawer generated with Claude Code (Anthropic) and reviewed by the team.
/**
 * The panel behind the hamburger button: pick which wavelengths and which dates are on screen,
 * mix them, and tune opacity and contrast per layer. It also picks the sky-map background band.
 */
import { makeLayer } from '../lib/layers'
import { DETECTORS, SKY_SURVEYS, detLabel, sliceInfo } from '../lib/data'

export default function LayersDrawer({ open, s, dispatch, set }) {
  const region = s.region
  const dets = region ? region.detectors.map((d) => d.det) : []
  const visits = region?.visits || []
  const patch = (id, p) => dispatch({ type: 'layer', id, patch: p })
  const setLayers = (layers) => set({ layers })

  const move = (i, d) => {
    const l = [...s.layers]
    const j = i + d
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    setLayers(l)
  }

  const presets = region && [
    { label: 'One band', title: 'A single wavelength in white', make: () => [makeLayer(s.layers.at(-1)?.det || dets[0])] },
    { label: 'False color', title: 'Every band in its own color, short = blue, long = red', make: () => dets.map((d) => makeLayer(d, { color: DETECTORS[d].color, opacity: 0.85 })) },
    {
      label: 'Then vs now', title: 'First visit in blue, the playing visit in orange: anything that moved shows two colors',
      make: () => {
        const d = s.layers.at(-1)?.det || dets[0]
        return [makeLayer(d, { epoch: visits[0].id, color: '#3d8bff' }), makeLayer(d, { color: '#ffb347' })]
      },
    },
  ]

  const info = sliceInfo(s.slice)

  return (
    <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open} inert={open ? undefined : ''}>
      <div className="drawer-head">
        <h2>Layers</h2>
        <button className="icon-btn" onClick={() => set({ drawer: false })} aria-label="Close layers">×</button>
      </div>

      {!region && <p className="muted">Pick a region first (search, a test target, or the crop tool).</p>}

      {region && (
        <>
          <div className="presets">
            {presets.map((p) => <button key={p.label} title={p.title} onClick={() => setLayers(p.make())}>{p.label}</button>)}
          </div>
          <label className="field inline">
            <span>Mix</span>
            <select value={s.blend} onChange={(e) => set({ blend: e.target.value })}>
              <option value="add">Add light (bands sum up)</option>
              <option value="screen">Screen (softer)</option>
              <option value="normal">Normal (top layer covers)</option>
            </select>
          </label>

          <ol className="layer-list">
            {[...s.layers].map((l, i) => ({ l, i })).reverse().map(({ l, i }) => (
              <li key={l.id} className={`layer ${l.visible ? '' : 'off'}`}>
                <div className="layer-row">
                  <input type="checkbox" checked={l.visible} onChange={(e) => patch(l.id, { visible: e.target.checked })} aria-label="Show layer" />
                  <input type="color" value={l.color} onChange={(e) => patch(l.id, { color: e.target.value })} aria-label="Layer color" />
                  <select value={l.det} onChange={(e) => patch(l.id, { det: +e.target.value })} aria-label="Wavelength">
                    {dets.map((d) => <option key={d} value={d}>{detLabel(d)}</option>)}
                  </select>
                  <div className="layer-actions">
                    <button onClick={() => move(i, 1)} aria-label="Move up" title="Move up">↑</button>
                    <button onClick={() => move(i, -1)} aria-label="Move down" title="Move down">↓</button>
                    <button onClick={() => setLayers(s.layers.filter((x) => x.id !== l.id))} aria-label="Remove layer" title="Remove" disabled={s.layers.length === 1}>×</button>
                  </div>
                </div>
                <p className="layer-hint">{DETECTORS[l.det].hint}</p>
                <label className="field">
                  <span>Time</span>
                  <select value={l.epoch} onChange={(e) => patch(l.id, { epoch: e.target.value })}>
                    <option value="follow">Follow the timeline</option>
                    {visits.map((v, k) => <option key={v.id} value={v.id}>Fixed: visit {k + 1} · {v.date}</option>)}
                  </select>
                </label>
                <Slider label="Opacity" min={0} max={1} step={0.01} value={l.opacity} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => patch(l.id, { opacity: v })} />
                <Slider label="Black point" min={0} max={250} step={1} value={l.black} onChange={(v) => patch(l.id, { black: Math.min(v, l.white - 5) })} />
                <Slider label="White point" min={5} max={255} step={1} value={l.white} onChange={(v) => patch(l.id, { white: Math.max(v, l.black + 5) })} />
                <Slider label="Midtones" min={0.3} max={3} step={0.05} value={l.gamma} fmt={(v) => `γ ${v.toFixed(2)}`} onChange={(v) => patch(l.id, { gamma: v })} />
                <button className="link" onClick={() => patch(l.id, { black: 0, white: 255, gamma: 1, opacity: 1 })}>Reset contrast</button>
              </li>
            ))}
          </ol>
          <button className="wide" onClick={() => setLayers([...s.layers, makeLayer(dets.find((d) => !s.layers.some((l) => l.det === d)) || dets[0], { opacity: 0.8 })])}>
            + Add layer
          </button>
        </>
      )}

      <h3>Sky map background</h3>
      <div className="radio-col">
        {Object.entries(SKY_SURVEYS).map(([k, v]) => (
          <label key={k}><input type="radio" name="survey" checked={s.survey === k} onChange={() => set({ survey: k })} /> {v.name}</label>
        ))}
      </div>
      {s.survey === 'spherex' && (
        <Slider label={`Band ${s.slice + 1}/102 · D${info.det} · ${info.wl.toFixed(3)} µm${info.blank ? ' (blank)' : ''}`} min={0} max={101} step={1}
          value={s.slice} onChange={(v) => set({ slice: v })} fmt={() => ''} />
      )}
      <p className="muted small">The sky map is the SPHEREx all-sky average. The time-lapse comes from the separate visits inside the selected region.</p>
    </aside>
  )
}

function Slider({ label, min, max, step, value, onChange, fmt = (v) => v }) {
  return (
    <label className="field">
      <span>{label} <em>{fmt(value)}</em></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  )
}
