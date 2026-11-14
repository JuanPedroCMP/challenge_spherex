// AI-Assisted: the app state and main flows generated with Claude Code (Anthropic) and reviewed by the team.
/**
 * The whole app state lives here, in one reducer: which region is open, its layers, the
 * timeline, the active tool and the panels. It also handles the main flows - search, cutting
 * out a region, playback, keyboard shortcuts, GIF export - and keeps the URL in sync so any
 * view can be shared or embedded as a link.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react'
import Navbar from './components/Navbar'
import SearchPanel from './components/SearchPanel'
import LayersDrawer from './components/LayersDrawer'
import SkyView from './components/SkyView'
import Sidebar from './components/Sidebar'
import Onboarding from './components/Onboarding'
import { DETECTORS, hasApi, loadFrames, loadIndex, loadLive, loadPrebaked, resolveName } from './lib/data'
import { angularSep, parseCoords } from './lib/coords'
import { trackSource } from './lib/measure'
import { downloadGif } from './lib/gif'
import { makeLayer } from './lib/layers'
import { currentVisitIndex } from './lib/playback'

const initial = {
  index: [], region: null, frames: null, status: 'idle', error: '',
  tool: 'pan', cropFov: 0.08,
  layers: [], blend: 'add',
  frame: 0, range: [0, 0], playing: false, fps: 2, mode: 'animate',
  blinkA: 0, blinkB: 0, blinkPhase: 0, blinkMs: 600,
  overlays: { target: true, gaia: false, mask: false },
  track: null, curvePoint: null,
  drawer: false, search: false, intro: false, tab: 'curve',
  survey: 'spherex', slice: 25,
  focus: null, toast: '',
}

function reducer(s, a) {
  switch (a.type) {
    case 'set':
      return { ...s, ...a.patch }
    case 'regionLoaded': {
      const n = a.meta.visits.length
      const det = a.det && a.meta.detectors.some((d) => d.det === a.det) ? a.det : a.meta.detectors[0].det
      return {
        ...s, region: a.meta, frames: a.frames, status: 'ready', error: '',
        layers: a.layers || [makeLayer(det)],
        frame: 0, range: [0, n - 1], blinkA: 0, blinkB: n - 1, blinkPhase: 0,
        playing: n > 1, track: null, curvePoint: null, mode: a.mode || 'animate', search: false,
      }
    }
    case 'tick':
      if (s.mode === 'blink') return { ...s, blinkPhase: 1 - s.blinkPhase }
      return { ...s, frame: s.frame >= s.range[1] || s.frame < s.range[0] ? s.range[0] : s.frame + 1 }
    case 'step': {
      const n = s.region?.visits.length || 1
      return { ...s, playing: false, frame: Math.min(n - 1, Math.max(0, s.frame + a.d)) }
    }
    case 'layer':
      return { ...s, layers: s.layers.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l)) }
    case 'overlay':
      return { ...s, overlays: { ...s.overlays, ...a.patch } }
    default:
      return s
  }
}

/* ---------- URL <-> state (shareable / embeddable links) ---------- */
function readUrl() {
  const p = new URLSearchParams(window.location.search)
  const out = { target: p.get('target') }
  if (p.has('ra') && p.has('dec')) out.coords = { ra: +p.get('ra'), dec: +p.get('dec') }
  if (p.has('fov')) out.fov = Math.min(0.25, Math.max(0.02, +p.get('fov')))
  if (p.has('mode')) out.mode = p.get('mode')
  if (p.has('fps')) out.fps = +p.get('fps')
  if (p.has('det')) out.det = +p.get('det')
  if (p.has('sky')) out.sky = p.get('sky')
  if (p.has('slice')) out.slice = Math.min(101, Math.max(0, +p.get('slice')))
  if (p.has('layers')) {
    out.layers = p.get('layers').split(',').map((t) => {
      const [det, epoch, opacity, color] = t.split(':')
      return makeLayer(+det, { epoch: epoch === 'f' ? 'follow' : epoch, opacity: +opacity || 1, color: color ? `#${color}` : '#ffffff' })
    }).filter((l) => DETECTORS[l.det])
  }
  return out
}

