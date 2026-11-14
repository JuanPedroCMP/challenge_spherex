// AI-Assisted: the playback helper generated with Claude Code (Anthropic) and reviewed by the team.
/**
 * Which visit is on screen right now: the blink pair alternates, otherwise it is the timeline frame.
 */
/** With many visits the date labels collide: show the first, the last and every `step`-th one in between. */
export function showLabel(i, n, max = 5) {
  const step = Math.ceil(n / max)
  if (i === 0 || i === n - 1) return true
  return i % step === 0 && n - 1 - i >= step
}

export function currentVisitIndex(s) {
  if (s.mode === 'blink') return s.blinkPhase ? s.blinkB : s.blinkA
  return s.frame
}
