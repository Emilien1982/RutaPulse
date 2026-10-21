"""Reading and checking zones.json (ADR 0003, section 5)."""

import json
from pathlib import Path

from jsonschema import Draft202012Validator

ZONES_DIR = Path(__file__).resolve().parent.parent
ZONES_FILE = ZONES_DIR / "zones.json"
SCHEMA_FILE = ZONES_DIR / "schemas" / "zones.schema.json"
MAX_SIDE_DEGREES = 1.0


class ConfigError(Exception):
    """zones.json is invalid, or a requested zone is not in it. The message is in French."""


def load_zones(path: Path = ZONES_FILE, schema_path: Path = SCHEMA_FILE) -> list[dict]:
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as err:
        raise ConfigError(f"{path} illisible : {err}") from err
    schema = json.loads(Path(schema_path).read_text(encoding="utf-8"))
    errors = sorted(Draft202012Validator(schema).iter_errors(data), key=lambda e: list(e.absolute_path))
    if errors:
        lines = [f"  - {'/'.join(map(str, e.absolute_path)) or '(racine)'} : {e.message}" for e in errors]
        raise ConfigError(f"{path} invalide :\n" + "\n".join(lines))
    _check_rules(data["zones"])
    return data["zones"]


def _check_rules(zones: list[dict]) -> None:
    """Rules that the JSON schema cannot express."""
    seen = set()
    for zone in zones:
        zone_id, box = zone["id"], zone["bbox"]
        if zone_id in seen:
            raise ConfigError(f"id en double : {zone_id}")
        seen.add(zone_id)
        if box["lonMin"] >= box["lonMax"] or box["latMin"] >= box["latMax"]:
            raise ConfigError(f"zone {zone_id} : il faut lonMin < lonMax et latMin < latMax")
        if box["lonMax"] - box["lonMin"] > MAX_SIDE_DEGREES or box["latMax"] - box["latMin"] > MAX_SIDE_DEGREES:
            raise ConfigError(f"zone {zone_id} : un côté dépasse {MAX_SIDE_DEGREES:g}°")


def get_zone(zones: list[dict], zone_id: str) -> dict:
    for zone in zones:
        if zone["id"] == zone_id:
            return zone
    known = ", ".join(z["id"] for z in zones)
    raise ConfigError(f"zone « {zone_id} » absente de zones.json (zones connues : {known})")