function writeUrl(s) {
  if (!s.region) return
  const p = new URLSearchParams()
  if (s.region.slug && !s.region.live) p.set('target', s.region.slug)
  else { p.set('ra', s.region.ra.toFixed(5)); p.set('dec', s.region.dec.toFixed(5)); p.set('fov', s.region.fov_deg.toFixed(3)) }
  p.set('layers', s.layers.map((l) => `${l.det}:${l.epoch === 'follow' ? 'f' : l.epoch}:${+l.opacity.toFixed(2)}:${l.color.slice(1)}`).join(','))
  p.set('mode', s.mode)
  p.set('fps', String(s.fps))
  if (s.survey !== 'spherex') p.set('sky', s.survey)
  else p.set('slice', String(s.slice))
  window.history.replaceState(null, '', `${window.location.pathname}?${p}`)
}

export default function App() {
  const [s, dispatch] = useReducer(reducer, initial)
  const set = useCallback((patch) => dispatch({ type: 'set', patch }), [])
  const stageRef = useRef(null)
  const loadSeq = useRef(0)
  const urlInit = useRef(null)
  const toastTimer = useRef(0)

  const toast = useCallback((msg) => {
    set({ toast: msg })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => set({ toast: '' }), 6000)
  }, [set])

  const focusSky = useCallback((ra, dec, fov, projection) => {
    set({ focus: { ra, dec, fov, projection, n: Date.now() } })
  }, [set])

  const openRegion = useCallback(async (loader, extra = {}) => {
    const seq = ++loadSeq.current
    set({ status: 'loading', error: '' })
    try {
      const meta = await loader()
      const frames = await loadFrames(meta)
      if (seq !== loadSeq.current) return
      dispatch({ type: 'regionLoaded', meta, frames, ...extra })
      focusSky(meta.ra, meta.dec, Math.max(0.4, meta.fov_deg * 5), 'SIN')
    } catch (e) {
      if (seq !== loadSeq.current) return
      set({ status: 'error', error: e.message })
    }
  }, [set, focusSky])

  const selectTarget = useCallback((slug, extra = {}) => {
    const t = s.index.find((x) => x.slug === slug)
    openRegion(() => loadPrebaked(slug), { ...extra, det: extra.det ?? t?.default_det })
  }, [openRegion, s.index])

  const nearestPreset = useCallback((ra, dec, maxDeg) => {
    let best = null
    for (const t of s.index) {
      const d = angularSep(ra, dec, t.ra, t.dec)
      if (d <= maxDeg && (!best || d < best.d)) best = { ...t, d }
    }
    return best
  }, [s.index])

  const cropAt = useCallback((ra, dec, name) => {
    const preset = nearestPreset(ra, dec, s.cropFov / 2 + 0.03)
    if (preset) { selectTarget(preset.slug); return }
    if (!hasApi) {
      toast('Live SPHEREx search runs on our API (beta), which is not connected here. Try one of the 5 test targets.')
      return
    }
    openRegion(() => loadLive({ ra, dec, fov: s.cropFov, dets: [1, 3, 5], name }))
  }, [nearestPreset, s.cropFov, selectTarget, openRegion, toast])

  const search = useCallback(async (text) => {
    const q = text.trim()
    if (!q) return
    const lower = q.toLowerCase()
    const preset = s.index.find((t) => t.slug === lower || t.name.toLowerCase().includes(lower) || lower.includes(t.name.toLowerCase()))
    if (preset) { selectTarget(preset.slug); return }
    const c = parseCoords(q)
    if (c) { focusSky(c.ra, c.dec, 0.5, 'SIN'); cropAt(c.ra, c.dec); return }
    if (!hasApi) { toast(`"${q}" is not one of the test targets. Enter RA/Dec, e.g. 08h55m10.8s -7d14m42s`); return }
    try {
      const r = await resolveName(q)
      focusSky(r.ra_now, r.dec_now, 0.5, 'SIN')
      cropAt(r.ra_now, r.dec_now, q)
    } catch (e) { toast(e.message) }
  }, [s.index, selectTarget, focusSky, cropAt, toast])

  // index + URL on start
  useEffect(() => {
    urlInit.current = readUrl()
    const u0 = urlInit.current
    if (u0.sky && ['spherex', '2mass', 'dss'].includes(u0.sky)) set({ survey: u0.sky })
    if (u0.slice !== undefined) set({ slice: u0.slice })
    loadIndex().then((index) => set({ index })).catch(() => set({ index: [] }))
    try {
      if (!localStorage.getItem('skyblink-intro')) set({ intro: true })
    } catch { /* storage blocked */ }
  }, [set])

  useEffect(() => {
    const u = urlInit.current
    if (!s.index.length || !u) return
    urlInit.current = null
    if (u.fov) set({ cropFov: u.fov })
    if (u.fps) set({ fps: u.fps })
    const extra = { det: u.det, layers: u.layers?.length ? u.layers : undefined, mode: u.mode }
    const tgt = s.index.find((t) => t.slug === u.target)
    if (tgt) {
      extra.det = extra.det ?? tgt.default_det
      openRegion(() => loadPrebaked(u.target), extra)
      set({ intro: false })
    } else if (u.coords) {
      const preset = nearestPreset(u.coords.ra, u.coords.dec, 0.07)
      if (preset) openRegion(() => loadPrebaked(preset.slug), { ...extra, det: extra.det ?? preset.default_det })
      else if (hasApi) openRegion(() => loadLive({ ...u.coords, fov: u.fov || 0.08, dets: [1, 3, 5] }), extra)
      else focusSky(u.coords.ra, u.coords.dec, 0.5, 'SIN')
      set({ intro: false })
    }
  }, [s.index, set, openRegion, nearestPreset, focusSky])

  useEffect(() => { writeUrl(s) }, [s.region, s.layers, s.mode, s.fps, s.survey, s.slice]) // eslint-disable-line react-hooks/exhaustive-deps

  // playback
  useEffect(() => {
    if (!s.playing || !s.region || s.region.visits.length < 2) return
    const ms = s.mode === 'blink' ? s.blinkMs : 1000 / s.fps
    const t = setInterval(() => dispatch({ type: 'tick' }), ms)
    return () => clearInterval(t)
  }, [s.playing, s.mode, s.fps, s.blinkMs, s.region])

  // keyboard shortcuts (desktop)
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key
      if (k === ' ') { e.preventDefault(); set({ playing: !s.playing }) }
      else if (k === 'ArrowRight') dispatch({ type: 'step', d: 1 })
      else if (k === 'ArrowLeft') dispatch({ type: 'step', d: -1 })
      else if (k === 'b' || k === 'B') set({ mode: 'blink', playing: true })
      else if (k === 'a' || k === 'A') set({ mode: 'animate' })
      else if (k === 'd' || k === 'D') set({ mode: 'diff' })
      else if (k === 'c' || k === 'C') set({ tool: s.tool === 'crop' ? 'pan' : 'crop' })
      else if (k === 't' || k === 'T') set({ tool: 'track' })
      else if (k === 'l' || k === 'L') set({ drawer: !s.drawer })
      else if (k === '/') { e.preventDefault(); set({ search: true }) }
      else if (k === 'Escape') set({ search: false, drawer: false, intro: false, tool: 'pan' })
      else if (k === ']') set({ fps: Math.min(8, s.fps * 1.5) })
      else if (k === '[') set({ fps: Math.max(0.5, s.fps / 1.5) })
      else if (/^[1-6]$/.test(k) && s.layers.length && s.region?.detectors.some((d) => d.det === +k)) {
        const top = s.layers[s.layers.length - 1]
        dispatch({ type: 'layer', id: top.id, patch: { det: +k } })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s.playing, s.tool, s.drawer, s.fps, s.layers, s.region, set])

  const primaryDet = () => {
    const vis = s.layers.filter((l) => l.visible)
    return (vis[vis.length - 1] || s.layers[s.layers.length - 1])?.det
  }

  const onPick = useCallback((x, y) => {
    if (!s.region) return
    const idx = currentVisitIndex(s)
    if (s.tool === 'track') {
      const det = primaryDet()
      const path = trackSource(s.region, s.frames, det, idx, x, y)
      if (!path) toast('No star found there. Click closer to a bright dot.')
      set({ track: path })
    } else if (s.tool === 'curve') {
      set({ curvePoint: [x, y], tab: 'curve' })
    }
  }, [s, set, toast]) // eslint-disable-line react-hooks/exhaustive-deps

  const trackTarget = useCallback(() => {
    if (!s.region?.target?.px) return
    const idx = currentVisitIndex(s)
    const p = s.region.target.px[s.region.visits[idx].id]
    const path = trackSource(s.region, s.frames, primaryDet(), idx, p[0], p[1])
    if (!path) toast('The target is too faint in this band to track. Try another detector.')
    set({ track: path, overlays: { ...s.overlays, target: true } })
  }, [s, set, toast]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportGif = useCallback(() => {
    const stage = stageRef.current
    if (!stage || !s.region) return
    const v = s.region.visits
    const idxs = s.mode === 'blink' ? [s.blinkA, s.blinkB] : Array.from({ length: s.range[1] - s.range[0] + 1 }, (_, i) => s.range[0] + i)
    const det = primaryDet()
    const frames = idxs.map((i) => stage.snapshot(
      { visitId: v[i].id, layers: s.layers, mode: s.mode === 'blink' ? 'animate' : s.mode, overlays: s.overlays, track: s.track, curvePoint: s.curvePoint, blend: s.blend },
      `${s.region.name} · ${v[i].date} · D${det}${s.mode === 'diff' ? ' difference' : ''}${s.region.simulated ? ' · SIMULATED' : ''}`,
    ))
    const delay = s.mode === 'blink' ? s.blinkMs : Math.round(1000 / s.fps)
    downloadGif(frames, delay, `${s.region.slug || 'region'}-${s.mode}.gif`)
  }, [s]) // eslint-disable-line react-hooks/exhaustive-deps

  const onEarth = useCallback(({ ra, dec, label }) => {
    focusSky(ra, dec, 180, 'SIN')
    set({ search: false })
    toast(`Sky overhead from ${label}. The edge of the map is your horizon.`)
  }, [focusSky, set, toast])

  return (
    <div className="app">
      <Navbar
        drawerOpen={s.drawer} onMenu={() => set({ drawer: !s.drawer })}
        onSearch={() => set({ search: !s.search })} searchOpen={s.search}
        region={s.region} onHelp={() => set({ intro: true })}
      />
      {s.search && (
        <SearchPanel index={s.index} onSearch={search} onTarget={(slug) => selectTarget(slug)}
          onEarth={onEarth} onClose={() => set({ search: false })} />
      )}
      <main className="main">
        <section className="sky">
          <SkyView
            survey={s.survey} slice={s.slice} focus={s.focus} region={s.region} targets={s.index}
            cropMode={s.tool === 'crop'} cropFov={s.cropFov}
            onCrop={(ra, dec) => { set({ tool: 'pan' }); cropAt(ra, dec) }} onPickTarget={(slug) => selectTarget(slug)}
          />
          <LayersDrawer open={s.drawer} s={s} dispatch={dispatch} set={set} />
          {s.toast && <div className="toast" role="status">{s.toast}</div>}
        </section>
        <Sidebar s={s} dispatch={dispatch} set={set} stageRef={stageRef} onPick={onPick}
          onTrackTarget={trackTarget} onExportGif={exportGif} onTarget={selectTarget}
          onCancel={() => { loadSeq.current++; set({ status: s.region ? 'ready' : 'idle' }) }} />
      </main>
      {s.intro && (
        <Onboarding index={s.index} onStart={(slug) => {
          try { localStorage.setItem('skyblink-intro', '1') } catch { /* storage blocked */ }
          set({ intro: false })
          if (slug) selectTarget(slug)
        }} />
      )}
    </div>
  )
}
