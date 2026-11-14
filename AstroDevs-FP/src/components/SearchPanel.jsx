// AI-Assisted: the search panel generated with Claude Code (Anthropic) and reviewed by the team.
/**
 * The search bar that opens from the navbar. Two tabs: find an object or coordinates, or
 * show the sky above a place on Earth (address or latitude/longitude, plus a time).
 */
import { useState } from 'react'
import { geocode, zenith } from '../lib/earth'
import { formatDec, formatRA } from '../lib/coords'

const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

export default function SearchPanel({ index, onSearch, onTarget, onEarth, onClose }) {
  const [tab, setTab] = useState('sky')
  const [q, setQ] = useState('')
  const [place, setPlace] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [when, setWhen] = useState(() => toLocalInput(new Date()))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submitSky = (e) => { e.preventDefault(); onSearch(q) }

  const submitEarth = async (e) => {
    e.preventDefault()
    setErr('')
    let la = parseFloat(lat), lo = parseFloat(lon), label = `${la.toFixed(2)}°, ${lo.toFixed(2)}°`
    try {
      setBusy(true)
      if (place.trim()) {
        const g = await geocode(place.trim())
        la = g.lat; lo = g.lon; label = g.label.split(',').slice(0, 2).join(',')
        setLat(la.toFixed(4)); setLon(lo.toFixed(4))
      }
      if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90) throw new Error('Enter an address or a latitude/longitude')
      const z = zenith(la, lo, new Date(when))
      onEarth({ ...z, label: `${label} on ${new Date(when).toLocaleString()} (zenith ${formatRA(z.ra)} ${formatDec(z.dec)})` })
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="search-panel" role="dialog" aria-label="Search">
      <div className="tabs">
        <button className={tab === 'sky' ? 'on' : ''} onClick={() => setTab('sky')}>Object or RA/Dec</button>
        <button className={tab === 'earth' ? 'on' : ''} onClick={() => setTab('earth')}>Sky from a place on Earth</button>
        <button className="close" onClick={onClose} aria-label="Close search">×</button>
      </div>

      {tab === 'sky' ? (
        <form onSubmit={submitSky}>
          <div className="row">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label="Object name or coordinates"
              placeholder="WISE 0855   ·   08h55m10.8s -7d14m42s   ·   133.795 -7.245" />
            <button className="primary" type="submit">Go</button>
          </div>
          <p className="hint">Right Ascension then Declination, in hours/degrees (08h55m10.8s -7d14m42s, 08:55:10.8 -07:14:42) or decimal degrees.</p>
          <div className="chips">
            {index.map((t) => (
              <button key={t.slug} type="button" className="chip" onClick={() => onTarget(t.slug)} title={t.blurb}>
                {t.name}<small>{t.kind === 'variable' ? 'variable' : 'moving'}</small>
              </button>
            ))}
          </div>
        </form>
      ) : (
        <form onSubmit={submitEarth}>
          <div className="row">
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Address or city, e.g. São Paulo, Brazil" aria-label="Address" />
          </div>
          <div className="row">
            <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude (-23.55)" aria-label="Latitude" />
            <input value={lon} onChange={(e) => setLon(e.target.value)} placeholder="Longitude (-46.63)" aria-label="Longitude" />
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Date and time" />
            <button className="primary" type="submit" disabled={busy}>{busy ? '…' : 'Show sky'}</button>
          </div>
          <p className="hint">Points the map at the zenith (straight up) for that place and time. Address lookup by OpenStreetMap Nominatim.</p>
          {err && <p className="error">{err}</p>}
        </form>
      )}
    </div>
  )
}
