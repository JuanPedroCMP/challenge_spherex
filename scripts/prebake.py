# AI-Assisted: the prebake script generated with Claude Code (Anthropic) and reviewed by the team.
"""Bake the five test targets from real SPHEREx data into the web app.

    .venv/Scripts/python scripts/prebake.py            # all five
    .venv/Scripts/python scripts/prebake.py wise-0855  # just one

Writes AstroDevs-FP/public/data/<slug>/ (frames + meta.json), plus index.json and
datapackage.json. If a target fails (IRSA down, no coverage yet) whatever was there before
is kept, so the site never ends up empty.
"""
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from config import FOV_DEFAULT_DEG  # noqa: E402
from astro import current_position  # noqa: E402
from pipeline import build_region  # noqa: E402
from targets import TARGETS  # noqa: E402

DATA = ROOT / "AstroDevs-FP" / "public" / "data"


def write_index():
    items = []
    for t in TARGETS:
        meta = DATA / t["slug"] / "meta.json"
        if not meta.exists():
            continue
        m = json.loads(meta.read_text())
        items.append({k: t[k] for k in ("slug", "name", "kind", "default_det", "blurb")}
                     | {"ra": m["ra"], "dec": m["dec"], "simulated": m.get("simulated", False), "dets": [d["det"] for d in m["detectors"]],
                        "visits": len(m["visits"])})
    (DATA / "index.json").write_text(json.dumps(items, indent=1))
    write_datapackage(items)
    print(f"index.json: {len(items)} targets")


def write_datapackage(items):
    """Frictionless-style datapackage.json describing each target folder and whether it is synthetic."""
    resources = []
    for it in items:
        sim = it["simulated"]
        resources.append({
            "name": it["slug"], "path": f"{it['slug']}/meta.json", "format": "json",
            "title": f"{it['name']}: per-visit SPHEREx frames and metadata",
            "simulated": sim, "generated_by_ai": sim,
            "description": ("SIMULATED sample: real Gaia DR3 star positions rendered by scripts/make_mock.py "
                            "(an AI-assisted script). Not SPHEREx pixels." if sim else
                            "Real SPHEREx Level 2 cutouts from NASA/IPAC IRSA, processed by backend/pipeline.py."),
            "sources": [{"title": "SPHEREx (NASA/IPAC IRSA)", "path": "https://irsa.ipac.caltech.edu/Missions/spherex.html"},
                        {"title": "Gaia DR3 (ESA)", "path": "https://www.cosmos.esa.int/web/gaia/dr3"}],
        })
    pkg = {"name": "skyblink-prebaked-targets", "title": "SkyBlink prebaked test targets",
           "generated_by_ai": any(r["generated_by_ai"] for r in resources), "resources": resources}
    (DATA / "datapackage.json").write_text(json.dumps(pkg, indent=1))


def publish(tmp, final):
    """Swap the new frames in. We move files instead of renaming the folder: on Windows a running dev
    server or file explorer can hold the folder open, and renaming it then fails with "Access denied"."""
    final.mkdir(parents=True, exist_ok=True)
    for f in final.iterdir():
        f.unlink()
    for f in tmp.iterdir():
        f.replace(final / f.name)
    tmp.rmdir()


def main(slugs):
    for t in TARGETS:
        if slugs and t["slug"] not in slugs:
            continue
        print(f"== {t['name']} (D{t['dets']})")
        t0 = time.time()
        tmp = DATA / (t["slug"] + ".tmp")
        try:
            ra, dec = current_position(t)
            build_region(ra, dec, FOV_DEFAULT_DEG, t["dets"], tmp, name=t["name"], slug=t["slug"], target=t)
        except Exception as e:  # noqa: BLE001
            print(f"  FAILED: {e}  (keeping previous data)")
            continue
        publish(tmp, DATA / t["slug"])
        print(f"  done in {time.time() - t0:.0f}s")
    write_index()


if __name__ == "__main__":
    main(sys.argv[1:])
