"""Command line: python3 -m zonefactory <command> (run from zones/)."""

import argparse
import re
import subprocess
import sys
from pathlib import Path

from .catalogue import CatalogueError, make_catalogue
from .build import DEFAULT_CACHE_DIR, BuildError, build_zone
from .config import ConfigError, get_zone, load_zones
from .verify import VerifyError, read_catalogue, verify_zone
from .versions import next_version


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="zonefactory", description="Fabrique de zones de vtt-nav")
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build", help="fabriquer le paquet d'une zone")
    build.add_argument("id", help="identifiant de la zone, tel qu'écrit dans zones.json")
    build.add_argument("--version", type=int, required=True, help="numéro de version du paquet (1 ou plus)")
    build.add_argument("--out", type=Path, required=True, help="dossier de sortie (vide ou à créer)")
    build.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE_DIR, help="dossier des gros fichiers réutilisés")
    build.add_argument("--osm-url", help="adresse d'extrait OSM qui remplace celle de zones.json pour cette fabrication")
    nxt = commands.add_parser("next-version", help="écrire le numéro de version suivant (étiquettes lues sur l'entrée standard)")
    nxt.add_argument("id")
    cat = commands.add_parser("catalogue", help="ajouter ou remplacer une zone dans le catalogue")
    cat.add_argument("--current", type=Path, required=True, help="catalogue actuel (absent ou vide au premier lancement)")
    cat.add_argument("--package", type=Path, required=True, help="dossier du paquet fabriqué")
    cat.add_argument("--repo", required=True, help="propriétaire/dépôt GitHub")
    cat.add_argument("--out", type=Path, required=True, help="catalogue à écrire")
    ver = commands.add_parser("verify", help="télécharger une zone et contrôler taille et empreinte de chaque fichier")
    ver.add_argument("--catalogue", required=True, help="adresse ou fichier du catalogue")
    ver.add_argument("--zone", required=True)
    ver.add_argument("--dest", type=Path, required=True)
    args = parser.parse_args(argv)
    if args.command == "next-version":
        print(next_version(args.id, sys.stdin.read().split()))
        return 0
    try:
        if args.command == "catalogue":
            result = make_catalogue(args.current, args.package, args.repo, args.out)
            print(f"Catalogue écrit : {args.out} ({len(result['zones'])} zone(s))")
            return 0
        if args.command == "verify":
            files = verify_zone(read_catalogue(args.catalogue), args.zone, args.dest)
            print(f"Zone « {args.zone} » correcte : {len(files)} fichiers rangés dans {args.dest}")
            return 0
        if args.version < 1:
            raise ConfigError("--version doit valoir 1 ou plus")
        zone = get_zone(load_zones(), args.id)
        if args.osm_url:
            if not re.fullmatch(r"https://.+\.osm\.pbf", args.osm_url):
                raise ConfigError("--osm-url doit être une adresse https:// qui finit par .osm.pbf")
            zone = dict(zone, osmExtractUrl=args.osm_url)
        build_zone(zone, args.version, args.out, args.cache_dir)
    except (ConfigError, BuildError, CatalogueError, VerifyError) as err:
        print(f"Erreur : {err}", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as err:
        print(f"Erreur : la commande a échoué (code {err.returncode}) : {' '.join(map(str, err.cmd))}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
