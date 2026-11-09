# Mouvement, main et références visuelles

## Références examinées

La planche de poses fournie par le joueur sert de référence de silhouette. L’étude du mouvement utilise les extraits des séries 100 et 200 intégrés à la [page officielle de Quipos](https://www.quipos.net/en/animations/la-linea/). Les temps ci-dessous sont ceux de ces extraits, **pas ceux de YouTube**.

| Extrait | Images examinées | Observation retenue |
| --- | --- | --- |
| Série 100 | 9,28 / 9,36 / 9,44 / 9,52 s | Quatre poses de marche avant, chacune tenue deux images à 25 images/s ; ces dessins restent dans leur ordre chronologique. |
| Série 100 | 9,60 à 11,80 s | Les bords du corps forment alternativement des genoux anguleux et des pointes de pied, en restant raccordés au sol. |
| Série 100 | 10,40 à 10,60 s | Le profil de tête se retourne. Ce regard en arrière ne doit pas inverser la direction attribuée à la marche. |
| Série 200 | 3,60 à 4,80 s | Grandes paumes ouvertes, bras écartés et inclinaison du buste. |
| Série 200 | 5,20 à 7,20 s | Protestation avec les mains près de la tête, poings et changements d’ouverture de bouche. |
| Série 100 | 18 à 22,40 s | Attente aux hanches, demande avec une paume levée, flexion et bras tendus. |

Le [site consacré à Cavandoli](https://osvaldocavandoli.com/i-serial/) décrit le personnage comme une partie du trait : il marche, rencontre un obstacle et interpelle la main qui complète le décor. Il présente sa voix comme du grammelot.

Le [lien complémentaire demandé](https://youtu.be/8IHHHXIzDpA) a été ouvert, mais son lecteur est resté bloqué au chargement dans l’environnement de travail. Aucun mouvement ne lui est attribué ici. Les observations proviennent de la planche jointe et des extraits officiels effectivement examinés. Les vidéos d’étude complètes et leurs planches restent hors du jeu ; les courts médias originaux sélectionnés pour la version 1.3.0 sont identifiés dans [CREDITS.md](../CREDITS.md).

## Traduction dans le personnage jouable

- **Marche** : succession de silhouettes, jambes ouvertes dans le contour, pieds sans chaussures indépendantes. La silhouette entière est reflétée pour changer de sens et l’orientation suit le déplacement réel. La cadence du jeu est liée à la distance parcourue ; la vitesse de translation est un choix de jouabilité.
- **Repos** : corps prolongé dans la ligne, sans rebond permanent. La tête et le gros nez forment une boucle oblongue ; la bouche est une encoche dans le contour, sans œil séparé ajouté.
- **Flexion** : commande maintenue au clavier ou posture tactile abaissée avec ↓ puis redressée avec ↑, jambes pliées, buste abaissé, bras devant et petits pas. Cette posture permet de passer sous les obstacles bas. Le personnage reste baissé si le plafond empêche de se relever ; ses réactions ne redressent pas le corps sous cet obstacle.
- **Réactions** : regard vers le passage, paume levée, bras ouverts, doigt qui montre, mains aux hanches, poings, protestation et remerciement. Les dessins sont retenus pendant de courts temps lisibles ; les gestes ne commandent pas le déplacement à la place du joueur.
- **Parcours** : aucun saut commandé ou automatique. Les passages et les étoiles sont accessibles à pied grâce aux traits dessinés, aux plateformes mobiles et aux poignées. Le personnage attend devant un passage inachevé. Les chutes accidentelles et les collisions avec les dangers restent possibles.

La suppression du saut est un choix du jeu demandé par le joueur. Cette étude de séquences ne constitue pas un inventaire exhaustif de tous les épisodes. La posture basse jouable, les transitions, les obstacles et les déclenchements émotionnels restent des adaptations interactives.

## Main photographique et voix de la version 1.3.0

La main précédente, issue d’une source vidéo 480 × 360 px, est remplacée à la demande du joueur par une **image générée au rendu photographique**. L’asset mesure réellement **941 × 1 672 px** et conserve une transparence alpha; ce n’est pas une prise de vues du film ni une image 4K native. Le [manifeste de la main](../public/drawing-hand-hd-manifest.json) donne la provenance, le prompt exact et l’ancre du crayon **(41, 226)**.

La pointe suit exactement le geste. Le poignet tourne légèrement mais la taille et le côté de la main restent stables pendant une interaction. Le long avant-bras remplace l’ancien agrandissement dépendant de la hauteur du viewport, qui donnait une main disproportionnée sur téléphone.

Les **16 réactions originales** totalisent **11,42 secondes de bande sonore source**. Leurs hauteurs et vitesses restent inchangées; leur accompagnement est conservé. Les prises sont choisies selon le contexte, avec exclusion des cinq dernières, pour éviter une boucle de trois sons. La bouche suit l’amplitude du fragment effectivement joué. Les minutages, sources et limites de validation sont détaillés dans [CREDITS.md](../CREDITS.md) et le [manifeste audio](../public/original-voice-manifest.json).

Les protestations sont maintenant de petites scènes de plusieurs poses : observation du manque, regard vers le dessinateur, appel, doigt qui montre, paumes ouvertes, écoute, colère ou mains aux hanches. Trois variantes alternent les prises et les silences. Les remerciements et réactions au toucher varient aussi. Marche, flexion, chute et dessin interrompent la scène sans reprise retardée. Aucun geste ne modifie la physique ou les commandes.

## Geste direct et présentation mobile

La construction commence en posant le crayon sur **A ou B**, puis en traçant jusqu’à l’autre ancre. Le dessin direct à la souris ou au doigt n’exige pas E ; ce raccourci reste disponible pour ouvrir le mode dessin au clavier. La validation conserve le trait fourni par le joueur et accepte les deux sens du tracé.

En portrait comme en paysage, les flèches occupent la zone du pouce gauche ; baisser et se redresser sont à droite. Les poignées se saisissent directement dans la scène, sans bouton de déplacement automatique. La scène occupe toute la fenêtre, les commandes flottent dans les coins, les menus défilent séparément et les réglages restent accessibles. La caméra réserve une marge sous le sol pour que les pouces ne cachent pas le passage. Le changement de présentation ne modifie ni les collisions ni le sens de la marche. Les commandes personnalisées conservent deux emplacements de touche par action.

## Vérification

Les tests contrôlent aussi le défilement sans retour en arrière à la validation d’un pont, la stabilité du cadrage sous le pointeur et les réactions des oiseaux. Ils vérifient l’absence d’impulsion de saut, la flexion sous un obstacle, les limites des mécanismes, la migration des anciennes touches et la traversée des six parcours avec leurs dangers actifs. Ils contrôlent également la priorité du mouvement sur les gestes, les raccords des poses basses au sol et la détection de la tête lorsque le personnage est accroupi.

La validation dans le navigateur porte sur les raccords, l’orientation, la lisibilité des poses, le dessin dans les deux sens et les interfaces portrait/paysage. L’examen visuel des images de la main ne constitue pas une écoute des extraits sonores. Les comptes rendus de validation de la version figurent dans les notes de publication.
