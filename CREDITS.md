# Crédits, médias et références — version 1.2.0

## L’œuvre de référence

**La Linea** est une création d’**Osvaldo Cavandoli**. La voix du personnage original est celle de **Carlo Bonomi** ; la musique des épisodes est associée à **Franco Godi**. Le site consacré à Cavandoli et à son œuvre par sa famille présente le trait continu, l’intervention de sa main filmée et le grammelot du personnage :

- [Osvaldo Cavandoli — I Serial](https://osvaldocavandoli.com/i-serial/)
- [Osvaldo Cavandoli — Processo creativo](https://osvaldocavandoli.com/processo-creativo/)
- [Quipos — La Linea](https://www.quipos.net/en/animations/la-linea/)
- [Épisode indiqué comme référence initiale](https://www.youtube.com/watch?v=qXr2DUwI6UQ)
- [Lien complémentaire fourni par le joueur](https://youtu.be/8IHHHXIzDpA)

**Un seul trait est un projet de fan non officiel**, sans affiliation ni approbation annoncée des ayants droit. La version 1.2.0 comprend les courts médias originaux identifiés ci-dessous. Les droits sur La Linea, son personnage, ses images et sa bande sonore restent ceux de leurs ayants droit. Cette notice fournit l’attribution et la provenance ; **elle n’accorde aucune licence d’exploitation de ces médias**. La publication du code ne concède pas de droits supplémentaires sur l’œuvre d’origine.

## Main filmée : extrait officiel de la série 100

| Élément | Provenance et préparation |
| --- | --- |
| Ressource du jeu | [`public/original-hand-atlas.webp`](public/original-hand-atlas.webp) |
| Manifeste | [`public/original-hand-manifest.json`](public/original-hand-manifest.json) |
| Page de provenance | [Quipos — La Linea](https://www.quipos.net/en/animations/la-linea/) |
| Fichier source | [Linea-serie-100.flv](https://www.quipos.net/custom/video/Linea-serie-100.flv) |
| Plage retenue | **1,32 s incluse à 1,48 s exclue** |
| Images et durée | **Quatre images successives à 25 images/s**, soit **0,16 s** de source ; deux poses photographiques maintenues |
| Atlas | **1 216 × 304 px**, une rangée de quatre cellules de **304 × 304 px** |
| Pointe du crayon | Ancre **(16, 16)** dans chaque cellule |

Les images proviennent de la main réellement filmée dans l’extrait. Le détourage crée la transparence et la stabilisation aligne la pointe du crayon ; les couleurs proviennent des pixels décodés de la source. La préparation n’ajoute ni images générées ni prolongement inventé du bras.

La source est une vidéo compressée de **480 × 360 pixels**. L’agrandissement conserve la douceur de cette source. Le poignet est coupé en bas et sur un court segment du bord inférieur droit de l’image d’origine : le manifeste repère ces coupures, que le rendu place hors du Canvas. Le jeu réutilise le petit mouvement de poignet et programme la translation des images pour suivre les interactions. Une intervention plus longue à l’écran ne constitue pas une séquence originale plus longue ni une nouvelle prise de vues.

## Trois courts extraits sonores originaux

Les trois sélections sont réunies dans [`public/original-voice.wav`](public/original-voice.wav). Leur provenance, leurs positions dans le fichier et son empreinte sont enregistrées dans [`public/original-voice-manifest.json`](public/original-voice-manifest.json).

| Repère | Source officielle | Plage dans la source | Durée source | Début dans le WAV du jeu |
| --- | --- | --- | --- | --- |
| `reaction-a` | [Série 100](https://www.quipos.net/custom/video/Linea-serie-100.flv) | 3,96–5,14 s | 1,18 s | 0,00 s |
| `reaction-b` | [Série 200](https://www.quipos.net/custom/video/Linea-serie-200.flv) | 5,44–6,28 s | 0,84 s | 1,30 s |
| `reaction-c` | [Série 200](https://www.quipos.net/custom/video/Linea-serie-200.flv) | 6,40–7,06 s | 0,66 s | 2,26 s |

**Total de son source : 2,68 secondes.** Le WAV PCM 16 bits mono à 44 100 Hz dure **2,92 secondes**, avec deux séparations silencieuses de 0,12 seconde. La piste stéréo d’origine a été convertie en mono. Il n’y a pas de modification de hauteur, de synthèse ajoutée à ces extraits ni de séparation de la voix : **la bande sonore d’origine est conservée, avec tout accompagnement présent**.

La préparation a contrôlé les formats, durées et repères ; le contenu n’a pas été validé à l’écoute par les outils d’étude. Ces extraits sont crédités comme des sélections de la bande sonore originale, sans les présenter comme une voix isolée ou une piste dépourvue de musique.

## Dessins du jeu et références d’étude

Le code, les parcours, les interactions et les contours vectoriels du personnage sont réalisés pour ce projet. La marche, la flexion et les réactions adaptent les références à une expérience interactive **sans saut**. La planche fournie par le joueur et les extraits officiels de Quipos ont servi à cette étude ; les observations sont décrites dans [MOVEMENTS.md](docs/MOVEMENTS.md).

Le lecteur du lien YouTube complémentaire est resté bloqué au chargement pendant l’étude ; aucune observation de son animation n’est revendiquée. Les séquences officielles effectivement examinées constituent les références de mouvement et les sources des médias sélectionnés. Les vidéos complètes et les planches de travail ne sont pas fournies avec le jeu.

Les pas, le bruit du crayon et les autres effets locaux restent distincts des trois enregistrements. Le mode **Extraits originaux** est sélectionné par défaut. Les options **Grammelot synthétique** et **Italien synthétique** produisent des réactions distinctes ; la seconde utilise une voix installée sur l’appareil. Ces sons générés ne sont pas des enregistrements de Carlo Bonomi. Les icônes d’interface proviennent de **Lucide**.

## Logiciels

Le jeu utilise React, React DOM et Lucide React. Sa compilation autonome utilise Vite, le plugin React de Vite, TypeScript et Tailwind CSS. Ces dépendances conservent leurs licences respectives ; les notices des bibliothèques intégrées au navigateur figurent dans [THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md) et sont incluses dans le fichier hors ligne.
