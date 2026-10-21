#!/usr/bin/env python3
"""Contrôle qualité après chaque écriture d'un fichier de l'app.

Appelé par un hook PostToolUse déclaré dans .claude/settings.json, pour la
session principale et pour chaque sous-agent.
Claude Code envoie la description de l'action en JSON sur l'entrée standard.

1. Prettier (formatage) corrige le fichier sur place.
2. ESLint (contrôle du code) le vérifie. En cas d'erreur, code de sortie 2 :
   le message est renvoyé à l'agent, qui doit corriger.

Seuls les fichiers sous mobile/ sont traités.
"""
import json
import os
import subprocess
import sys

FORMATES = (".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".yaml", ".yml")
CONTROLES = (".ts", ".tsx", ".js", ".jsx")
IGNORES = ("node_modules/", "ios/", "android/", ".expo/")


def racine_git(chemin):
    # Nearest folder holding a ".git" entry (a file in a git worktree).
    dossier = os.path.dirname(chemin)
    while True:
        if os.path.exists(os.path.join(dossier, ".git")):
            return dossier
        parent = os.path.dirname(dossier)
        if parent == dossier:
            return None
        dossier = parent


def lancer(app, *commande):
    outil = os.path.join(app, "node_modules", ".bin", commande[0])
    return subprocess.run(
        [outil, *commande[1:]], cwd=app, capture_output=True, text=True
    )


def main():
    entree = json.load(sys.stdin)
    params = entree.get("tool_input", {})
    chemin = params.get("file_path") or ""
    if not chemin:
        return
    absolu = os.path.abspath(os.path.join(entree.get("cwd") or os.getcwd(), chemin))
    racine = racine_git(absolu)
    if racine is None or not os.path.exists(absolu):
        return
    app = os.path.join(racine, "mobile")
    relatif = os.path.relpath(absolu, app)
    if relatif.startswith("..") or relatif.startswith(IGNORES):
        return
    if not os.path.exists(os.path.join(app, "node_modules", ".bin", "prettier")):
        print("Contrôle qualité sauté : lancer `npm install` dans mobile/.",
              file=sys.stderr)
        return

    if relatif.endswith(FORMATES):
        formatage = lancer(app, "prettier", "--write", "--ignore-unknown", relatif)
        if formatage.returncode != 0:
            print(f"Prettier n'a pas pu formater {relatif} :\n"
                  f"{formatage.stdout}{formatage.stderr}", file=sys.stderr)
            sys.exit(2)

    if relatif.endswith(CONTROLES):
        lint = lancer(app, "eslint", "--max-warnings", "0", relatif)
        if lint.returncode != 0:
            print(f"ESLint refuse {relatif}. Corrige avant de continuer :\n"
                  f"{lint.stdout}{lint.stderr}", file=sys.stderr)
            sys.exit(2)


if __name__ == "__main__":
    main()
