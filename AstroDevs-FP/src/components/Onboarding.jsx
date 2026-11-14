// AI-Assisted: the welcome dialog generated with Claude Code (Anthropic) and reviewed by the team.
/**
 * First-visit welcome: the idea in a few plain sentences, then straight into a moving star.
 * One clear primary action (start with Barnard's Star) and one quiet alternative.
 */
import { useEffect, useRef } from 'react'

export default function Onboarding({ index, onStart }) {
  const first = index.find((t) => t.slug === 'barnards-star') || index[0]
  const primary = useRef(null)
  useEffect(() => { primary.current?.focus() }, [first])

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="modal">
        <p className="eyebrow">How it works</p>
        <h2 id="intro-title">Watch the infrared sky change</h2>
        <p>In 1930, Clyde Tombaugh found Pluto by flipping between two photos of the same stars, taken days apart, and spotting the one dot that moved.</p>
        <p>NASA's SPHEREx telescope photographs the whole sky every six months, in 102 shades of infrared light. CosmoSight lets you flip through those photos the same way.</p>
        <ol className="steps">
          <li><span className="step-n mono">1</span><span><b>Pick a patch of sky.</b> Search for a star or coordinates, or click <em>Cut out</em> and then the map.</span></li>
          <li><span className="step-n mono">2</span><span><b>Press play.</b> The visits loop like a short film.</span></li>
          <li><span className="step-n mono">3</span><span><b>Look for what moves.</b> If one dot shifts while the stars around it stay put, it is close to us.</span></li>
        </ol>
        <div className="modal-actions">
          {first && <button ref={primary} className="primary" onClick={() => onStart(first.slug)}>Show me {first.name}</button>}
          <button className="ghost" onClick={() => onStart(null)}>I'll explore on my own</button>
        </div>
        <p className="muted small keys">Shortcuts: {[['space', 'play'], ['← →', 'step'], ['B', 'compare'], ['D', 'changes'], ['C', 'cut out'], ['S', 'spectrum'], ['L', 'wavelengths'], ['/', 'search']].map(([k, l]) => (
          <span key={k} className="key-pair"><kbd>{k}</kbd> {l}</span>
        ))}</p>
      </div>
    </div>
  )
}
