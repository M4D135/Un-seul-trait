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

Le [lien complémentaire demandé](https://youtu.be/8IHHHXIzDpA) a été ouvert, mais son lecteur est resté bloqué au chargement dans l’environnement de travail. Aucun mouvement ne lui est attribué ici. Les observations proviennent de la planche jointe et des extraits officiels effectivement examinés. Les vidéos d’étude complètes et leurs planches restent hors du jeu ; les courts médias originaux sélectionnés pour la version 1.2.0 sont identifiés dans [CREDITS.md](../CREDITS.md).

## Traduction dans le personnage jouable

- **Marche** : succession de silhouettes, jambes ouvertes dans le contour, pieds sans chaussures indépendantes. La silhouette entière est reflétée pour changer de sens et l’orientation suit le déplacement réel. La cadence du jeu est liée à la distance parcourue ; la vitesse de translation est un choix de jouabilité.
- **Repos** : corps prolongé dans la ligne, sans rebond permanent. La tête et le gros nez forment une boucle oblongue ; la bouche est une encoche dans le contour, sans œil séparé ajouté.
- **Flexion** : commande maintenue, jambes pliées, buste abaissé, bras devant et petits pas. Cette posture permet de passer sous les obstacles bas. Le personnage reste baissé si le plafond empêche de se relever ; ses réactions ne redressent pas le corps sous cet obstacle.
- **Réactions** : regard vers le passage, paume levée, bras ouverts, doigt qui montre, mains aux hanches, poings, protestation et remerciement. Les dessins sont retenus pendant de courts temps lisibles ; les gestes ne commandent pas le déplacement à la place du joueur.
- **Parcours** : aucun saut commandé ou automatique. Les passages et les étoiles sont accessibles à pied grâce aux traits dessinés, aux plateformes mobiles et aux poignées. Le personnage attend devant un passage inachevé. Les chutes accidentelles et les collisions avec les dangers restent possibles.

La suppression du saut est un choix du jeu demandé par le joueur. Cette étude de séquences ne constitue pas un inventaire exhaustif de tous les épisodes. La posture basse jouable, les transitions, les obstacles et les déclenchements émotionnels restent des adaptations interactives.

## Main filmée de la version 1.2.0

La main est préparée à partir de **quatre images successives de l’extrait officiel 100, entre 1,32 s incluse et 1,48 s exclue**. Cette plage représente **0,16 seconde à 25 images/s**, avec deux poses photographiques maintenues. Le détourage et la stabilisation alignent la pointe du crayon ; le manifeste [`original-hand-manifest.json`](../public/original-hand-manifest.json) indique chaque image source, sa cellule dans l’atlas et les limites du poignet coupées par le cadrage.

Le jeu utilise ces images pour un petit mouvement de poignet répété autour du point d’interaction. La pointe suit le geste du joueur. Le mouvement photographié vient de cette seule plage ; le déplacement dans le décor et la répétition des poses sont pilotés par le jeu. Les coupures du poignet en bas et sur le bord inférieur droit doivent sortir du Canvas. La définition et la compression de la source limitent la netteté lors des agrandissements.

Les trois réactions audio sélectionnées totalisent **2,68 secondes de bande sonore originale**. Leur hauteur n’est pas modifiée et leur accompagnement d’origine est conservé. En mode **Extraits originaux**, sélectionné par défaut, l’ouverture de la bouche suit l’amplitude mesurée du son joué ; elle ne constitue pas une animation phonétique reconstruite. Les modes synthétiques restent des options distinctes. Les minutages, durées et traitements sont détaillés dans [CREDITS.md](../CREDITS.md) et [`original-voice-manifest.json`](../public/original-voice-manifest.json).

## Geste direct et présentation mobile

La construction commence en posant le crayon sur **A ou B**, puis en traçant jusqu’à l’autre ancre. Le dessin direct à la souris ou au doigt n’exige pas E ; ce raccourci reste disponible pour ouvrir le mode dessin au clavier. La validation conserve le trait fourni par le joueur et accepte les deux sens du tracé.

En portrait comme en paysage, les flèches occupent la zone du pouce gauche ; la flexion et la manipulation sont à droite. La scène et les commandes restent dans le viewport, les menus défilent séparément et les réglages restent accessibles. Le changement de présentation ne modifie ni les collisions ni le sens de la marche. Les commandes personnalisées conservent deux emplacements de touche par action.

## Vérification

Les tests vérifient l’absence d’impulsion de saut, la flexion sous un obstacle, les limites des mécanismes, la migration des anciennes touches et la traversée des six parcours avec leurs dangers actifs. Ils contrôlent également la priorité du mouvement sur les gestes, les raccords des poses basses au sol et la détection de la tête lorsque le personnage est accroupi.

La validation dans le navigateur porte sur les raccords, l’orientation, la lisibilité des poses, le dessin dans les deux sens et les interfaces portrait/paysage. L’examen visuel des images de la main ne constitue pas une écoute des extraits sonores. Les comptes rendus de validation de la version figurent dans les notes de publication.
