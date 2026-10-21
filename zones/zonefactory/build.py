"""Build the package of one zone (ADR 0003, sections 1, 2, 6 and 7).

Reuse rule for big downloads: a file already present in the cache folder is
never downloaded again. The cache holds the OSM extract (named after its
address), the Planetiler annexes (planetiler/sources/) and the HGT tiles
(elevation/N48/...). Everything else is rebuilt at each run in work/<id>/.
"""

import json
import re
import shutil
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from . import checksums, trails
from .config import ZONES_DIR
from .paths import hgt_names_for_bbox, storage_path

VALHALLA_IMAGE = "ghcr.io/valhalla/valhalla:3.9.1"
PLANETILER_IMAGE = "ghcr.io/onthegomap/planetiler:0.10.2"
GDAL_IMAGE = "ghcr.io/osgeo/gdal:alpine-small-3.10.3"
PLANETILER_XMX = "4g"
TERRAIN_URL = "https://download.mapterhorn.com/planet.pmtiles"
TERRAIN_MAXZOOM = 12
MAP_MAXZOOM = 14
CONTOUR_MINZOOM = 11
CONTOUR_MAXZOOM = 14
CONTOUR_INTERVAL = 10
CONTOUR_MAJOR = 50
CONTOUR_MARGIN = 0.01  # degrees added around the zone so that lines do not stop at its edge
WORK_DIR = ZONES_DIR / "work"
DEFAULT_CACHE_DIR = WORK_DIR / "cache"
TEMPLATES_DIR = ZONES_DIR / "templates"


class BuildError(Exception):
    """A build step failed. The message is in French."""


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    print("  $", " ".join(str(c) for c in cmd), flush=True)
    return subprocess.run([str(c) for c in cmd], check=True, **kwargs)


def bbox_arg(bbox: dict) -> str:
    return f"{bbox['lonMin']},{bbox['latMin']},{bbox['lonMax']},{bbox['latMax']}"


def tool_output(cmd: list[str]) -> str:
    done = subprocess.run(cmd, capture_output=True, text=True)
    return (done.stdout + done.stderr).strip()


def tool_versions() -> dict:
    """Versions of the tools. Images carry their version in their tag."""
    semver = re.compile(r"\d+\.\d+\.\d+")

    def find(text: str, what: str) -> str:
        match = semver.search(text)
        if not match:
            raise BuildError(f"version de {what} introuvable dans : {text!r}")
        return match.group(0)

    pmtiles = tool_output(["pmtiles", "version"])
    if not semver.search(pmtiles):  # the Homebrew build prints "dev"
        pmtiles = tool_output(["brew", "list", "--versions", "pmtiles"])
    return {
        "valhalla": find(VALHALLA_IMAGE.split(":")[1], "Valhalla"),
        "planetiler": find(PLANETILER_IMAGE.split(":")[1], "Planetiler"),
        "gdal": find(GDAL_IMAGE.split(":")[1], "GDAL"),
        "tippecanoe": find(tool_output(["tippecanoe", "--version"]), "tippecanoe"),
        "pmtiles": find(pmtiles, "pmtiles"),
        "osmium": find(tool_output(["osmium", "--version"]), "osmium"),
    }


def osm_header(pbf: Path, bbox: dict) -> str:
    """Return osmDate from the extract header; stop if it is missing or if the zone is not inside."""
    date = tool_output(["osmium", "fileinfo", "-g", "header.option.osmosis_replication_timestamp", str(pbf)])
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", date):
        raise BuildError(f"l'en-tête de l'extrait OSM ne donne pas de date de données valable (lu : {date!r})")
    boxes = tool_output(["osmium", "fileinfo", "-g", "header.boxes", str(pbf)])
    match = re.fullmatch(r"\(([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\)", boxes)
    if not match:
        raise BuildError(f"l'en-tête de l'extrait OSM ne donne pas ses limites (lu : {boxes!r})")
    lon0, lat0, lon1, lat1 = map(float, match.groups())
    if not (
        lon0 <= bbox["lonMin"] and bbox["lonMax"] <= lon1 and lat0 <= bbox["latMin"] and bbox["latMax"] <= lat1
    ):
        raise BuildError(f"la zone dépasse les limites de l'extrait OSM ({lon0},{lat0},{lon1},{lat1})")
    return date


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_name(dest.name + ".part")
    with urllib.request.urlopen(url) as response, open(part, "wb") as f:
        shutil.copyfileobj(response, f)
    part.rename(dest)


