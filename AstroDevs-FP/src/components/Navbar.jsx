// AI-Assisted: the navbar generated with Claude Code (Anthropic) and reviewed by the team.
/**
 * Top bar: the layers (hamburger) button on the left, the search button in the middle,
 * and status badges (simulated sample, live data) plus help on the right.
 */
export default function Navbar({ drawerOpen, onMenu, onSearch, searchOpen, region, onHelp }) {
  return (
    <header className="navbar">
      <div className="nav-left">
        <button className={`icon-btn ${drawerOpen ? 'on' : ''}`} onClick={onMenu} aria-label="Layers and wavelengths (L)"
          title="Layers and wavelengths (L)" aria-expanded={drawerOpen}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <span className="brand">SkyBlink <small>SPHEREx time-lapse</small></span>
      </div>

      <button className={`search-trigger ${searchOpen ? 'on' : ''}`} onClick={onSearch} aria-expanded={searchOpen} title="Search (/)">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" fill="none" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        <span>Search by name, RA/Dec or a place on Earth</span>
        <kbd>/</kbd>
      </button>

      <div className="nav-right">
        {region?.simulated && <span className="pill warn" title={region.notes?.[0]}>Simulated sample</span>}
        {region?.live && <span className="pill">Live · beta</span>}
        <button className="icon-btn" onClick={onHelp} aria-label="How it works" title="How it works">?</button>
      </div>
    </header>
  )
}
