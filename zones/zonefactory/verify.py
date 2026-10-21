"""Download the files of a zone, check size and SHA-256, store them under their path (what the app does)."""

import hashlib
import json
import shutil
import urllib.request
from pathlib import Path


class VerifyError(Exception):
    """A file is wrong, or the catalogue cannot be used. The message is in French."""


def _open(source: str):
    """Open an address (https://, file://) or a local file path."""
    if "://" in source:
        return urllib.request.urlopen(source)
    return open(source, "rb")


def read_catalogue(source: str) -> dict:
    try:
        with _open(source) as f:
            return json.load(f)
    except (OSError, ValueError) as err:
        raise VerifyError(f"catalogue illisible ({source}) : {err}") from err


def verify_zone(catalogue: dict, zone_id: str, dest: Path) -> list[str]:
    """Stop at the first wrong file (VerifyError). Return the stored paths."""
    zone = next((z for z in catalogue.get("zones", []) if z.get("id") == zone_id), None)
    if zone is None:
        raise VerifyError(f"zone « {zone_id} » absente du catalogue")
    stored = []
    for entry in zone["files"]:
        path, url = entry["path"], entry["url"]
        if path.startswith("/") or ".." in path.split("/"):
            raise VerifyError(f"chemin refusé dans le catalogue : {path}")
        target = dest / path
        target.parent.mkdir(parents=True, exist_ok=True)
        part = target.with_name(target.name + ".part")
        digest, size = hashlib.sha256(), 0
        try:
            with _open(url) as src, open(part, "wb") as out:
                while chunk := src.read(1024 * 1024):
                    digest.update(chunk)
                    size += len(chunk)
                    out.write(chunk)
        except OSError as err:
            part.unlink(missing_ok=True)
            raise VerifyError(f"téléchargement impossible de {path} ({url}) : {err}") from err
        if size != entry["bytes"]:
            part.unlink()
            raise VerifyError(f"taille fausse pour {path} : {size} octets reçus au lieu de {entry['bytes']}")
        if digest.hexdigest() != entry["sha256"]:
            part.unlink()
            raise VerifyError(f"empreinte fausse pour {path} : {digest.hexdigest()} au lieu de {entry['sha256']}")
        shutil.move(part, target)
        stored.append(path)
        print(f"  OK {path} ({size} octets)")
    return stored