def step(name: str, func, *args):
    print(f"== {name}", flush=True)
    t0 = time.monotonic()
    result = func(*args)
    print(f"   {name} : {time.monotonic() - t0:.1f} s", flush=True)
    return result


def valhalla(work: Path, *args):
    run(["docker", "run", "--rm", "-v", f"{work}:/data", "-w", "/data", VALHALLA_IMAGE, *args])


def build_routing(work: Path, cache: Path, bbox: dict, pbf: Path) -> None:
    """Valhalla routing tiles and HGT elevation (the steps of essay 1, parameters unchanged)."""
    box = bbox_arg(bbox)
    run(["osmium", "extract", "-b", box, "--strategy=smart", "-o", work / "zone.osm.pbf", pbf])
    with open(work / "valhalla.json", "w") as config:
        run(
            ["docker", "run", "--rm", VALHALLA_IMAGE, "valhalla_build_config",
             "--mjolnir-tile-dir", "/data/valhalla_tiles",
             "--mjolnir-tile-extract", "/data/valhalla_tiles.tar",
             "--mjolnir-admin", "/data/admins.sqlite",
             "--additional-data-elevation", "/data/elevation"],
            stdout=config,
        )  # fmt: skip
    valhalla(work, "valhalla_build_admins", "-c", "/data/valhalla.json", "/data/zone.osm.pbf")
    wanted = hgt_names_for_bbox(bbox)
    if all((cache / "elevation" / storage_path(n).split("/", 1)[1]).is_file() for n in wanted):
        print("  altitude : tuiles trouvées dans le cache")
        shutil.copytree(cache / "elevation", work / "elevation")
    else:
        (work / "elevation").mkdir()
        valhalla(work, "valhalla_build_elevation", f"--from-bbox={box}", "--decompress", "-c", "/data/valhalla.json")
        shutil.copytree(work / "elevation", cache / "elevation", dirs_exist_ok=True)
    valhalla(work, "valhalla_build_tiles", "-c", "/data/valhalla.json", "/data/zone.osm.pbf")
    valhalla(work, "valhalla_build_extract", "-c", "/data/valhalla.json", "-v")


def build_map(work: Path, cache: Path, bbox: dict, pbf: Path) -> None:
    """OpenMapTiles map with Planetiler, default profile, zooms 0 to 14."""
    sources = cache / "planetiler" / "sources"
    sources.mkdir(parents=True, exist_ok=True)
    (work / "planetiler").mkdir()
    run(
        ["docker", "run", "--rm", "-e", f"JAVA_TOOL_OPTIONS=-Xmx{PLANETILER_XMX}",
         "-v", f"{work / 'planetiler'}:/data", "-v", f"{sources}:/sources", "-v", f"{pbf}:/input/extract.osm.pbf:ro",
         PLANETILER_IMAGE, "--osm-path=/input/extract.osm.pbf", "--download-dir=/sources", "--tmpdir=/data/tmp",
         "--download", f"--bounds={bbox_arg(bbox)}", "--minzoom=0", f"--maxzoom={MAP_MAXZOOM}",
         "--output=/data/map.pmtiles", "--force"]
    )  # fmt: skip


def build_terrain(work: Path, bbox: dict) -> None:
    run(["pmtiles", "extract", TERRAIN_URL, work / "terrain.pmtiles", f"--bbox={bbox_arg(bbox)}", f"--maxzoom={TERRAIN_MAXZOOM}"])


