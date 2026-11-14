# AI-Assisted: the FastAPI app generated with Claude Code (Anthropic) and reviewed by the team.
"""The web API behind live search (beta).

Run it from the backend/ folder:
    uvicorn main:app --port 8010

The web app works without it: the five test targets are prebaked as static files. The API
is only needed to cut out arbitrary positions on the sky. Results are cached per region,
so the slow part (IRSA downloads) only happens once.
"""
import hashlib
import json
import threading

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from astro import current_position, gaia_cone, resolve
from config import CACHE_DIR, DETECTORS, FOV_DEFAULT_DEG, FOV_MAX_DEG, FOV_MIN_DEG, RELEASES
from irsa import IrsaUnavailable
from pipeline import NoData, build_region
from targets import TARGETS

REGIONS = CACHE_DIR / "regions"
REGIONS.mkdir(parents=True, exist_ok=True)
_locks: dict[str, threading.Lock] = {}

app = FastAPI(title="SPHEREx Sky Flipbook API", version="0.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])
app.mount("/files", StaticFiles(directory=REGIONS), name="files")


@app.get("/api/health")
def health():
    return {"ok": True, "releases": RELEASES, "detectors": DETECTORS}


@app.get("/api/targets")
def targets():
    return [{k: t[k] for k in ("slug", "name", "ra", "dec", "kind", "default_det", "blurb")} for t in TARGETS]


@app.get("/api/resolve")
def api_resolve(q: str = Query(..., min_length=1, max_length=120)):
    r = resolve(q)
    if not r:
        raise HTTPException(404, f"Could not resolve '{q}'. Try RA/Dec, e.g. 08h55m10.8s -7d14m42s")
    r["ra_now"], r["dec_now"] = current_position(r)  # where it is during the SPHEREx surveys
    return r


@app.get("/api/gaia")
def api_gaia(ra: float, dec: float, radius: float = Query(0.05, gt=0, le=0.3)):
    return gaia_cone(ra, dec, radius)


@app.get("/api/region")
async def api_region(ra: float = Query(..., ge=0, lt=360), dec: float = Query(..., ge=-90, le=90),
                     fov: float = Query(FOV_DEFAULT_DEG, ge=FOV_MIN_DEG, le=FOV_MAX_DEG),
                     dets: str = "1,3,5", name: str | None = None):
    try:
        det_list = sorted({int(d) for d in dets.split(",") if d.strip()})
    except ValueError:
        raise HTTPException(400, "dets must look like 1,3,5")
    if not det_list or any(d not in DETECTORS for d in det_list) or len(det_list) > 6:
        raise HTTPException(400, "dets must be detector numbers 1-6")

    key = hashlib.sha1(f"{ra:.5f},{dec:.5f},{fov:.3f},{det_list}".encode()).hexdigest()[:16]
    out = REGIONS / key
    meta_path = out / "meta.json"
    lock = _locks.setdefault(key, threading.Lock())

    def work():
        with lock:
            if meta_path.exists():
                return json.loads(meta_path.read_text())
            target = resolve(name) if name else None
            return build_region(ra, dec, fov, det_list, out, name=name, slug=key, target=target)

    try:
        meta = await run_in_threadpool(work)
    except IrsaUnavailable as e:
        raise HTTPException(503, f"IRSA SPHEREx search is not responding right now ({e}). Try a preset target.")
    except NoData as e:
        raise HTTPException(404, str(e))
    meta["base"] = f"/files/{key}/"
    return meta
