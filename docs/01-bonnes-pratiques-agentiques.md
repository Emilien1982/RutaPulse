# Bonnes pratiques du développement agentique

> Phase 1 du projet — synthèse de recherche, 19 octobre 2026.
> Sources : documentation officielle Claude Code, blog d'ingénierie d'Anthropic,
> guides de praticiens (liste en fin de document).

Le document est organisé autour des trois risques que tu as nommés —
**perdre le fil**, **faire de l'overkill**, **produire du code fragile** — plus
un quatrième que tu as cité en filigrane : **le coût**.

---

## 0. La contrainte qui explique presque tout : le contexte

Un agent ne « se souvient » que de ce qui est dans sa fenêtre de contexte :
chaque message, chaque fichier lu, chaque sortie de commande. Elle se remplit
vite, et **la qualité baisse à mesure qu'elle se remplit** : l'agent oublie des
consignes anciennes et fait plus d'erreurs. Quand elle déborde, elle est
résumée (« compactée ») et des détails se perdent.

Conséquence : presque toutes les bonnes pratiques ci-dessous sont des façons de
**sortir l'information de la conversation pour la mettre dans des fichiers**,
et de **donner à chaque agent un contexte petit et propre**.

> Leçon clé : la mémoire d'un projet agentique, ce sont ses fichiers, pas la
> conversation. Si une décision n'est écrite nulle part, elle finira oubliée.

---

## 1. Ne pas perdre le fil

| Pratique | Pourquoi | Comment |
|---|---|---|
| **Un tableau de bord écrit** | La conversation sera compactée ; un fichier, non. | `PILOTAGE.md` : phase en cours, décisions prises, décisions en attente, prochaine étape. Relu au début de chaque session. |
| **Une liste de fonctionnalités complète dès le départ, toutes « non faites »** | Observé par Anthropic : un agent qui voit du travail déjà fait a tendance à déclarer le projet terminé. | Un backlog où l'agent ne fait que cocher, jamais supprimer ni réécrire un critère. |
| **Une spec par phase, avec ses non-objectifs** | L'agent comble les trous de la consigne avec ses habitudes, pas avec ton intention. | Chaque phase a : objectif, critères d'acceptation vérifiables, **ce qui est hors périmètre**, vérification de bout en bout. |
| **Les décisions dans des ADR** | « Pourquoi a-t-on choisi X ? » doit avoir une réponse écrite, datée, avec les alternatives rejetées. | `docs/adr/NNNN-titre.md`, une décision par fichier. |
| **Un commit par étape terminée** | Git est le seul vrai point de retour, et l'historique raconte le projet. | Petits commits descriptifs ; jamais une étape « à moitié faite » non commitée. |
| **Une session par sujet** | Mélanger les sujets dans une conversation (« kitchen sink session ») pollue le contexte. | Tes questions de fond → une session à part ; la session principale reste sur l'avancement. |
| **Repartir à neuf après deux corrections ratées** | Le contexte est encombré de tentatives échouées. | `/clear` et une consigne meilleure, plutôt qu'une troisième correction. |

**Le piège principal : la dérive silencieuse spec ↔ code.** Le code évolue, la
spec reste figée, et l'écart n'apparaît que quand il coûte cher. Parade : le
reviewer vérifie le code **contre la spec**, et toute déviation volontaire met
la spec à jour dans le même commit.

---

## 2. Éviter l'overkill

C'est le défaut le plus fréquent des agents : abstractions inutiles, code
défensif contre des cas impossibles, fonctionnalités non demandées.

1. **Petites phases, livrables visibles.** Chaque phase produit quelque chose
   que tu peux voir tourner. Une phase qui ne se démontre pas est suspecte.
2. **Les non-objectifs écrits noir sur blanc.** « Pas de compte utilisateur
   dans cette phase », « ne pas refactorer les modules non concernés ».
3. **Le reviewer ne remonte que ce qui touche à la correction ou aux
   exigences.** Un reviewer à qui l'on demande des défauts en trouve toujours ;
   suivre chacune de ses remarques mène tout droit à la sur-ingénierie
   (avertissement explicite de la doc officielle). Le reste est optionnel.
