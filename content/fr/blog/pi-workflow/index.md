---
title: 'Automatiser mon Workflow de Blog avec l Agent de Code Pi'
date: 2026-05-26T09:00:00+02:00
draft: false
cover:
  image: pi_agent.jpg
keywords: ['pi', 'coding-agent', 'automatisation', 'workflow', 'blog-dev', 'développement-assisté-IA', 'hugo', 'github-actions']
description: "Découvrez comment l'agent de code Pi automatise l'intégralité de mon workflow de publication de blog — de la création du ticket au déploiement — avec des exemples concrets tirés du code source de ce blog."
---

# Automatiser mon Workflow de Blog avec l'Agent de Code Pi

En tant que développeur qui maintient un blog technique, je passais presque autant de temps sur **l'infrastructure et les processus** que sur l'écriture elle-même. Créer un nouvel article signifiait : créer un ticket, le catégoriser, créer une branche, écrire le contenu, tester localement, committer, pusher, ouvrir une PR, mettre à jour le ticket — et recommencer.

C'est là que j'ai découvert **Pi**, un agent de code IA conçu pour travailler de manière autonome dans n'importe quel projet. Cet article explique comment j'ai configuré Pi pour automatiser l'intégralité de mon workflow de publication de blog, avec des exemples concrets tirés de ce blog lui-même.

## Qu'est-ce que Pi ?

Pi est un agent de code qui opère dans votre répertoire de projet. Il lit des fichiers, exécute des commandes, édite du code et interagit avec des services externes — le tout via un ensemble configurable d'**outils** et de **compétences** (skills).

Contrairement à un assistant de chat qui vous donne des instructions à suivre, Pi **fait le travail** directement : il lit votre codebase, comprend les conventions, implémente les fonctionnalités, écrit les tests, commit les changements et crée même les pull requests.

### Architecture Générale

```
┌──────────────────────────────────────────────────────────────────┐
│                     Pi Agent (pi.dev)                            │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │   Outils   │  │  Compétences │  │  Backend LLM (API)       │ │
│  │  ────────  │  │  ──────────  │  │  ────────────────────    │ │
│  │  • read    │  │  • forge     │  │  • openai, anthropic...  │ │
│  │  • write   │  │  • secrets   │  │  • claude, gpt...        │ │
│  │  • edit    │  │  • tickets   │  │  • fournisseurs persos   │ │
│  │  • bash    │  │  • perso...  │  │                          │ │
│  │  • grep    │  │              │  │                          │ │
│  │  • find    │  │              │  │                          │ │
│  └────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘ │
│       │                 │                        │              │
│       ▼                 ▼                        ▼              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                Système de fichiers (CWD)                  │   │
│  │  lit/écrit/modifie des fichiers, exécute des commandes   │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

Au cœur de Pi se trouve un Grand Modèle de Langage (LLM) — configurable pour utiliser n'importe quel **fournisseur compatible OpenAI**, comme Claude, GPT ou des modèles locaux — qui a été adapté pour opérer dans une **boucle d'agent** structurée. Pi n'est livré avec aucun LLM par défaut ; vous configurez le fournisseur et le modèle de votre choix. Cela signifie qu'il peut planifier, exécuter, observer les résultats et itérer jusqu'à ce que la tâche soit terminée.

## L'Architecture des Compétences (Skills)

Les compétences (skills) sont des fichiers Markdown qui définissent des workflows reproductibles — et elles ne sont pas propres à Pi. Chaque agent de code utilise des compétences pour comprendre comment opérer dans un projet. Cependant, la véritable force de Pi réside dans son **système d'extensions** : vous pouvez écrire et partager des extensions personnalisées en utilisant le SDK Pi, étendant ainsi l'agent avec de nouveaux outils et capacités au-delà de l'ensemble intégré. Voici ce que j'ai configuré pour ce blog :

### 1. Compétence Forge (`forge-github.md`)

Cette compétence définit comment Pi interagit avec GitHub en tant que forge de développement. Elle couvre :

```bash
# Créer des branches à partir de tickets
git checkout -b "feat/42-ma-fonctionnalite"

# Commiter avec des commits conventionnels
git commit -m "feat(scope): description

Refs: #42"