def build_contours(work: Path, bbox: dict, name: str) -> None:
    """HGT -> gdal_contour every 10 m -> attribute `major` -> tippecanoe (layer `contour`)."""
    def gdal(*args):
        run(["docker", "run", "--rm", "-v", f"{work}:/data", "-w", "/data", GDAL_IMAGE, *args])

    hgt = [f"/data/elevation/{storage_path(n).split('/', 1)[1]}" for n in hgt_names_for_bbox(bbox)]
    m = CONTOUR_MARGIN
    gdal("gdalbuildvrt", "/data/dem.vrt", *hgt)
    gdal("gdal_translate", "-q", "-projwin", str(round(bbox["lonMin"] - m, 6)), str(round(bbox["latMax"] + m, 6)),
         str(round(bbox["lonMax"] + m, 6)), str(round(bbox["latMin"] - m, 6)), "/data/dem.vrt", "/data/dem.tif")  # fmt: skip
    gdal("gdal_contour", "-q", "-a", "ele", "-i", str(CONTOUR_INTERVAL), "-snodata", "-32768", "-f", "GeoJSONSeq",
         "/data/dem.tif", "/data/contours-raw.geojsonl")  # fmt: skip
    count = 0
    with open(work / "contours-raw.geojsonl") as src, open(work / "contours.geojsonl", "w") as dst:
        for line in src:
            line = line.strip().lstrip("\x1e")
            if not line:
                continue
            feature = json.loads(line)
            ele = int(round(feature["properties"]["ele"]))
            feature["properties"] = {"ele": ele, "major": 1 if ele % CONTOUR_MAJOR == 0 else 0}
            dst.write(json.dumps(feature, separators=(",", ":")) + "\n")
            count += 1
    print(f"  {count} courbes de niveau")
    run(["tippecanoe", "-o", work / "contours.pmtiles", "-n", "contours", "-N", f"{name} contour lines", "-l", "contour",
         f"-Z{CONTOUR_MINZOOM}", f"-z{CONTOUR_MAXZOOM}", "--drop-densest-as-needed", "--simplification=4",
         "--force", "-q", work / "contours.geojsonl"])  # fmt: skip


def build_zone(zone: dict, version: int, out: Path, cache: Path = DEFAULT_CACHE_DIR) -> dict:
    """Build the whole package of `zone` in the empty folder `out`. Return {file name: size}."""
    if out.exists() and any(out.iterdir()):
        raise BuildError(f"le dossier de sortie n'est pas vide : {out}")
    out.mkdir(parents=True, exist_ok=True)
    out, cache = out.resolve(), cache.resolve()
    work = (WORK_DIR / zone["id"]).resolve()
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    cache.mkdir(parents=True, exist_ok=True)
    bbox, started = zone["bbox"], time.monotonic()

    versions = tool_versions()
    pbf = cache / zone["osmExtractUrl"].rsplit("/", 1)[1]
    if pbf.is_file() and pbf.stat().st_size > 0:
        print(f"Extrait OSM déjà dans le cache : {pbf}")
    else:
        step("Téléchargement de l'extrait OSM", download, zone["osmExtractUrl"], pbf)
    osm_date = osm_header(pbf, bbox)

    step("Calcul d'itinéraire (Valhalla) et altitude", build_routing, work, cache, bbox, pbf)
    step("Carte (Planetiler)", build_map, work, cache, bbox, pbf)
    step("Relief (Mapterhorn)", build_terrain, work, bbox)
    step("Courbes de niveau", build_contours, work, bbox, zone["name"])
    report = step("Circuits balisés", trails.extract_trails, pbf, bbox, work / "trails.geojson", work)
    print("\n".join(report))

    shutil.move(work / "valhalla_tiles.tar", out / "valhalla_tiles.tar")
    for hgt in sorted((work / "elevation").rglob("*.hgt")):
        shutil.move(hgt, out / hgt.name)
    for name in ("map.pmtiles", "terrain.pmtiles", "contours.pmtiles", "trails.geojson"):
        shutil.move(work / name if name != "map.pmtiles" else work / "planetiler" / name, out / name)
    shutil.copy(TEMPLATES_DIR / "LICENCES.md", out / "LICENCES.md")
    description = {
        "formatVersion": 1,
        "id": zone["id"],
        "name": zone["name"],
        "version": version,
        "bbox": bbox,
        "osmDate": osm_date,
        "builtAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tools": versions,
    }
    (out / "zone.json").write_text(json.dumps(description, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    checksums.write_sums(out)

    sizes = {p.name: p.stat().st_size for p in sorted(out.iterdir())}
    print(f"\nPaquet de {zone['name']} (v{version}) dans {out} :")
    for name, size in sizes.items():
        print(f"  {name:28} {size:>12} octets")
    print(f"  {'total':28} {sum(sizes.values()):>12} octets")
    print(f"Durée : {time.monotonic() - started:.0f} s")
    return sizes