4. **Pas d'agents pour le décor.** Un agent qui n'apporte ni contexte propre ni
   regard indépendant coûte des tokens et ajoute de la coordination. Plusieurs
   sources le disent : des agents mal délimités donnent *plus* de travail à
   l'orchestrateur qu'ils ne lui en retirent.
5. **Introduire un outil quand son besoin apparaît**, jamais par anticipation
  .

---

## 3. Produire un code solide (et non du spaghetti)

| Pratique | Détail |
|---|---|
| **Donner à l'agent un moyen de se vérifier** | La pratique n° 1 de la doc officielle. Sans test, build ou capture qu'il peut lancer, « ça a l'air fini » est son seul critère d'arrêt — et c'est toi qui deviens la boucle de vérification. |
| **Séparer celui qui écrit de celui qui juge** | Un agent qui note son propre code est indulgent, et écrit des tests façonnés sur le code qu'il vient de produire. Le reviewer et le testeur travaillent dans un contexte neuf, sans le raisonnement de l'auteur. |
| **Tests écrits depuis la spec, pas depuis le code** | Le test doit vérifier ce que la fonctionnalité *doit* faire, pas ce que le code *fait*. |
| **Tests de bout en bout comme un humain** | Anthropic a observé des fonctionnalités marquées « faites » parce que les tests unitaires passaient, alors qu'elles étaient cassées pour l'utilisateur. Pour nous : l'app sur un vrai téléphone, captures à l'appui. |
| **Des garde-fous déterministes (hooks)** | Une consigne dans CLAUDE.md est un conseil ; un hook est une loi. Lint, typecheck et tests qui bloquent : pas d'exception possible. |
| **Casser volontairement chaque garde-fou** | Un garde-fou jamais vu échouer n'est pas prouvé. |
| **Éprouver une API de plateforme avant de bâtir dessus** | Un essai jetable de 30 lignes avant une phase entière. Crucial ici : GPS en arrière-plan, cartes hors ligne et batterie sont exactement le genre d'API qui « existe » mais ne marche pas comme prévu. |
| **Des preuves, pas des affirmations** | L'agent montre la sortie des tests, la commande lancée, la capture. Un `BUILD SUCCESSFUL` n'est pas une preuve. |
| **Architecture en couches, décidée tôt** | Le spaghetti naît quand chaque fonctionnalité invente sa structure. Une architecture validée et écrite (ADR + CLAUDE.md court) que tous les agents suivent. |

---

## 4. Maîtriser le coût

