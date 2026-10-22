"""catalogue.json: build, update and check it (ADR 0003, section 4)."""

import json
import re
from pathlib import Path

from jsonschema import Draft202012Validator

from .checksums import SUMS_NAME, sha256_file
from .config import ZONES_DIR
from .paths import storage_path

SCHEMA_FILE = ZONES_DIR / "schemas" / "catalogue.schema.json"
REQUIRED_FILES = [
    "valhalla_tiles.tar",
    "map.pmtiles",
    "terrain.pmtiles",
    "contours.pmtiles",
    "trails.geojson",
    "zone.json",
    "LICENCES.md",
]
_REPO = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")
_HGT_PATH = re.compile(r"elevation/[^/]+/[^/]+\.hgt")


class CatalogueError(Exception):
    """The catalogue or the package is invalid. The message is in French."""


def empty_catalogue() -> dict:
    return {"formatVersion": 1, "zones": []}


def validate_schema(catalogue: dict, schema_path: Path = SCHEMA_FILE, any_url: bool = False) -> None:
    """Check the JSON schema only. `any_url` accepts any address form (file:// in tests)."""
    schema = json.loads(Path(schema_path).read_text(encoding="utf-8"))
    if any_url:
        del schema["properties"]["zones"]["items"]["properties"]["files"]["items"]["properties"]["url"]["pattern"]
    errors = sorted(Draft202012Validator(schema).iter_errors(catalogue), key=lambda e: list(e.absolute_path))
    if errors:
        lines = [f"  - {'/'.join(map(str, e.absolute_path)) or '(racine)'} : {e.message}" for e in errors]
        raise CatalogueError("catalogue invalide :\n" + "\n".join(lines))


def validate_catalogue(catalogue: dict, schema_path: Path = SCHEMA_FILE) -> None:
    """Schema, then the rules that a schema cannot express. Raise CatalogueError."""
    validate_schema(catalogue, schema_path)
    ids = [z["id"] for z in catalogue["zones"]]
    if len(set(ids)) != len(ids):
        raise CatalogueError("catalogue invalide : id en double")
    if ids != sorted(ids):
        raise CatalogueError("catalogue invalide : les zones doivent être triées par id")
    for zone in catalogue["zones"]:
        _check_zone(zone)


def _check_zone(zone: dict) -> None:
    zid, box = zone["id"], zone["bbox"]
    if box["lonMin"] >= box["lonMax"] or box["latMin"] >= box["latMax"]:
        raise CatalogueError(f"zone {zid} : il faut lonMin < lonMax et latMin < latMax")
    paths = [f["path"] for f in zone["files"]]
    if paths != sorted(paths) or len(set(paths)) != len(paths):
        raise CatalogueError(f"zone {zid} : les fichiers doivent être triés par path, sans doublon")
    if zone["totalBytes"] != sum(f["bytes"] for f in zone["files"]):
        raise CatalogueError(f"zone {zid} : totalBytes ne vaut pas la somme des tailles")
    missing = [name for name in REQUIRED_FILES if name not in paths]
    if missing:
        raise CatalogueError(f"zone {zid} : fichiers obligatoires absents : {', '.join(missing)}")
    if not any(_HGT_PATH.fullmatch(p) for p in paths):
        raise CatalogueError(f"zone {zid} : aucun fichier elevation/…/….hgt")
    for f in zone["files"]:
        suffix = f"/releases/download/zone-{zid}-v{zone['version']}/{f['path'].rsplit('/', 1)[-1]}"
        if not f["url"].endswith(suffix):
            raise CatalogueError(f"zone {zid} : l'adresse de {f['path']} doit finir par {suffix}")


def load_catalogue(path: Path) -> dict:
    """Read the current catalogue. A missing or empty file is refused: a typo or a failed download
    must not erase the other zones. The first run starts from an explicit empty catalogue."""
    path = Path(path)
    if not path.is_file():
        raise CatalogueError(
            f"catalogue actuel introuvable : {path}. Au premier lancement, créer un catalogue vide : "
            f'{json.dumps(empty_catalogue(), separators=(",", ":"))}'
        )
    if not path.read_text(encoding="utf-8").strip():
        raise CatalogueError(f"catalogue actuel vide : {path}. Un catalogue vide s'écrit {json.dumps(empty_catalogue(), separators=(',', ':'))}")
    try:
        catalogue = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        raise CatalogueError(f"{path} illisible : {err}") from err
    validate_catalogue(catalogue)
    return catalogue


def read_sums(folder: Path) -> dict[str, str]:
    sums_file = folder / SUMS_NAME
    if not sums_file.is_file():
        raise CatalogueError(f"{SUMS_NAME} absent de {folder}")
    sums = {}
    for line in sums_file.read_text(encoding="utf-8").splitlines():
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        if not match:
            raise CatalogueError(f"ligne illisible dans {SUMS_NAME} : {line!r}")
        sums[match.group(2)] = match.group(1)
    return sums


def zone_entry(package: Path, repo: str) -> dict:
    """Catalogue entry of a built package. Sizes and hashes are recomputed and compared to SHA256SUMS."""
    if not _REPO.fullmatch(repo):
        raise CatalogueError(f"--repo doit avoir la forme propriétaire/dépôt (reçu : {repo!r})")
    zone_file = package / "zone.json"
    if not zone_file.is_file():
        raise CatalogueError(f"zone.json absent de {package}")
    info = json.loads(zone_file.read_text(encoding="utf-8"))
    expected = read_sums(package)
    names = sorted(p.name for p in package.iterdir() if p.is_file() and p.name != SUMS_NAME)
    if names != sorted(expected):
        raise CatalogueError(
            f"les fichiers du paquet ne correspondent pas à {SUMS_NAME} "
            f"(en trop : {sorted(set(names) - set(expected))}, manquants : {sorted(set(expected) - set(names))})"
        )
    base = f"https://github.com/{repo}/releases/download/zone-{info['id']}-v{info['version']}"
    files = []
    for name in names:
        digest = sha256_file(package / name)
        if digest != expected[name]:
            raise CatalogueError(f"empreinte fausse pour {name} : {digest} au lieu de {expected[name]}")
        files.append(
            {"path": storage_path(name), "bytes": (package / name).stat().st_size, "sha256": digest, "url": f"{base}/{name}"}
        )
    files.sort(key=lambda f: f["path"])
    return {
        "id": info["id"],
        "name": info["name"],
        "version": info["version"],
        "bbox": info["bbox"],
        "osmDate": info["osmDate"],
        "totalBytes": sum(f["bytes"] for f in files),
        "files": files,
    }


def update_catalogue(current: dict, entry: dict) -> dict:
    """Add the zone, or replace the one with the same id. Zones stay sorted by id."""
    for zone in current["zones"]:
        if zone["id"] == entry["id"] and entry["version"] <= zone["version"]:
            raise CatalogueError(
                f"zone {entry['id']} : la version {entry['version']} n'est pas plus récente "
                f"que la version {zone['version']} du catalogue"
            )
    zones = [z for z in current["zones"] if z["id"] != entry["id"]] + [entry]
    return {"formatVersion": 1, "zones": sorted(zones, key=lambda z: z["id"])}


def write_catalogue(catalogue: dict, out: Path) -> None:
    out.write_text(json.dumps(catalogue, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def make_catalogue(current: Path, package: Path, repo: str, out: Path) -> dict:
    """Update `current` with the zone of `package`, check the result, write it to `out`."""
    result = update_catalogue(load_catalogue(current), zone_entry(package, repo))
    validate_catalogue(result)
    write_catalogue(result, out)
    return result
