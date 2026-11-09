# Crédits, médias et références — version 1.5.0

## L’œuvre de référence

**La Linea** est une création d’**Osvaldo Cavandoli**. Le personnage est interprété par **Carlo Bonomi**, dans un grammelot aux sonorités italiennes; les musiques sont associées à **Franco Godi**. Le site consacré à Cavandoli décrit le personnage intégré au trait, la main du dessinateur et les échanges gestuels :

- [Osvaldo Cavandoli — I Serial](https://osvaldocavandoli.com/i-serial/)
- [Quipos — La Linea](https://www.quipos.net/en/animations/la-linea/)
- [Référence initiale du joueur](https://www.youtube.com/watch?v=qXr2DUwI6UQ)
- [Référence complémentaire du joueur](https://youtu.be/8IHHHXIzDpA)

**Un seul trait est un projet de fan non officiel**, sans affiliation ou approbation annoncée des ayants droit. L’œuvre, le personnage et les enregistrements originaux conservent leurs droits respectifs. Cette attribution et les manifestes de provenance ne constituent pas une licence d’exploitation supplémentaire.

## Main photographique générée

La main de la version 1.3 remplace le petit atlas vidéo de la version 1.2. Elle est une **image générée au rendu photographique**, retravaillée à partir de la main de la version 1.1 préférée par le joueur. Ce n’est pas une nouvelle prise de vues d’Osvaldo Cavandoli ni une image extraite du dessin animé.

| Élément | Valeur |
| --- | --- |
| Ressource | [`public/drawing-hand-hd.webp`](public/drawing-hand-hd.webp) |
| Provenance et prompt exact | [`public/drawing-hand-hd-manifest.json`](public/drawing-hand-hd-manifest.json) |
| Définition réelle | **941 × 1 672 pixels** |
| Format | WebP sans perte, transparence alpha |
| Pointe du crayon | **(41, 226)** dans l’image |
| Animation | Déplacement ancré au pointeur, rotation du poignet, entrée et retrait programmés |

Le bras est assez long pour quitter le bas de la scène. La taille de la main reste constante pendant un geste; la hauteur du téléphone ne provoque plus un agrandissement excessif. La pointe colle exactement au trait, sans retard de suivi. **Le fichier n’est pas une image 4K native** et n’a pas été agrandi pour le présenter comme tel. Le générateur intégré Imagegen a produit l’image; la conversion en WebP conserve les pixels et l’alpha de ce résultat.

## Seize réactions sonores originales

Le fichier [`public/original-voice.wav`](public/original-voice.wav) réunit **16 fragments courts de bande sonore originale**, issus des deux extraits officiels présentés par Quipos. Ils durent chacun **0,58 à 0,98 seconde**, pour **11,42 secondes de source**, ou **13,22 secondes avec les séparations silencieuses**. Le format est PCM 16 bits, mono, 44 100 Hz.

| Repère | Série Quipos | Plage dans la source | Durée |
| --- | --- | --- | --- |
| `reaction-01` | 100 | 3.96–4.94 s | 0.98 s |
| `reaction-02` | 100 | 6.28–7.04 s | 0.76 s |
| `reaction-03` | 100 | 18.66–19.26 s | 0.60 s |
| `reaction-04` | 100 | 19.78–20.56 s | 0.78 s |
| `reaction-05` | 100 | 21.86–22.70 s | 0.84 s |
| `reaction-06` | 100 | 38.00–38.68 s | 0.68 s |
| `reaction-07` | 200 | 2.94–3.58 s | 0.64 s |
| `reaction-08` | 200 | 3.92–4.56 s | 0.64 s |
| `reaction-09` | 200 | 4.78–5.36 s | 0.58 s |
| `reaction-10` | 200 | 5.44–6.28 s | 0.84 s |
| `reaction-11` | 200 | 6.40–7.06 s | 0.66 s |
| `reaction-12` | 200 | 21.50–22.16 s | 0.66 s |
| `reaction-13` | 200 | 22.56–23.20 s | 0.64 s |
| `reaction-14` | 200 | 31.82–32.58 s | 0.76 s |
| `reaction-15` | 200 | 39.20–39.78 s | 0.58 s |
| `reaction-16` | 200 | 40.20–40.98 s | 0.78 s |

Sources vidéo : [Série 100](https://www.quipos.net/custom/video/Linea-serie-100.flv) et [Série 200](https://www.quipos.net/custom/video/Linea-serie-200.flv). Le [manifeste audio](public/original-voice-manifest.json) fournit les URL, les empreintes des sources et des découpes PCM, les numéros d’échantillons, les positions dans le WAV et les contextes visuels utilisés.

La piste originale est convertie de stéréo en mono, sans changement de vitesse ou de hauteur. Les extraits conservent l’accompagnement présent dans leur bande sonore : ils ne sont pas présentés comme une voix isolée. De très courts fondus de gain de 3 et 6 ms évitent les clics de découpe à la lecture, sans altérer les échantillons archivés.

Le choix combine un sac mélangé par situation et une mémoire des **cinq dernières prises**, même après une pause. Une seule réaction parle à la fois. Les échanges comportent des répliques séparées par des pauses; la bouche suit l’amplitude mesurée du fragment réellement lu. La banque a été vérifiée par ses formats, durées, signaux et contextes gestuels visibles. **Aucune validation à l’écoute ni traduction émotionnelle certaine n’est revendiquée.**

**Extraits originaux** reste le mode par défaut. Les options **Grammelot synthétique** et **Italien synthétique** sont distinctes : ce ne sont pas des enregistrements de Carlo Bonomi. La seconde utilise les voix déjà installées sur l’appareil. Les pas, le crayon et les sons de jeu sont des effets locaux séparés.

## Bruitages locaux de la version 1.5.0

Les textures de pas, ailes, pépiements, frottements, butées et verrouillages sont synthétisées localement en PCM par `lib/trait/foley.ts`. Elles ne sont pas extraites du dessin animé ni présentées comme des enregistrements réels. Leur variation dépend des gestes et du déplacement des objets ; l’audibilité dépend du cadre et de la distance. Les tests vérifient leurs niveaux, fins silencieuses et interruptions ; aucune appréciation issue d’une écoute humaine n’est revendiquée.

## Dessins et adaptation interactive

Les contours vectoriels, parcours, oiseaux, obstacles, gestes et interactions sont réalisés pour le jeu. Ils adaptent la planche fournie par le joueur et les séquences officielles étudiées; voir [MOVEMENTS.md](docs/MOVEMENTS.md). Les petites scènes de dispute ne sont pas des extraits vidéo reproduits image par image. Elles sont interrompues par les commandes du joueur et n’exécutent aucun mouvement physique à sa place.

Le jeu reste **sans saut**, conformément à la demande du joueur; ce choix ne prétend pas inventorier tous les mouvements de tous les épisodes. Le lecteur du lien YouTube complémentaire est resté bloqué pendant l’étude précédente; les observations animées revendiquées portent sur les extraits officiels Quipos. Les épisodes complets et les planches de travail ne sont pas inclus dans le jeu.

## Logiciels

React, React DOM et Lucide React conservent leurs licences respectives. La compilation autonome utilise Vite, TypeScript et Tailwind CSS. Les [notices des dépendances](docs/THIRD-PARTY-NOTICES.md) sont également incluses dans le fichier hors ligne.
