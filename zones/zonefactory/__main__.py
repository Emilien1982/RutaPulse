"""Command line: python3 -m zonefactory <command> (run from zones/)."""

import argparse
import re
import sys
from pathlib import Path

from .build import DEFAULT_CACHE_DIR, BuildError, build_zone
from .config import ConfigError, get_zone, load_zones


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="zonefactory", description="Fabrique de zones de vtt-nav")
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build", help="fabriquer le paquet d'une zone")
    build.add_argument("id", help="identifiant de la zone, tel qu'écrit dans zones.json")
    build.add_argument("--version", type=int, required=True, help="numéro de version du paquet (1 ou plus)")
    build.add_argument("--out", type=Path, required=True, help="dossier de sortie (vide ou à créer)")
    build.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE_DIR, help="dossier des gros fichiers réutilisés")
    build.add_argument("--osm-url", help="adresse d'extrait OSM qui remplace celle de zones.json pour cette fabrication")
    args = parser.parse_args(argv)
    try:
        if args.version < 1:
            raise ConfigError("--version doit valoir 1 ou plus")
        zone = get_zone(load_zones(), args.id)
        if args.osm_url:
            if not re.fullmatch(r"https://.+\.osm\.pbf", args.osm_url):
                raise ConfigError("--osm-url doit être une adresse https:// qui finit par .osm.pbf")
            zone = dict(zone, osmExtractUrl=args.osm_url)
        build_zone(zone, args.version, args.out, args.cache_dir)
    except (ConfigError, BuildError) as err:
        print(f"Erreur : {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