1. **Le bon modèle pour chaque rôle.** Les sous-agents se configurent
   chacun avec leur modèle. Règle générale des praticiens :
   - **Opus** (le plus capable, le plus cher) : raisonnement à fort enjeu —
     orchestration, architecture, revue critique ;
   - **Sonnet** (≈ 95 % de la qualité d'Opus pour environ la moitié du prix) :
     le gros du travail, l'implémentation ;
   - **Haiku** (de loin le moins cher) : tâches étroites et fréquentes —
     recherche dans le code, lancer des tests, relire des logs.
     Déconseillé pour les modifications qui touchent plusieurs fichiers.
   Les tarifs exacts évoluent (baisse d'Opus 5.5 début octobre selon des sites
   tiers) ; on les vérifiera en phase 2. Avec un abonnement, le « coût » se
   mesure surtout en quota d'utilisation consommé.
2. **Les sous-agents isolent les sorties volumineuses.** Logs, tests, lectures
   massives restent dans leur contexte ; seul un résumé revient.
3. **Ne pas sur-paralléliser.** Chaque sous-agent consomme ses propres tokens
   et doit relire le contexte du projet à chaque lancement.
4. **CLAUDE.md court.** Il est chargé à chaque session *et* dans chaque
   sous-agent : chaque ligne inutile est payée des dizaines de fois. Et trop
   long, il est ignoré.
5. **Le temps passé sur la spec rapporte plus que le temps passé à surveiller
   l'implémentation** (doc officielle).

---

## 5. Les briques Claude Code, et à quoi chacune sert

| Brique | Rôle | Analogie |
|---|---|---|
| `CLAUDE.md` | Règles du projet chargées à chaque session. Court, élagué régulièrement. | Le règlement intérieur |
| **Sous-agents** (`.claude/agents/*.md`) | Un rôle avec son propre prompt, ses outils, son modèle, et un **contexte neuf** (il ne voit pas notre conversation). | Un collègue spécialisé à qui l'on confie un dossier |
| **Skills** (`.claude/skills/`) | Savoir-faire ou procédure chargés à la demande (`/verif`, `/nouvelle-phase`…). | Une fiche de procédure |
| **Hooks** | Scripts exécutés automatiquement à des moments précis — impossibles à « oublier ». | Un contrôle automatique à la porte |
| **Plan mode** | L'agent explore et propose un plan sans rien modifier. | L'étude avant le chantier |
| **Sessions parallèles / worktrees** | Plusieurs chantiers isolés en même temps. | Plusieurs équipes, plusieurs ateliers |

**Limite importante des sous-agents** : ils ne peuvent pas te poser de
question, et ils ne voient que ce qu'on leur transmet. Tout dialogue avec toi
passe par la session principale.

---

## 6. Ce que j'en retiens pour notre organisation — à discuter en phase 2

Une remarque franche sur ta demande « un agent par rôle » : c'est une bonne
intuition **pour les rôles qui ont besoin d'indépendance**, mais certains rôles
ne gagnent rien à être des agents.

- **Le Product Owner, c'est toi.** C'est toi qui décides ce que le produit doit
  être ; un agent PO ne ferait que deviner à ta place. Je t'aiderai en
  t'interviewant et en rédigeant, mais la décision reste la tienne.
- **Le Product/Project Manager, c'est la session principale** (moi) : je garde
  le fil, je découpe, je tiens `PILOTAGE.md`, je délègue et je te rends compte.
  En faire un sous-agent lui ferait perdre précisément ce qui compte : notre
  conversation.
- **Les rôles qui méritent un vrai agent** sont ceux où un contexte neuf ou un
  regard indépendant améliore le résultat : architecte, développeur, reviewer,
  testeur, et probablement designer UI et un éclaireur bon marché pour les
  recherches.

En phase 2 je te proposerai pour chacun : sa mission, ses outils autorisés,
son modèle et la justification du choix, puis on les éprouvera sur une tâche
jetable — et on cassera exprès un garde-fou pour vérifier qu'il tient.

### Le circuit d'une phase (proposition)

```
toi (PO) ──► spec de phase ──► ta validation ──► dev (contexte neuf)
                                                    │
               ◄── compte rendu + preuves ◄── reviewer + testeur (contextes neufs)
                                                    │
                                           commit + PILOTAGE.md à jour
```

---

## Sources

- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices) — documentation officielle
- [Subagents](https://code.claude.com/docs/en/sub-agents) — documentation officielle
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — blog d'ingénierie d'Anthropic
- [Claude Code Subagents: 12 best practices](https://thepromptshelf.dev/blog/claude-code-subagents-12-best-practices-2026/)
- [Best practices for Claude Code sub-agents](https://www.pubnub.com/blog/best-practices-claude-code-sub-agents/)
- [Claude Code best practices for agentic coding](https://www.openhands.dev/blog/claude-code-best-practices-agentic-coding)
- [Multi-agent software engineering](https://dzone.com/articles/multi-agent-software-engineering)
- [Claude Haiku vs Sonnet vs Opus](https://www.morphllm.com/comparisons/claude-haiku-vs-sonnet-vs-opus)
- [Claude Opus 5.5 pricing](https://anotherwrapper.com/tools/llm-pricing/claude-opus-5-5) — site tiers, à vérifier
- [Spec-driven AI development](https://www.mejba.me/fr/concepts/spec-driven-ai-development)
