# Un seul trait

**Dessine le passage. Déplace le décor. Aide un personnage impatient à aller jusqu’au bout.**

Une aventure de dessin en français, inspirée de *La Linea* d’Osvaldo Cavandoli. Le terrain, le personnage et ses réactions prennent forme sur un fond uni. La main accompagne ton crayon et les interactions avec le décor.

La version **1.2.0** apporte le dessin direct à la souris ou au doigt, une présentation mobile en portrait et en paysage, une courte animation de main filmée et trois courts extraits sonores provenant des sources officielles de Quipos. **Projet de fan non officiel** : les provenances, traitements et droits des médias sont détaillés dans [CREDITS.md](CREDITS.md).

## Jouer sans compiler

Joue sur **[linea.estrasse.fr](https://linea.estrasse.fr)**, ou télécharge **Un-seul-trait-1.2.0.html** dans [la version publiée](https://github.com/M4D135/Un-seul-trait/releases/latest), puis ouvre-le dans un navigateur moderne. Le fichier autonome contient le jeu et ses ressources.

## Dessiner directement

Approche un passage manquant, puis commence ton trait sur l’une de ses deux ancres **A ou B**. Maintiens le clic ou le doigt jusqu’à l’autre ancre et relâche pour valider. Le tracé fonctionne dans les deux sens, **A → B ou B → A**, sans appuyer sur E. Le terrain praticable suit ton trait ; un essai raté peut être repris et un passage déjà construit peut être redessiné.

La touche **E reste un raccourci facultatif** pour ouvrir le mode dessin au clavier. Les boutons d’effacement et d’annulation permettent de reprendre le geste.

Les objets manipulables portent une poignée dorée : attrape-la directement ou utilise **Manipuler** pour déplacer le mécanisme proche jusqu’à l’autre extrémité de son rail.

### Sur téléphone

Le jeu s’adapte au portrait et au paysage, sans imposer de tourner l’écran. Les flèches **← →** sont à gauche ; **Se baisser** et **Manipuler** sont à droite. Garde le bouton de flexion appuyé pour avancer sous un obstacle bas. Le dessin se fait directement dans la scène.

La scène utilise l’espace disponible entre l’en-tête et les commandes. La page de jeu ne défile pas pendant la partie ; les menus disposent de leur propre défilement. Les réglages restent accessibles depuis leur icône, y compris en plein écran.

### Commandes par défaut

| Action | Touches |
| --- | --- |
| Aller à gauche | ← ou Q |
| Aller à droite | → ou D |
| Se baisser (maintenir) | ↓ ou S |
| Ouvrir le mode dessin au clavier, facultatif | E |
| Actionner la main sur un objet proche | F ou Entrée |
| Pause / reprendre | P ou Échap |
| Revenir au dernier drapeau | R |

Le menu **Commandes** accepte **deux touches par action**, avec détection des doublons. La configuration personnalisée est sauvegardée dans le navigateur.

Les six parcours se traversent en marchant, en se baissant, en dessinant et en manipulant les mécanismes. **Le jeu ne comporte pas de saut** : Espace et ↑ ne déclenchent plus de mouvement par défaut. Le personnage réagit, interpelle le joueur et proteste lorsqu’un passage lui manque. Les drapeaux servent de points de reprise ; les constructions, les étoiles et les mécanismes résolus peuvent être retrouvés à la prochaine visite grâce à la sauvegarde locale.

## Lancer les sources

Avec **Node.js 22.13 ou plus récent** installé, depuis le dossier du projet :

```sh
npm ci
npm run dev
```

Ouvre l’adresse affichée dans le terminal. Aucun compte, serveur de données, clé API ni service externe n’est nécessaire au jeu.

## Un seul fichier pour jouer hors ligne

```sh
npm run build
```

Le dossier `dist/` contient deux versions :

- **`offline-play.html`** : copie ce seul fichier et ouvre-le dans un navigateur moderne. Le code, les styles, les icônes, l’atlas de la main et les courts extraits sonores sont embarqués.
- **`index.html` et les ressources de `dist/`** : version destinée à un hébergement statique. Envoie le contenu complet du dossier sur ton hébergement ; les chemins relatifs fonctionnent aussi dans un sous-dossier.

Pour vérifier la version compilée sur un serveur local :

```sh
npm run preview
```

La sauvegarde dépend du navigateur et de l’emplacement du jeu. En mode fichier local, certains navigateurs limitent le stockage ; le jeu reste jouable, mais la reprise persistante n’est alors pas garantie. Le son commence après la première action du joueur. Le plein écran et la voix italienne optionnelle dépendent également des capacités du navigateur.

## Dessin, main et son

Le personnage est redessiné en contours vectoriels, avec une marche faite de silhouettes successives. Les flexions, gestes des bras et poses d’attente suivent les références décrites dans [MOVEMENTS.md](docs/MOVEMENTS.md). Ses contours restent raccordés au terrain lorsqu’il marche ou se baisse ; une chute accidentelle reste possible.

La main utilise **quatre images successives d’une main réellement filmée**, extraites d’une séquence officielle de Quipos. Elles contiennent deux poses photographiques maintenues et représentent **0,16 seconde de source à 25 images par seconde**. Le jeu répète ce petit mouvement de poignet et déplace les images autour de la pointe du crayon. Les interventions plus longues réutilisent ces mêmes images ; le déplacement qui suit ton trait est programmé. Le détourage conserve les limites du poignet filmé, placées hors du cadre de la scène.

Le mode **Extraits originaux**, sélectionné par défaut, utilise **trois courts extraits, totalisant 2,68 secondes de bande sonore source**. Le son présent dans ces passages est conservé, accompagnement compris ; la conversion en mono et la lecture ne modifient pas leur hauteur. La bouche réagit à l’amplitude du son joué. Les réglages proposent aussi **Grammelot synthétique** et **Italien synthétique** ; ce dernier utilise une voix installée sur l’appareil. Les bruitages locaux restent distincts de ces enregistrements. Les sources, minutages et fichiers de provenance figurent dans [les crédits](CREDITS.md).

## Développer

```sh
npm run typecheck
npm test
npm run build
# ou les trois étapes :
npm run check
```

Les tests couvrent les constructions, les mécanismes, les collisions, la traversée sans saut, la posture baissée, les réactions, les points de reprise, la sauvegarde et la migration des touches personnalisées. Ils sont compilés dans un dossier temporaire puis exécutés par le runner de tests de Node ; aucun navigateur ni service distant n’est requis pour ces tests.

| Fichier ou dossier | Rôle |
| --- | --- |
| `app/page.tsx` | Interface, entrées, caméra et boucle de jeu |
| `app/globals.css` | Présentation responsive et menus mobiles |
| `lib/trait/platformer.ts` | Simulation et collisions |
| `lib/trait/platform-drawing.ts` | Validation du trait libre |
| `lib/trait/platform-mechanisms.ts` | Objets manipulables et déplacements |
| `lib/trait/platform-renderer.ts` | Terrain, objets, effets et personnage |
| `lib/trait/cartoon-character.ts` / `companion.ts` | Silhouettes et réactions |
| `lib/trait/audio.ts` / `hand.ts` | Lecture des réactions, bruitages et main animée |
| `lib/trait/controls.ts` / `progress.ts` | Touches et sauvegarde |
| `components/trait/` | Configuration des commandes |
| `public/original-*-manifest.json` | Provenance et repères des médias originaux sélectionnés |
| `scripts/public-*` | Entrée React et compilation autonome |

Le workflow « Vérification du jeu » vérifie les types, exécute les tests et fournit le build comme artefact téléchargeable. Le workflow « Publication linea.estrasse.fr » met le site en ligne sur https://linea.estrasse.fr à chaque push sur `main` : voir [deploy/README.md](deploy/README.md).

Les détails de compilation sont dans [BUILD.md](docs/BUILD.md). Les références artistiques et les notices des dépendances sont dans [CREDITS.md](CREDITS.md) et [THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md).
