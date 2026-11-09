# Un seul trait

**Dessine le passage. Attrape le décor. Avance avec un petit personnage qui a son caractère.**

Une aventure de dessin en français, inspirée de *La Linea* d’Osvaldo Cavandoli. La version **1.5.0** corrige les disparitions des oiseaux dans le champ, affine leur vol, ajoute des bruitages liés aux mouvements et retravaille les mécanismes du parcours. La scène occupe toute la fenêtre, avec caméra continue, commandes intégrées, gestes et disputes, et mécanismes à déplacer à la main.

**Projet de fan non officiel.** Le personnage est redessiné en contours vectoriels; la main est une image générée au rendu photographique. La voix utilise 16 très courts fragments originaux. Les origines exactes, traitements et limites sont dans [CREDITS.md](CREDITS.md).

## Jouer sans compiler

Télécharge **Un-seul-trait-1.5.0.html** dans [la version publiée](https://github.com/M4D135/Un-seul-trait/releases/latest), puis ouvre-le dans un navigateur moderne. Le fichier contient tout le jeu, la main, les sons et les styles. Le ZIP fournit aussi le dossier de production prêt à héberger.

## Un geste pour dessiner, un geste pour déplacer

Approche un passage manquant : les ancres **A et B** apparaissent. Pose le doigt ou la souris sur l’une et trace vers l’autre. Les deux sens fonctionnent, **A → B** et **B → A**, sans appuyer sur E. Si tu lèves le doigt avant l’arrivée, le brouillon reste en place : reprends sur son extrémité dorée pour continuer. Le passage devient praticable lorsque le trait rejoint l’autre ancre et que tu relâches.

La palette de dessin contient **Guide** pour afficher ou masquer le trajet indicatif, **Reculer** pour retirer la dernière portion, **Effacer** pour recommencer le brouillon et **Fermer** pour abandonner l’essai. Le guide ne construit rien. Un léger lissage atténue les tremblements du doigt en conservant les pentes et les courbes voulues. L’encre disponible laisse de la marge autour de chaque parcours ; si le détour est trop long, tu peux le raccourcir sans perdre le reste du brouillon.

Tu peux redessiner un passage déjà construit. L’ancien pont reste praticable tant que son remplacement n’est pas validé ; changer de choix, annuler un essai ou manquer le raccord ne le supprime pas. Le choix et le nouveau terrain ne sont enregistrés qu’à la validation.

Pour refaire un passage dont l’autre ancre est hors champ, utilise le petit crayon contextuel **Redessiner** : il cadre les deux points avant le geste. **E** reste un raccourci facultatif pour ouvrir le dessin.

Attrape directement les **poignées dorées** et fais-les glisser : porte, volet oblique, presse, roue, pont coulissant ou ascenseur. Relâcher arrête le déplacement. Il n’y a plus de bouton qui déplace automatiquement un mécanisme à l’autre bout. Monte sur un plateau puis entraîne sa poignée pour transporter le personnage. Tu peux marcher pendant que l’autre doigt tient un objet.

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

## Six parcours et neuf décisions de chemin

Dix-huit passages sont dessinés par le joueur. **Neuf de ces passages proposent deux choix, soit dix-huit variantes de parcours**. Les cartes permettent de préparer une solution ; tu dois ensuite dessiner toi-même le passage.

| Situation | Deux approches possibles |
| --- | --- |
| Roue dans une fosse | Tracer au-dessus, ou relever la roue et dessiner un pont bas |
| Roue suspendue | Passer en hauteur, ou rester baissé sur le chemin inférieur |
| Presse du raccourci | La soulever pour suivre le trajet court, ou dessiner une arche au-dessus |
| Étoile en hauteur | Construire le détour qui la rejoint, ou prendre le raccourci inférieur |

Ces choix modifient réellement le terrain, les manipulations nécessaires ou les étoiles accessibles. Les scies et les piques occupent des obstacles distincts ; les presses restent lisibles à côté des dangers mobiles. Le pont coulissant du chapitre 2 se déploie depuis sa rive ; on peut le préparer puis marcher dessus. Le volet du chapitre 5 se dégage le long d’une glissière oblique. Les ascenseurs transportent les pieds du personnage. Rails, roues, poulies et contrepoids suivent la position physique réelle, toujours sans saut.

## Un décor animé qui laisse respirer le jeu

Les oiseaux partagent une même silhouette articulée au sol et en vol. Ils observent, préparent le décollage, battent des ailes puis suivent des courbes avec accélération et freinage. Les ailes se replient pendant leur retour et s’étendent pour pousser ou planer ; la tête absorbe une partie de l’inclinaison du corps. Avant de se poser, ils relèvent les ailes, ouvrent la queue et tendent les pattes ; le corps amortit le contact avant de replier les ailes. Ils tournent la tête, clignent des yeux, picorent ou lissent leurs plumes pendant de longues pauses.

Les oiseaux restent dessinés tant que leur silhouette traverse le cadre. Une sortie est calculée avec les quatre bords réellement visibles, y compris dans les grands écrans portrait ; un vol est prolongé si la caméra le suit. Un retour part de la vraie position atteinte hors champ. Le rendu ne masque plus un oiseau parce que trois autres sont déjà visibles.

Les départs volontaires sont espacés et limités dans une même zone. Les oiseaux hors champ ne lancent pas de nouveaux vols décoratifs, et les trajets sont vérifiés contre les surfaces et les dangers. L’approche du personnage ou un toucher peut déclencher leur fuite. Les animations décoratives n’interviennent pas dans les collisions du personnage.

Les pas, battements d’ailes et frottements utilisent des textures locales variées. Les petits appels des oiseaux sont espacés et liés à une réaction. Une poignée produit un frottement quand elle se déplace, puis un impact amorti en butée. L’intensité dépend de la proximité et les sons de décor s’arrêtent hors cadre ou en pause. Les voix originales restent distinctes de ces bruitages.

Le personnage regarde le problème, appelle le dessinateur, montre le passage et proteste par petites séquences variées. Les gestes cèdent immédiatement à la marche, à la flexion et aux chutes. Les 16 réactions originales sont choisies par contexte sans répéter les cinq dernières prises; la bouche suit le son effectivement lu.

La caméra suit le déplacement sans recentrer les ponts déjà construits. Elle prépare les points d’un passage manquant et reste exactement fixe pendant le dessin. Les commandes flottent sur le décor, avec une marge de cadrage pour ne pas cacher le trait sous les pouces.

Les drapeaux servent de points de reprise. Les dessins validés, leurs choix de parcours, les étoiles et les mécanismes sont sauvegardés dans le navigateur. Le retour après une chute ou un rechargement reprend au dernier drapeau. Les ponts des anciennes sauvegardes restent conservés. Les éclaboussures rouges peuvent être remplacées par des particules blanches dans les réglages.

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
| `lib/trait/platform-drawing.ts` / `components/trait/drawing-palette.tsx` | Tracé libre, lissage, choix de chemin, guide et outils de reprise |
| `lib/trait/platform-levels.ts` | Parcours, ascenseurs, obstacles et points de reprise |
| `lib/trait/platform-renderer.ts` | Terrain, dangers, poignées et raccords au personnage |
| `lib/trait/cartoon-character.ts` / `companion.ts` | Silhouettes et petites scènes gestuelles |
| `lib/trait/ambient-life.ts` / `ambient-bird-renderer.ts` | Comportements, trajectoires et silhouettes articulées des oiseaux |
| `lib/trait/audio.ts` / `original-media.ts` | Voix originales, sélection et synchronisation de la bouche |
| `lib/trait/foley.ts` | Bruitages locaux, cycles d’ailes, distance et déplacement des mécanismes |
| `lib/trait/hand.ts` | Main photographique ancrée au crayon |
| `lib/trait/controls.ts` / `progress.ts` | Configuration et sauvegardes |
| `public/*-manifest.json` | Provenance des médias et définition réelle de la main |

Les tests couvrent les gestes directs, la caméra, les mécanismes, les collisions, les trajets sans saut, les réactions, les oiseaux, la sauvegarde, la migration des touches et l’annulation des voix. Les contrôles des oiseaux suivent leur présence jusqu’à la sortie complète, les retours, la caméra, le portrait et les changements de préférence. Les contrôles audio vérifient les signaux, le silence au repos et les interruptions. Les contrôles ajoutés pour les chemins vérifient la reprise du trait dans les deux sens, l’annulation partielle, le respect de l’encre et les conséquences physiques de chaque variante. Ils ne remplacent pas une écoute humaine ni un essai sur chaque appareil mobile.

Le workflow **Vérification du jeu** contrôle les types, les tests et le build. Le workflow **Publication linea.estrasse.fr** compile et publie la branche `site` à chaque push sur `main`. Le service de mise à jour du serveur récupère ensuite cette branche pour https://linea.estrasse.fr : voir [deploy/README.md](deploy/README.md).

Les détails de compilation figurent dans [BUILD.md](docs/BUILD.md); les références artistiques et les notices dans [CREDITS.md](CREDITS.md), [MOVEMENTS.md](docs/MOVEMENTS.md) et [THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md).