# Créer des pull requests
sops exec-env .agent/secrets.enc.yaml "gh pr create \
  --title 'feat(scope): description' \
  --body '## Résumé\n...\n\nCloses: #42' \
  --base main"
```

La compétence forge garantit que chaque interaction avec GitHub suit des conventions cohérentes — nommage des branches, messages de commit, descriptions de PR — toutes paramétrées et réutilisables.

### 2. Compétence Secrets (`secrets-sops.md`)

La sécurité est primordiale lorsqu'un agent IA a accès à votre infrastructure. Pi utilise **SOPS** (Secrets OPerationS) avec le chiffrement **age** pour gérer les identifiants :

```
.agent/
├── secrets.enc.yaml    ← Identifiants chiffrés (peut être commité dans git)
├── secrets.yaml        ← Texte clair (dans .gitignore, supprimé après chiffrement)
├── .sops.yaml          ← Configuration SOPS avec la clé publique age
└── skills/
    ├── forge-github.md
    ├── secrets-sops.md
    └── ticket-github-projects.md
```

La règle d'or : toutes les commandes qui nécessitent des identifiants sont encapsulées dans `sops exec-env` :

```bash
# ❌ Erreur — token exposé
export GITHUB_TOKEN="ghp_xxx"
gh pr create

# ✅ Correct — le token n'existe que pendant l'exécution de la commande
sops exec-env .agent/secrets.enc.yaml 'gh pr create --title "..." --body "..."
```

Ainsi, je peux commiter le fichier chiffré dans le dépôt sans jamais exposer les tokens. Quand Pi a besoin d'exécuter une commande GitHub, il déchiffre le fichier en variables d'environnement pour cette seule commande, puis les efface.

### 3. Compétence Ticket (`ticket-github-projects.md`)

Cette compétence relie le tout en gérant les Issues et Projets GitHub :

- **Lister** les tickets assignés
- **Voir** les détails complets d'un ticket avec les commentaires
- **Assigner** des tickets à des utilisateurs
- **Mettre à jour** le statut sur les tableaux de projet
- **Ajouter des commentaires** avec les mises à jour de progression

## Le Workflow Complet : Du Ticket au Déploiement

Voici comment Pi gère le cycle de vie complet d'un article de blog :

### Phase 1 : Prise en Charge de la Tâche

Quand une nouvelle idée arrive — que ce soit un correctif de bug, une demande de fonctionnalité ou un nouvel article — elle est créée sous forme d'Issue GitHub. Le ticket contient :

- Un **titre** décrivant la tâche
- Un **corps** avec les exigences détaillées, idéalement sous forme de critères d'acceptation
- Des **étiquettes** pour la catégorisation (enhancement, bug, content, etc.)
- Un **assigné** pour la responsabilité

### Phase 2 : Invocation de l'Agent

J'invoque Pi avec le numéro du ticket en langage naturel :

```
/implement ticket 21
```

Pi immédiatement :

1. Lit la documentation des compétences pour comprendre les workflows disponibles
2. Récupère les identifiants depuis le fichier SOPS chiffré
3. Récupère les détails complets du ticket via `gh issue view`
4. Affiche un résumé pour confirmation

### Phase 3 : Préparation

Une fois les détails du ticket confirmés, Pi :

1. **Assigne le ticket** à l'utilisateur approprié
2. **Ajoute un commentaire "en cours"** pour communiquer le statut
3. **Crée une branche de fonctionnalité** dérivée du ticket (ex: `content/21-pi-workflow-article`)
4. **Récupère la dernière version de la branche de base** pour éviter les conflits de fusion

### Phase 4 : Implémentation

C'est là que Pi brille vraiment. Il :

1. **Explore le projet** — lit la configuration Hugo, les articles existants, les archétypes et la structure du thème
2. **Comprend les conventions** — format du frontmatter, structure des dossiers (bilingue : `content/en/blog/X` et `content/fr/blog/X`), placement des images
3. **Implémente la fonctionnalité** — écrit les deux versions linguistiques de l'article, crée les assets nécessaires
4. **Vérifie la compilation** — exécute `hugo --minify` pour s'assurer que le site se compile sans erreur

### Phase 5 : Assurance Qualité

Avant de commiter quoi que ce soit, Pi exécute :

- **Vérification de la compilation** : `hugo --minify` contrôle que tout le site se construit
- **Vérification des conventions** : champs du frontmatter, utilisation des tags, références aux images
- **Revue de contenu** : les deux langues sont complètes et cohérentes

### Phase 6 : Livraison

Une fois que tout est vérifié :

1. **Commit** avec un message de commit conventionnel
2. **Push** de la branche sur GitHub
3. **Création d'une Pull Request** avec une description complète
4. **Mise à jour du ticket** avec le lien de la PR et les instructions de test
5. **Nettoyage** en retournant à la branche de base

### Phase 7 : Déploiement de Prévisualisation via cloudlfare

Une fois la PR ouverte, un workflow GitHub Actions (`.github/workflows/cloudlfare-preview.yml`) déploie automatiquement une prévisualisation en direct du site sur **cloudlfare**.

Ce workflow se déclenche à chaque mise à jour de la PR, compile le site et le déploie sur un domaine de staging. Un commentaire automatique sur la PR fournit l'URL de prévisualisation en direct — parfait pour que les relecteurs voient les changements sans exécuter le site localement.

## Exemple Concret : Cet Article Lui-Même

L'article que vous lisez en ce moment a été créé en utilisant ce workflow. Voici ce qui s'est passé en coulisses :

### Étape 1 : Le Ticket

L'Issue #21 a été créée avec cette description :

> "Le blog aurait bien besoin d'un article sur l'agent de code Pi et sur la façon dont je m'en sers pour automatiser mon workflow de travail sur mon blog, exemples à l'appui. En français et en anglais, of course."

### Étape 2 : Pi en Action

Pi a lu le ticket, analysé la structure du projet, et :

- Créé la branche `content/21-pi-workflow-article`
- Écrit l'article en anglais dans `content/en/blog/pi-workflow/`
- Écrit la traduction française dans `content/fr/blog/pi-workflow/`
- Exécuté `hugo --minify` pour vérifier la compilation
- Commit et push
- Créé une PR et mis à jour le ticket

Le tout sans que j'écrive une seule ligne de code ou commande.

### La Boucle de l'Agent : Dans les Coulisses

Jetons un coup d'œil sous le capot pour voir comment Pi réfléchit à une tâche. Lors du traitement de ce ticket, la boucle interne de Pi ressemble à ceci :

```
1. Lire le ticket #21 → "Article sur mon workflow pi"
2. Explorer le projet → Blog Hugo avec thème PaperMod, bilingue (EN/FR)
3. Vérifier les articles existants → motif du frontmatter, images de couverture, structure
4. Planifier → écrire index.md pour les deux langues, créer l'image de couverture, vérifier la compilation
5. Exécuter → écrire les fichiers, lancer hugo --minify
6. Vérifier → compilation réussie, pas d'erreurs
7. Commit + Push → créer la PR
8. Mettre à jour le ticket → ajouter un commentaire avec le lien de la PR et les instructions de test
```

Ce n'est pas un script statique — Pi adapte le plan en fonction de ce qu'il trouve. Si la compilation échoue, il corrige le problème et réessaye. Si un fichier existe déjà, il le met à jour plutôt que de l'écraser.

## Pourquoi C'est Important

### Pour les Développeurs Solo

Si vous maintenez un blog personnel, un projet open-source ou un projet personnel, Pi élimine la **surcharge des processus**. Vous vous concentrez sur les idées et le contenu ; Pi s'occupe de la mécanique.

### Pour les Équipes

Dans un contexte d'équipe, Pi garantit une **exécution cohérente du workflow**. Chaque PR suit les mêmes conventions, chaque ticket est mis à jour de la même manière, chaque branche respecte le schéma de nommage. Cela réduit la charge cognitive et élimine la "dérive des processus."

### Pour les DevOps

Pi applique les bonnes pratiques par conception :
- **Pas de secrets en dur** — tout passe par SOPS
- **Commits conventionnels** — historique structuré et analysable
- **Vérification de la compilation** — ne jamais commiter de code cassé
- **PRs complètes** — descriptions claires, instructions de test

## Mettre en Place Cela pour Votre Projet

Vous voulez reproduire ce workflow ? Voici ce dont vous avez besoin :

### 1. Installer Pi

```bash
npm install -g @earendil-works/pi-coding-agent
```

### 2. Créer Vos Compétences

Définissez des compétences sous forme de fichiers Markdown dans `.agent/skills/`. Chaque compétence décrit :
- Le **nom** et la **description** de la capacité
- Les **commandes CLI** ou les **appels API** pour l'exécuter
- La **documentation** pour que l'agent IA comprenne le contexte

### 3. Configurer la Gestion des Secrets

```bash
# Générer une clé age
age-keygen -o key.txt

