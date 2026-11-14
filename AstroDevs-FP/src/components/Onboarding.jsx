// AI-Assisted: the welcome dialog generated with Claude Code (Anthropic) and reviewed by the team.
/**
 * First-visit welcome: three steps that explain the idea in plain words, then drop the user
 * straight into a moving star.
 */
export default function Onboarding({ index, onStart }) {
  const first = index.find((t) => t.slug === 'barnards-star') || index[0]
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="modal">
        <h2 id="intro-title">Blink the infrared sky</h2>
        <p>Pluto was found by comparing two photos of the sky taken weeks apart. SPHEREx photographs the whole sky every six months in 102 infrared colors. This tool lets you flip through those photos.</p>
        <ol className="steps">
          <li><b>Pick a patch of sky</b>: search a name or RA/Dec, or use <em>Cut out</em> on the map.</li>
          <li><b>Press play</b>: the visits loop like a short video. Try <em>Blink</em> and <em>Difference</em>.</li>
          <li><b>Look for what moves</b>: a dot that shifts is a nearby star, brown dwarf or asteroid.</li>
        </ol>
        <p className="muted small">Keys: space play/pause · ← → step · B blink · D difference · C cut out · T track · L layers · / search</p>
        <div className="modal-actions">
          {first && <button className="primary" onClick={() => onStart(first.slug)}>Start with {first.name}</button>}
          <button onClick={() => onStart(null)}>Explore the whole sky</button>
        </div>
      </div>
    </div>
  )
}
