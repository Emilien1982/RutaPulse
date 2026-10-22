"""SHA-256 fingerprints and the SHA256SUMS file."""

import hashlib
from pathlib import Path

SUMS_NAME = "SHA256SUMS"
_CHUNK = 1024 * 1024


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(_CHUNK):
            digest.update(chunk)
    return digest.hexdigest()


def format_sums(sums: dict[str, str]) -> str:
    """`sha256sum` format: '<hash>  <name>', one line per file, sorted by name."""
    return "".join(f"{sums[name]}  {name}\n" for name in sorted(sums))


def write_sums(folder: Path) -> dict[str, str]:
    """Write SHA256SUMS for every file of `folder` (except itself). Return the hashes."""
    sums = {p.name: sha256_file(p) for p in folder.iterdir() if p.is_file() and p.name != SUMS_NAME}
    (folder / SUMS_NAME).write_text(format_sums(sums), encoding="utf-8")
    return sums