# Créer la configuration SOPS
cat > .agent/.sops.yaml << EOF
creation_rules:
  - age: AGE_PUBLIC_KEY
EOF

# Chiffrer vos secrets
sops --encrypt secrets.yaml > .agent/secrets.enc.yaml
```

### 4. Configurer les Outils

Les outils de Pi sont intégrés, mais vous pouvez les étendre avec des outils personnalisés via le **SDK Pi**. L'ensemble intégré — `read`, `write`, `edit`, `bash`, `grep`, `find`, `ls` — couvre la plupart des besoins d'un projet, mais le SDK vous permet d'écrire et de partager des extensions personnalisées pour des tâches spécifiques au projet.

### 5. Découvrir et Installer des Extensions

L'un des plus grands atouts de Pi est son **écosystème d'extensions**. Vous pouvez parcourir et installer des extensions contribuées par la communauté, ou écrire les vôtres et les partager. Les extensions peuvent ajouter de nouveaux outils, des fournisseurs personnalisés, des thèmes pour le TUI, et bien plus encore — rendant Pi adaptable à n'importe quel workflow.

### 5. Lancer Votre Premier Ticket

```bash
pi "/implement ticket 1"
```

## Leçons Apprises

Après avoir utilisé Pi pendant plusieurs mois sur ce blog, voici ce que j'ai constaté :

### Ce Qui Fonctionne Bien

- **Workflows répétitifs** : Branchement, commit, création de PR — Pi gère tout cela parfaitement
- **Création de contenu** : Écrire des articles bilingues avec une structure cohérente entre les langues
- **Vérification de la compilation** : Plus de "ça marche sur ma machine" — Pi vérifie toujours la compilation réelle
- **Application des processus** : Chaque PR suit le même modèle, chaque commit est conventionnel

### Ce Qui Nécessite une Supervision

- **Décisions de conception complexes** : Pi suit les conventions de votre projet, mais les décisions architecturales novatrices nécessitent toujours un jugement humain
- **Opérations sensibles à la sécurité** : Bien que SOPS gère bien les identifiants, examinez toujours ce que Pi fait avec les tokens d'accès
- **Contenu nuancé** : L'IA fait un bon travail avec le contenu technique, mais une relecture humaine du ton et de la précision est essentielle

### Améliorations Futures

J'attends avec impatience :
- **Extensions personnalisées** : Écrire des extensions Pi avec le SDK pour des tâches spécifiques au blog (ex : génération de cartes sociales) et les partager avec la communauté
- **Workflows multi-agents** : Des agents Pi gérant différentes parties du pipeline simultanément
- **Meilleure compréhension du projet** : Pi apprenant des revues de PR passées et adaptant son style de code

## Conclusion

L'agent de code Pi a transformé la façon dont je maintiens ce blog. Ce qui me prenait une heure de configuration, de branchement et de travail de processus pour chaque article se produit maintenant en quelques secondes. Plus important encore, la **cohérence** et la **fiabilité** du workflow automatisé signifient que je consacre mon énergie à ce qui compte : écrire du contenu qui aide les autres développeurs.

La combinaison d'une **architecture pilotée par les compétences**, d'**outils extensibles via le SDK**, d'une **sécurité renforcée par SOPS** et d'une **exécution autonome par agent** crée un environnement de développement où les idées passent de la conception au déploiement avec un minimum de friction.

Si vous maintenez un blog technique, un projet open-source ou tout projet logiciel avec un workflow défini, je vous recommande vivement d'essayer Pi. Configurez vos compétences, chiffrez vos secrets et laissez l'agent gérer le processus pendant que vous vous concentrez sur le produit.

---

*Cet article a été écrit en utilisant le workflow de l'agent de code Pi qu'il décrit. L'implémentation entière — du ticket à la PR publiée — a été gérée de manière autonome, y compris ce paragraphe.*
