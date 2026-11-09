# Un seul trait

**Dessine le passage. Attrape le décor. Avance avec un petit personnage qui a son caractère.**

Une aventure de dessin en français, inspirée de *La Linea* d’Osvaldo Cavandoli. La version **1.3.0** occupe toute la fenêtre : scène continue, commandes intégrées dans les coins, caméra fluide, gestes et disputes, oiseaux et mécanismes à déplacer à la main.

**Projet de fan non officiel.** Le personnage est redessiné en contours vectoriels; la main est une image générée au rendu photographique. La voix utilise 16 très courts fragments originaux. Les origines exactes, traitements et limites sont dans [CREDITS.md](CREDITS.md).

## Jouer sans compiler

Télécharge **Un-seul-trait-1.3.0.html** dans [la version publiée](https://github.com/M4D135/Un-seul-trait/releases/latest), puis ouvre-le dans un navigateur moderne. Le fichier contient tout le jeu, la main, les sons et les styles. Le ZIP fournit aussi le dossier de production prêt à héberger.

## Un geste pour dessiner, un geste pour déplacer

Approche un passage manquant : les ancres **A et B** apparaissent. Pose le doigt ou la souris sur l’une, trace jusqu’à l’autre puis relâche. Le terrain suit ton dessin. Les deux sens fonctionnent, **A → B** et **B → A**, sans appuyer sur E. Tu peux effacer un essai ou redessiner un passage; l’ancien pont reste praticable tant que son remplacement n’est pas validé.

Pour refaire un passage dont l’autre ancre est hors champ, utilise le petit crayon contextuel **Redessiner** : il cadre les deux points avant le geste. **E** reste un raccourci facultatif pour ouvrir le dessin.

Attrape directement les **poignées dorées** et fais-les glisser : porte, presse, roue, plateforme ou ascenseur. Relâcher arrête le déplacement. Il n’y a plus de bouton qui déplace automatiquement un mécanisme à l’autre bout. Monte sur un plateau puis entraîne sa poignée pour transporter le personnage. Tu peux marcher pendant que l’autre doigt tient un objet.

## Commandes intégrées

Sur mobile, **← →** occupent le coin inférieur gauche. Au coin inférieur droit, **↓** maintient la posture basse et **↑** demande de se redresser. Le personnage attend d’avoir la place sous un obstacle avant de se relever. Le jeu reste **sans saut**.

| Action | Touches par défaut |
| --- | --- |
| Aller à gauche | ← ou Q |
| Aller à droite | → ou D |
| Se baisser au clavier | ↓ ou S, maintenir |
| Se redresser | ↑ ou Z |
| Ouvrir le dessin, facultatif | E |
| Pause / reprendre | P ou Échap |
| Revenir au dernier drapeau | R |

Le menu **Commandes** propose **deux touches par action** et empêche les doublons. Les commandes personnalisées sont conservées. Le jeu utilise toute la fenêtre; un bouton plein écran permet aussi de demander au navigateur de masquer son interface. Les menus restent accessibles par-dessus la scène.

## Six parcours vivants

Dix-huit passages sont dessinés par le joueur. Des roues, scies, piques, pendules, portes et presses demandent d’observer et de manipuler le décor. Des passeurs et ascenseurs transportent réellement les pieds du personnage. Des oiseaux se posent sur la ligne, regardent, s’envolent à l’approche et reviennent après un délai.

Le personnage regarde le problème, appelle le dessinateur, montre le passage et proteste par petites séquences variées. Les gestes cèdent immédiatement à la marche, à la flexion et aux chutes. Les 16 réactions originales sont choisies par contexte sans répéter les cinq dernières prises; la bouche suit le son effectivement lu.

La caméra suit le déplacement sans recentrer les ponts déjà construits. Elle prépare les points d’un passage manquant et reste exactement fixe pendant le dessin. Les commandes flottent sur le décor, avec une marge de cadrage pour ne pas cacher le trait sous les pouces.

Les drapeaux servent de points de reprise. Les dessins validés, étoiles et mécanismes sont sauvegardés dans le navigateur. Le retour après une chute ou un rechargement reprend au dernier drapeau. Les éclaboussures rouges peuvent être remplacées par des particules blanches dans les réglages.

## Sources et développement

Avec Node.js **22.13 ou plus récent** :

```sh
npm ci
npm run dev
```

```sh
npm run typecheck
npm test
npm run build
# ou les trois étapes :
npm run check
```

Le build génère `dist/index.html` et `dist/offline-play.html`. Aucun compte, clé API ou service distant n’est nécessaire au fonctionnement du jeu compilé. Le son est débloqué par une première interaction du joueur. Le mode italien synthétique dépend des voix installées; il reste séparé des extraits originaux.

| Fichier ou dossier | Rôle |
| --- | --- |
| `app/page.tsx` / `app/globals.css` | Interface plein écran, menus et entrées tactiles/clavier |
| `lib/trait/camera.ts` | Suivi continu et cadrage des gestes |
| `lib/trait/platformer.ts` / `platform-mechanisms.ts` | Simulation, collisions et mécanismes manuels |
| `lib/trait/platform-levels.ts` | Parcours, ascenseurs, obstacles et points de reprise |
| `lib/trait/platform-renderer.ts` | Terrain, dangers, poignées et raccords au personnage |
| `lib/trait/cartoon-character.ts` / `companion.ts` | Silhouettes et petites scènes gestuelles |
| `lib/trait/ambient-life.ts` | Oiseaux et détails du décor |
| `lib/trait/audio.ts` / `original-media.ts` | Voix originales, sélection et synchronisation de la bouche |
| `lib/trait/hand.ts` | Main photographique ancrée au crayon |
| `lib/trait/controls.ts` / `progress.ts` | Configuration et sauvegardes |
| `public/*-manifest.json` | Provenance des médias et définition réelle de la main |

Les tests couvrent les gestes directs, la caméra, les mécanismes, les collisions, les trajets sans saut, les réactions, les oiseaux, la sauvegarde, la migration des touches et l’annulation des voix. Ils ne remplacent pas une écoute humaine ni un essai sur chaque appareil mobile.

Le workflow **Vérification du jeu** contrôle les types, les tests et le build. Le workflow **Publication linea.estrasse.fr** met le site en ligne sur https://linea.estrasse.fr à chaque push sur `main` : voir [deploy/README.md](deploy/README.md).

Les détails de compilation figurent dans [BUILD.md](docs/BUILD.md); les références artistiques et les notices dans [CREDITS.md](CREDITS.md), [MOVEMENTS.md](docs/MOVEMENTS.md) et [THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md).
