# AI-Assisted: every setting of the backend in one file generated with Claude Code (Anthropic) and reviewed by the team.
"""Every setting the backend uses lives here, so nobody has to hunt for magic numbers.

The one you will touch most is RELEASES. SPHEREx publishes new data often, and the
challenge asks for a tool that is easy to update: when a new release comes out (DR2 is
planned for late 2027), add its collection name to the front of that list and you are done.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE_DIR = ROOT / "cache"            # FITS cutouts + rendered regions (git-ignored)

# SIA collections, in order of preference (list them with
# Irsa.list_collections(servicetype='SIA', filter='spherex')). DR1 and QR3 supersede QR2.
# "_deep" is the Deep Survey near the ecliptic poles, where SPHEREx looks many more times.
# When the same exposure shows up in two collections we keep the first one listed here.
# When DR2 ships, add "spherex_dr2" and "spherex_dr2_deep" at the front.
RELEASES = ["spherex_dr1", "spherex_dr1_deep", "spherex_qr3", "spherex_qr3_deep"]

IRSA_BASE = "https://irsa.ipac.caltech.edu/"
IRSA_TAP = "https://irsa.ipac.caltech.edu/TAP/sync"
IRSA_SIA = "https://irsa.ipac.caltech.edu/SIA"
GAIA_TAP = "https://gea.esac.esa.int/tap-server/tap/sync"
SESAME_URLS = [
    "https://cds.unistra.fr/cgi-bin/nph-sesame/-oI/SNV?",
    "https://vizier.idia.ac.za/viz-bin/nph-sesame/-oI/SNV?",
]

PIXSCALE_ARCSEC = 6.2                  # SPHEREx native pixel
FOV_MIN_DEG, FOV_MAX_DEG, FOV_DEFAULT_DEG = 0.02, 0.25, 0.08
MAX_VISITS = 8                         # survey visits kept per region (evenly spaced, first and last always kept)
MAX_EXP_PER_VISIT = 6                  # exposures coadded per visit and detector
VISIT_GAP_DAYS = 30                    # exposures closer than this belong to the same visit
DOWNLOAD_WORKERS = 8
HTTP_TIMEOUT = 120                     # cutout downloads (the IRSA intro tutorial also uses 120 s)
SEARCH_TIMEOUT = 45                    # TAP/SIA image search (IRSA can hang for minutes when degraded)
HTTP_RETRIES = 3                       # tutorial pattern: up to 3 tries, waiting 10 s, then 20 s
RETRY_WAIT_S = 10

# Tutorial "good pixel" rule: FLAGS value in {0, 2, 2097152} -> allowed bits 1 and 21.
GOOD_FLAG_BITS = (1, 21)

DETECTORS = {
    1: (0.75, 1.09),
    2: (1.10, 1.62),
    3: (1.63, 2.41),
    4: (2.42, 3.82),
    5: (3.83, 4.41),
    6: (4.42, 5.00),
}

ASINH_A = 0.1                          # display stretch softness (smaller = more contrast in faint parts)
# Surface brightness to flux, from the IRSA SPHEREx mosaic tutorial:
#   mJy = (MJy/sr) * 23.5045 * (pixel scale in arcsec)**2 / 1000
MJYSR_TO_MJY_PER_ARCSEC2 = 23.5045 / 1e3

# Aperture photometry, as in the mosaic tutorial: sigma-clipped annulus (sigma=3, maxiters=10)
PHOT_R_AP, PHOT_R_IN, PHOT_R_OUT = 2.0, 4.0, 7.0   # radii in pixels
PHOT_SIGMA, PHOT_MAXITERS = 3.0, 10

GAIA_GMAX = 19.0
GAIA_LIMIT = 400
