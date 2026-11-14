// AI-Assisted: the playback helper generated with Claude Code (Anthropic) and reviewed by the team.
/**
 * Which visit is on screen right now: the blink pair alternates, otherwise it is the timeline frame.
 */
export function currentVisitIndex(s) {
  if (s.mode === 'blink') return s.blinkPhase ? s.blinkB : s.blinkA
  return s.frame
}
