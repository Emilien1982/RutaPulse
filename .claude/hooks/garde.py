#!/usr/bin/env python3
"""Garde-fou des sous-agents : bloque les actions hors de leur zone.

Appelé par un hook PreToolUse déclaré dans chaque fichier d'agent :
    garde.py <role>
Claude Code envoie la description de l'action en JSON sur l'entrée standard.
Code de sortie 2 = action bloquée ; le message d'erreur est renvoyé à l'agent.

Limite connue : un agent qui a l'outil Bash peut écrire un fichier avec une
commande shell. Ce cas n'est pas bloqué ici ; le relecteur vérifie dans le
diff qu'aucun fichier hors périmètre n'a changé.
"""
import json
import os
import re
import sys

PROTEGES = ("docs/", "design/", ".claude/", "CLAUDE.md", "PILOTAGE.md")
# e2e/ holds the Maestro scenarios (end-to-end tests).
MOTIF_TEST = re.compile(
    r"(^|/)(tests?|__tests__|e2e)/|(^|/)test_[^/]*$|[._-](test|spec)\.[^/]+$"
)
GIT_LECTURE = re.compile(r"^\s*git\s+(diff|log|show|status|blame)\b")
ENCHAINEMENT = re.compile(r"[;&|<>`]|\$\(")


def bloquer(message):
    print(f"Bloqué par le garde-fou : {message}", file=sys.stderr)
    sys.exit(2)


def racine_git(chemin):
    # Nearest folder holding a ".git" entry: a folder in the main checkout,
    # a file in a git worktree. A worktree under .claude/worktrees/ is thus
    # its own root, and its files are not seen as protected .claude/ files.
    dossier = os.path.dirname(chemin)
    while True:
        if os.path.exists(os.path.join(dossier, ".git")):
            return dossier
        parent = os.path.dirname(dossier)
        if parent == dossier:
            return None
        dossier = parent


def chemin_relatif(entree):
    # CLAUDE_PROJECT_DIR is not used: it points to the folder where the
    # session started, which can be a parent folder.
    params = entree.get("tool_input", {})
    chemin = params.get("file_path") or params.get("notebook_path") or ""
    base = entree.get("cwd") or os.getcwd()
    absolu = os.path.abspath(os.path.join(base, chemin))
    projet = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    racine = racine_git(absolu)
    worktrees = os.path.join(projet, ".claude", "worktrees") + os.sep
    # Only this project and its own worktrees count; another repository on
    # the disk stays "outside the project".
    if racine is None or not (racine == projet or racine.startswith(worktrees)):
        racine = projet
    return os.path.relpath(absolu, racine), absolu


def est_protege(chemin):
    return any(chemin == p or chemin.startswith(p) for p in PROTEGES)


def verifier_ecriture(role, chemin, absolu):
    if chemin.startswith(".."):
        bloquer(f"{chemin} est en dehors du projet.")
    if role == "developpeur":
        if est_protege(chemin):
            bloquer(f"le développeur ne modifie pas {chemin}.")
        if MOTIF_TEST.search(chemin) and os.path.exists(absolu):
            bloquer(f"le développeur ne modifie pas un test existant ({chemin}).")
    elif role == "testeur":
        if not MOTIF_TEST.search(chemin):
            bloquer(f"le testeur n'écrit que des fichiers de test, pas {chemin}.")
    elif role == "architecte":
        if not chemin.startswith("docs/"):
            bloquer(f"l'architecte n'écrit que dans docs/, pas {chemin}.")
    elif role == "designer":
        if not chemin.startswith("design/"):
            bloquer(f"le designer n'écrit que dans design/, pas {chemin}.")
    else:
        bloquer(f"le rôle {role} n'a pas le droit d'écrire.")


def verifier_commande(role, commande):
    if role != "relecteur":
        return
    if ENCHAINEMENT.search(commande) or not GIT_LECTURE.match(commande):
        bloquer("le relecteur ne lance que git diff, log, show, status ou blame, "
                "sans enchaînement de commandes.")


def main():
    role = sys.argv[1] if len(sys.argv) > 1 else ""
    entree = json.load(sys.stdin)
    outil = entree.get("tool_name", "")
    if outil in ("Edit", "Write", "NotebookEdit"):
        verifier_ecriture(role, *chemin_relatif(entree))
    elif outil == "Bash":
        verifier_commande(role, entree.get("tool_input", {}).get("command", ""))
    sys.exit(0)


if __name__ == "__main__":
    main()
