# Un seul trait

**Dessine le passage. Déplace le décor. Aide un personnage impatient à aller jusqu’au bout.**

Une aventure de dessin en français, inspirée de *La Linea* d’Osvaldo Cavandoli. Le terrain, le personnage et ses réactions prennent forme sur un fond uni. La main suit ton crayon et intervient sur les objets du décor.

Projet de fan non officiel. Les illustrations et les sons du dessin animé ne sont pas distribués avec le jeu ; voir [les crédits](CREDITS.md).

## Jouer sans compiler

Télécharge le fichier **Un-seul-trait-1.1.0.html** dans [la version publiée](https://github.com/M4D135/Un-seul-trait/releases/latest), puis ouvre-le dans un navigateur moderne. Tout le jeu est inclus dans ce fichier.

## Lancer les sources

Avec **Node.js 22.13 ou plus récent** installé, depuis le dossier du projet :

```sh
npm ci
npm run dev
```

Ouvre l’adresse affichée dans le terminal. Aucun compte, serveur de données, clé API ni service externe n’est nécessaire.

### Commandes par défaut

| Action | Touches |
| --- | --- |
| Aller à gauche | ← ou Q |
| Aller à droite | → ou D |
| Se baisser (maintenir) | ↓ ou S |
| Dessiner un passage | E |
| Actionner la main sur un objet proche | F ou Entrée |
| Pause / reprendre | P ou Échap |
| Revenir au dernier drapeau | R |

Les commandes se changent dans le menu **Commandes** : deux touches possibles par action, avec détection des doublons. Sur écran tactile, les boutons du jeu assurent les déplacements et les actions.

Approche un passage manquant, ouvre le dessin, puis relie ses deux ancres à la souris ou au doigt. Le terrain suit le trait tracé. Un essai raté peut être repris ; un passage déjà construit peut être redessiné. Les objets manipulables portent une poignée : utilise-la directement ou appelle la main avec la commande d’interaction.

Les six parcours se traversent en marchant, en se baissant, en dessinant et en manipulant les mécanismes. Le saut a été retiré du moteur et des commandes : Espace et ↑ ne déclenchent plus de mouvement par défaut. Le personnage réagit, interpelle le joueur et proteste lorsqu’un passage lui manque. Les drapeaux servent de points de reprise ; les constructions, les étoiles et les mécanismes résolus peuvent être retrouvés à la prochaine visite grâce à la sauvegarde locale du navigateur.

## Un seul fichier pour jouer hors ligne

```sh
npm run build
```

Le dossier `dist/` contient deux versions :

- **`offline-play.html`** : copie ce seul fichier et ouvre-le dans un navigateur moderne. Le code, les styles, les icônes et l’image de la main sont inclus.
- **`index.html` et `assets/`** : version destinée à un hébergement statique. Envoie le contenu complet de `dist/` sur ton hébergement ; les chemins relatifs fonctionnent aussi dans un sous-dossier.

Pour vérifier la version compilée sur un serveur local :

```sh
npm run preview
```

La sauvegarde dépend du navigateur et de l’emplacement du jeu. En mode fichier local, certains navigateurs limitent le stockage ; le jeu reste jouable, mais la reprise persistante n’est alors pas garantie. Le son commence après la première action du joueur. Le plein écran et la voix italienne optionnelle dépendent également des capacités du navigateur.

## Dessin, main et voix

Le personnage est redessiné en contours vectoriels, avec une marche faite de silhouettes successives. Les flexions, gestes des bras et poses d’attente suivent les références décrites dans [MOVEMENTS.md](docs/MOVEMENTS.md). Le personnage reste relié au terrain lorsqu’il marche ou se baisse ; une chute accidentelle reste possible.

La main est une **image générée au rendu photographique, animée par le code** autour de la pointe du crayon. Il ne s’agit pas d’une nouvelle prise de vues filmée. Le grammelot est une synthèse originale produite localement avec Web Audio ; le mode italien optionnel utilise uniquement une voix installée sur l’appareil et revient à la synthèse si elle n’est pas disponible. Aucun enregistrement ni clonage de la voix originale n’est intégré.

## Développer

```sh
npm run typecheck
npm test
npm run build
# ou les trois étapes :
npm run check
```

Les tests couvrent les constructions, les mécanismes, les collisions, la traversée sans saut, la posture baissée, les points de reprise, la sauvegarde et la migration des touches personnalisées. Ils sont compilés dans un dossier temporaire puis exécutés par le runner de tests de Node ; aucun navigateur ni service distant n’est requis.

| Fichier ou dossier | Rôle |
| --- | --- |
| `app/page.tsx` | Interface, entrées, caméra et boucle de jeu |
| `app/globals.css` | Présentation responsive |
| `lib/trait/platformer.ts` | Simulation et collisions |
| `lib/trait/platform-drawing.ts` | Validation du trait libre |
| `lib/trait/platform-mechanisms.ts` | Objets manipulables et déplacements |
| `lib/trait/platform-renderer.ts` | Terrain, objets, effets et personnage |
| `lib/trait/cartoon-character.ts` / `companion.ts` | Silhouettes et réactions |
| `lib/trait/audio.ts` / `hand.ts` | Sons locaux et main animée |
| `lib/trait/controls.ts` / `progress.ts` | Touches et sauvegarde |
| `components/trait/` | Configuration des commandes |
| `scripts/public-*` | Entrée React et compilation autonome |

Le workflow « Vérification du jeu » vérifie les types, exécute les tests et fournit le build comme artefact téléchargeable. Le workflow « Publication linea.estrasse.fr » met le site en ligne sur https://linea.estrasse.fr à chaque push sur `main` : voir [deploy/README.md](deploy/README.md).

Les détails de compilation sont dans [BUILD.md](docs/BUILD.md). Les références artistiques et les notices des dépendances sont dans [CREDITS.md](CREDITS.md) et [THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md).
