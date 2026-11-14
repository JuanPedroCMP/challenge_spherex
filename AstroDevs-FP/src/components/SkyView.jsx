// AI-Assisted: the whole-sky map component generated with Claude Code (Anthropic) and reviewed by the team.
/**
 * The big sky map, powered by Aladin Lite (CDS) and the SPHEREx all-sky cube from IRSA.
 *
 * It shows the whole sky, lets people zoom anywhere, marks the test targets, draws the selected
 * region, and in "Cut out" mode turns a click into a new region.
 */
import { useEffect, useRef, useState } from 'react'
import A from 'aladin-lite'
import { SKY_SURVEYS, sliceInfo } from '../lib/data'
import { squareCorners } from '../lib/coords'

/**
 * Aladin 3.8 maps setSliceNumber(n) to a tile frame assuming frames are evenly spaced in frequency:
 * frame = floor((nu - nuMin) / (nuMax - nuMin) * depth), nu = c / (emMin + n/depth * (emMax - emMin)).
 * The SPHEREx cube is ordered by wavelength, so invert that to request exactly frame k (measured 2026-11-14).
 */
function aladinSlice(layer, k) {
  const { emMin, emMax, cubeDepth: d } = layer
  if (!emMin || !emMax || !d) return k
  const nuMin = 1 / emMax, nuMax = 1 / emMin
  const nu = nuMin + ((k + 0.5) / d) * (nuMax - nuMin)
  return ((1 / nu - emMin) / (emMax - emMin)) * d
}

export default function SkyView({ survey, slice, focus, region, targets, cropMode, cropFov, onCrop, onPickTarget }) {
  const el = useRef(null)
  const aladin = useRef(null)
  const ov = useRef({})
  const cb = useRef({})
  const base = useRef(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState('')

  useEffect(() => { cb.current = { onCrop, onPickTarget, cropMode, cropFov } })

  useEffect(() => {
    let alive = true
    const div = el.current
    A.init.then(() => {
      if (!alive) return
      const a = A.aladin(div, {
        survey: SKY_SURVEYS.spherex.url, fov: 360, projection: 'MOL', cooFrame: 'ICRSd', target: '0 +0',
        showReticle: false, showZoomControl: true, showFullscreenControl: false, showLayersControl: false,
        showGotoControl: false, showShareControl: false, showSimbadPointerControl: false, showCooGridControl: true,
        showSettingsControl: false, showProjectionControl: false, showFrame: true, showCooLocation: true,
        showStatusBar: false, showContextMenu: false,
      })
      aladin.current = a
      if (import.meta.env.DEV) window.__skyblink = { aladin: a } // debugging hook
      ov.current.region = A.graphicOverlay({ color: '#6fb3ff', lineWidth: 2, name: 'Selected region' })
      ov.current.cursor = A.graphicOverlay({ color: '#ffb347', lineWidth: 1.5, name: 'Crop preview' })
      ov.current.targets = A.catalog({ name: 'Test targets', color: '#ffb347', sourceSize: 18, shape: 'circle',
        displayLabel: true, labelColumn: 'name', labelColor: '#ffd8a8', labelFont: '13px system-ui' })
      a.addOverlay(ov.current.region)
      a.addOverlay(ov.current.cursor)
      a.addCatalog(ov.current.targets)
      a.on('click', (e) => {
        if (e && !e.isDragging && cb.current.cropMode) cb.current.onCrop(e.ra, e.dec)
      })
      a.on('mouseMove', (e) => {
        const o = ov.current.cursor
        o.removeAll()
        if (cb.current.cropMode && e && isFinite(e.ra)) o.add(A.polygon(squareCorners(e.ra, e.dec, cb.current.cropFov)))
      })
      a.on('objectClicked', (obj) => {
        const slug = obj?.data?.slug
        if (slug) cb.current.onPickTarget(slug)
      })
      setReady(true)
    }).catch((e) => setFailed(e.message || 'Sky map failed to start (WebGL2 needed)'))
    return () => { alive = false; div.innerHTML = ''; aladin.current = null }
  }, [])

  useEffect(() => {
    const a = aladin.current
    if (!ready || !a) return
    const sv = SKY_SURVEYS[survey]
    const layer = A.HiPS(sv.url, { name: sv.name, imgFormat: sv.format })
    a.setBaseImageLayer(layer)
    base.current = layer
  }, [ready, survey])

  // A cube slice only sticks once Aladin has added the layer, so wait for it.
  useEffect(() => {
    if (!ready || survey !== 'spherex') return
    let tries = 0
    let timer = 0
    const apply = () => {
      const layer = base.current
      if (layer?.added && layer.setSliceNumber) layer.setSliceNumber(aladinSlice(layer, slice))
      if (tries++ < 25) timer = setTimeout(apply, 200) // re-apply briefly: Aladin may reset it while loading
    }
    apply()
    return () => clearTimeout(timer)
  }, [ready, survey, slice])

  useEffect(() => {
    const a = aladin.current
    if (!ready || !a || !focus) return
    if (focus.projection) a.setProjection(focus.projection)
    a.gotoRaDec(focus.ra, focus.dec)
    a.setFoV(focus.fov)
  }, [ready, focus])

  useEffect(() => {
    if (!ready) return
    const o = ov.current.region
    o.removeAll()
    if (region) o.add(A.polygon(squareCorners(region.ra, region.dec, region.fov_deg)))
  }, [ready, region])

  useEffect(() => {
    if (!ready) return
    const c = ov.current.targets
    c.removeAll()
    c.addSources(targets.map((t) => A.source(t.ra, t.dec, { name: t.name, slug: t.slug })))
  }, [ready, targets])

  useEffect(() => {
    if (!ready || cropMode) return
    ov.current.cursor.removeAll()
  }, [ready, cropMode])

  const wholeSky = () => {
    const a = aladin.current
    if (!a) return
    a.setProjection('MOL')
    a.setFoV(360)
  }

  const info = survey === 'spherex' ? sliceInfo(slice) : null

  return (
    <div className={`skyview ${cropMode ? 'cropping' : ''}`}>
      <div ref={el} className="aladin" />
      <div className="sky-hud">
        <button onClick={wholeSky} title="Show the whole sky">Whole sky</button>
        {region && <button onClick={() => { const a = aladin.current; a.setProjection('SIN'); a.gotoRaDec(region.ra, region.dec); a.setFoV(Math.max(0.4, region.fov_deg * 5)) }}>Zoom to region</button>}
        <span className="sky-label">
          {SKY_SURVEYS[survey].name}{info ? ` · D${info.det} · ${info.wl.toFixed(3)} µm${info.blank ? ' (blank band)' : ''}` : ''}
        </span>
      </div>
      {cropMode && <div className="sky-banner">Click on the sky to cut out a {(cropFov * 60).toFixed(1)}′ region · Esc to cancel</div>}
      {failed && <div className="sky-banner error">{failed}</div>}
    </div>
  )
}
