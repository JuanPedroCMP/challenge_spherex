# NASA Space Apps 2026 - Challenge 12: Planet X and SPHEREx

Read `CHALLENGE.md` (scope, MVP, architecture) and `docs/SPHEREX_NOTES.md` (IRSA/SPHEREx technical facts) before any work. Work in `hackathon-mode` (skill) posture.

## Specialist agents (.claude/agents/)
| Agent | Owns |
| --- | --- |
| spherex-data-engineer | `backend/` (FastAPI, IRSA TAP + cutouts, cache, config of releases), `scripts/prebake.py` |
| spherex-image-processor | `backend/imaging.py` (zodi/flags, reprojection, visit coadds, stretch, difference, GIF, spectra) |
| sky-viewer-frontend | `app/` (Vite+React+Tailwind, flipbook, Aladin Lite, spectrum chart, URL params, Vercel) |
| astro-science-validator | `docs/TARGETS.md`, `docs/VALIDATION.md`, science copy; reviews the others |
| pitch-and-submission | `SUBMISSION.md`, `DEMO.md`, README polish, References checklist |

Suggested order: data-engineer + image-processor (prebake the 5 test targets) -> frontend on prebaked data, deploy -> live backend -> validator -> pitch (Sunday 16:00).

## Skills (.claude/skills/)
choose-challenge (already done), hackathon-mode, design-reference, submit-and-demo.

## Always
- Everything user/judge-facing in English. No NASA logos or Space Apps branding.
- Every dataset/library/font goes into `SOURCES.md` immediately.
- Checkpoints: Sat 11:00 hello deployed · Sat 14:00 works on sample data · Sat 19:00 live NASA data · Sun 12:00 feature freeze · Sun 20:00 submitted.
