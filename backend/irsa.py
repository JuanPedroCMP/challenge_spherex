# AI-Assisted: the IRSA search and cutout download code generated with Claude Code (Anthropic) and reviewed by the team.
"""Talks to NASA's IRSA archive: find SPHEREx exposures of a spot, then download small cutouts.

A full SPHEREx image is about 70 MB. We never download those. IRSA can cut a small square
around any position on its side, so a region of a few arcminutes costs a few hundred KB per
exposure. Everything downloaded is cached on disk, so asking for the same region twice is
instant.

Search order: TAP first (it sees new data the same day), SIA2 as a fallback. When both fail
we raise IrsaUnavailable so the API can say so clearly instead of hanging.
"""
import hashlib
import io
import time
from concurrent.futures import ThreadPoolExecutor

import requests
from astropy.table import Table

from config import (CACHE_DIR, DOWNLOAD_WORKERS, HTTP_RETRIES, HTTP_TIMEOUT, IRSA_BASE, IRSA_TAP, RELEASES,
                    RETRY_WAIT_S, SEARCH_TIMEOUT)


class IrsaUnavailable(RuntimeError):
    pass


def find_exposures(ra, dec, dets):
    """List of {'url', 'mjd', 'det'} for the detectors in `dets`, time-ordered.

    One search per region: a SIA answer already holds every detector, so we filter locally.
    SIA through astroquery first (the method in IRSA's SPHEREx intro tutorial), TAP as a fallback.
    SIA lags new data by about a day; TAP does not, which is why we keep it.
    IRSA sometimes answers 502 for a moment, so the whole search is retried, waiting 10 s, 20 s.
    """
    dets = sorted(set(dets))
    errors = []
    for attempt in range(HTTP_RETRIES):
        for fn in (_sia, _tap):
            try:
                rows = fn(ra, dec, dets)
                return sorted(rows, key=lambda r: (r["det"], r["mjd"]))
            except Exception as e:  # noqa: BLE001 - any failure -> try the next service
                errors.append(f"{fn.__name__}: {str(e)[:160]}")
        if attempt < HTTP_RETRIES - 1:
            time.sleep(RETRY_WAIT_S * (attempt + 1))
    raise IrsaUnavailable("; ".join(errors[-2:]))


def _tap(ra, dec, dets):
    bands = ", ".join(f"'SPHEREx-D{d}'" for d in dets)
    q = ("SELECT a.uri, p.time_bounds_lower, p.energy_bandpassname "
         "FROM spherex.artifact a JOIN spherex.plane p ON a.planeid = p.planeid "
         f"WHERE 1 = CONTAINS(POINT('ICRS', {ra}, {dec}), p.poly) "
         f"AND p.energy_bandpassname IN ({bands}) ORDER BY p.time_bounds_lower")
    r = requests.get(IRSA_TAP, params={"QUERY": q, "LANG": "ADQL", "FORMAT": "votable"}, timeout=SEARCH_TIMEOUT)
    r.raise_for_status()
    t = Table.read(io.BytesIO(r.content), format="votable")
    return [{"url": IRSA_BASE + str(row["uri"]).lstrip("/"), "mjd": float(row["time_bounds_lower"]),
             "det": int(str(row["energy_bandpassname"])[-1])} for row in t]


def _sia(ra, dec, dets):
    """Same call as the IRSA tutorial: Irsa.query_sia(pos=(coord, 1 arcsec), collection=[...])."""
    import astropy.units as u
    from astropy.coordinates import SkyCoord
    from astroquery.ipac.irsa import Irsa, conf

    with conf.set_temp("timeout", SEARCH_TIMEOUT):
        t = Irsa.query_sia(pos=(SkyCoord(ra, dec, unit="deg"), 1 * u.arcsec), collection=RELEASES)
    if "dataproduct_subtype" in t.colnames and "science" in set(map(str, t["dataproduct_subtype"])):
        t = t[[str(v) == "science" for v in t["dataproduct_subtype"]]]
    rank = {c: i for i, c in enumerate(RELEASES)}
    best = {}
    wanted = {f"SPHEREx-D{d}": d for d in dets}
    for row in t:
        det = wanted.get(str(row["energy_bandpassname"]))
        if det is None:
            continue
        # t_min is MJD (IVOA ObsCore). The same exposure can sit in two collections: keep the preferred one.
        key = (det, round(float(row["t_min"]), 5))
        coll = str(row["obs_collection"]) if "obs_collection" in t.colnames else ""
        r = {"url": str(row["access_url"]), "mjd": float(row["t_min"]), "det": det, "rank": rank.get(coll, 99)}
        if key not in best or r["rank"] < best[key]["rank"]:
            best[key] = r
    return [{k: v for k, v in r.items() if k != "rank"} for r in best.values()]


def cutout_url(url, ra, dec, size_deg):
    return f"{url}?center={ra:.6f},{dec:.6f}d&size={size_deg:.4f}"


def download(url):
    """Download one cutout to the cache; returns the local path (None on failure)."""
    d = CACHE_DIR / "fits"
    d.mkdir(parents=True, exist_ok=True)
    path = d / (hashlib.sha1(url.encode()).hexdigest() + ".fits")
    if path.exists() and path.stat().st_size > 0:
        return path
    # Retry pattern from the IRSA intro tutorial: transient read errors happen, so wait 10 s, 20 s, ...
    tmp = path.with_suffix(".part")
    for attempt in range(HTTP_RETRIES):
        try:
            with requests.get(url, timeout=HTTP_TIMEOUT, stream=True) as r:
                r.raise_for_status()
                with open(tmp, "wb") as f:
                    for chunk in r.iter_content(1 << 16):
                        f.write(chunk)
            if _looks_like_spherex(tmp):
                tmp.replace(path)
                return path
            tmp.unlink(missing_ok=True)   # truncated file or an HTML error page: try again
        except requests.RequestException:
            pass
        if attempt < HTTP_RETRIES - 1:
            time.sleep(RETRY_WAIT_S * (attempt + 1))
    return None


def _looks_like_spherex(path):
    """A usable cutout opens as FITS and has the IMAGE extension."""
    from astropy.io import fits
    try:
        with fits.open(path, memmap=False) as h:
            return "IMAGE" in h
    except Exception:  # noqa: BLE001
        return False


def download_all(urls, log=print):
    done = 0

    def one(u):
        nonlocal done
        p = download(u)
        done += 1
        if done % 5 == 0 or done == len(urls):
            log(f"  downloaded {done}/{len(urls)}")
        return p

    with ThreadPoolExecutor(DOWNLOAD_WORKERS) as ex:
        return list(ex.map(one, urls))
