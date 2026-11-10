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

Le [lien complémentaire demandé](https://youtu.be/8IHHHXIzDpA) a été ouvert, mais son lecteur est resté bloqué au chargement dans l’environnement de travail. Aucun mouvement ne lui est attribué ici. Les observations proviennent de la planche jointe et des extraits officiels effectivement examinés. Les vidéos d’étude complètes et leurs planches restent hors du jeu ; les courts médias originaux introduits en version 1.3.0 et conservés en 1.6.1 sont identifiés dans [CREDITS.md](../CREDITS.md).

## Traduction dans le personnage jouable

- **Marche** : succession de silhouettes, jambes ouvertes dans le contour, pieds sans chaussures indépendantes. La silhouette entière est reflétée pour changer de sens et l’orientation suit le déplacement réel. La cadence du jeu est liée à la distance parcourue ; la vitesse de translation est un choix de jouabilité.
- **Repos** : corps prolongé dans la ligne, sans rebond permanent. La tête et le gros nez forment une boucle oblongue ; la bouche est une encoche dans le contour, sans œil séparé ajouté.
- **Flexion** : commande maintenue au clavier ou posture tactile abaissée avec ↓ puis redressée avec ↑, jambes pliées, buste abaissé, bras devant et petits pas. Cette posture permet de passer sous les obstacles bas. Le personnage reste baissé si le plafond empêche de se relever ; ses réactions ne redressent pas le corps sous cet obstacle.
- **Réactions** : regard vers le passage, paume levée, bras ouverts, doigt qui montre, mains aux hanches, poings, protestation et remerciement. Les dessins sont retenus pendant de courts temps lisibles ; les gestes ne commandent pas le déplacement à la place du joueur.
- **Parcours** : aucun saut commandé ou automatique. Les passages et les étoiles sont accessibles à pied grâce aux traits dessinés, aux plateformes mobiles et aux poignées. Le personnage attend devant un passage inachevé. Les chutes accidentelles et les collisions avec les dangers restent possibles.

La suppression du saut est un choix du jeu demandé par le joueur. Cette étude de séquences ne constitue pas un inventaire exhaustif de tous les épisodes. La posture basse jouable, les transitions, les obstacles et les déclenchements émotionnels restent des adaptations interactives.

## Main photographique et voix introduites en version 1.3.0

La main précédente, issue d’une source vidéo 480 × 360 px, est remplacée à la demande du joueur par une **image générée au rendu photographique**. L’asset mesure réellement **941 × 1 672 px** et conserve une transparence alpha; ce n’est pas une prise de vues du film ni une image 4K native. Le [manifeste de la main](../public/drawing-hand-hd-manifest.json) donne la provenance, le prompt exact et l’ancre du crayon **(41, 226)**.

La pointe suit exactement le geste. Le poignet tourne légèrement mais la taille et le côté de la main restent stables pendant une interaction. Le long avant-bras remplace l’ancien agrandissement dépendant de la hauteur du viewport, qui donnait une main disproportionnée sur téléphone.

Les **16 réactions originales** totalisent **11,42 secondes de bande sonore source**. Leurs hauteurs et vitesses restent inchangées; leur accompagnement est conservé. Les prises sont choisies selon le contexte, avec exclusion des cinq dernières, pour éviter une boucle de trois sons. La bouche suit l’amplitude du fragment effectivement joué. Les minutages, sources et limites de validation sont détaillés dans [CREDITS.md](../CREDITS.md) et le [manifeste audio](../public/original-voice-manifest.json).

Les protestations sont maintenant de petites scènes de plusieurs poses : observation du manque, regard vers le dessinateur, appel, doigt qui montre, paumes ouvertes, écoute, colère ou mains aux hanches. Trois variantes alternent les prises et les silences. Les remerciements et réactions au toucher varient aussi. Marche, flexion, chute et dessin interrompent la scène sans reprise retardée. Aucun geste ne modifie la physique ou les commandes.

## Geste direct et présentation mobile

La construction commence en posant le crayon sur **A ou B**, puis en traçant jusqu’à l’autre ancre. Le dessin direct à la souris ou au doigt n’exige pas E ; ce raccourci reste disponible pour ouvrir le mode dessin au clavier. Depuis la version 1.4.0, un lever de doigt avant l’arrivée conserve le brouillon : le geste reprend sur sa pointe, dans les deux sens. **Reculer** retire une portion de la fin sans effacer le reste. La validation conserve la géométrie du joueur après un léger lissage des tremblements ; le guide facultatif ne remplace jamais son tracé.

Les six premiers chapitres comportent neuf passages à deux plans : détour vers une étoile, chemin court après déplacement d’une roue ou d’une presse, passage baissé et arche supérieure. La version 1.6.0 ajoute dix-neuf passages à deux arrivées distinctes, une rive basse et un balcon. L’ensemble représente **37 dessins**, dont **28 à deux choix**, soit **56 variantes**. Les plans modifient les contraintes du passage mais ne construisent rien automatiquement. La réserve d’encre tolère des courbes dessinées à la main. Un choix est engagé et sauvegardé seulement lorsque le nouveau pont est validé ; le précédent reste en place en cas d’annulation, de raccord manquant ou de dépassement du budget. Les anciennes sauvegardes sans choix de parcours conservent leur géométrie historique.

En portrait comme en paysage, les flèches occupent la zone du pouce gauche ; baisser et se redresser sont à droite. Les poignées se saisissent directement dans la scène, sans bouton de déplacement automatique. La scène occupe toute la fenêtre, les commandes flottent dans les coins, les menus défilent séparément et les réglages restent accessibles. La caméra réserve une marge sous le sol pour que les pouces ne cachent pas le passage. Le changement de présentation ne modifie ni les collisions ni le sens de la marche. Les commandes personnalisées conservent deux emplacements de touche par action.

## Oiseaux articulés de la version 1.5.0

Les oiseaux sont des dessins vectoriels créés pour le jeu, animés par le code ; ils ne sont pas des images ou des prises de vues extraites de l’œuvre. Le même corps, la même tête, les mêmes ailes et la même queue restent présents pendant tout le cycle. Les ailes articulent épaule, coude et poignet avec une poussée plus courte que le retour ; les extrémités suivent avec un léger retard. Le poignet replie les plumes pendant le retour de l’aile ; la tête reste en partie stabilisée lorsque le corps s’incline. Au repos, les deux pieds restent sur la ligne pendant la respiration, le picorage, les regards et le lissage des plumes.

Le départ comporte un regard et une préparation de 0,42 seconde. Le retournement passe par une pose frontale avant l’envol. Les trajectoires sont courbes, avec poussée progressive, croisière bornée et freinage avant l’arrivée. Les ailes se relèvent, la queue s’ouvre et les pattes rejoignent le perchoir ; l’amorti dure 0,52 seconde avant le repli complet. Ce rythme est une mise en scène pour le jeu, pas une simulation biologique.

Les pauses volontaires durent normalement 18 à 34 secondes. Le rendu conserve tous les oiseaux présents dans le champ ; il n’applique plus de plafond qui pourrait en masquer un brusquement. Un second départ volontaire attend que l’activité voisine soit terminée. Les oiseaux posés hors champ ne lancent pas d’activité décorative. La recherche d’un perchoir et du trajet tient compte des surfaces, des dessins validés, des rails et des enveloppes des dangers mobiles. Si aucun départ dégagé n’est possible, l’oiseau se détend sur place au lieu de traverser le décor. Les trajectoires, les poses et le temps décoratif se figent pendant la pause ; le réglage de réduction des animations fige la pose actuelle, même en plein vol, sans ramener le corps dans une silhouette posée.

La sortie est calculée avec la largeur, le haut, le bas et l’échelle du cadre réel. La silhouette complète doit être dehors avant une mise au repos hors champ ; le vol continue si une caméra en déplacement le conserve à l’écran. Un retour utilise la position réellement atteinte, sans création d’un nouvel oiseau à une hauteur arbitraire.

## Mécanismes et sons de la version 1.5.0

Le pont du chapitre 2 coulisse depuis sa rive et le volet du chapitre 5 monte sur une glissière oblique. Les rails sont fixes ; chariots, poulies, tiges et contrepoids suivent la progression effectivement utilisée par la physique. Les choix de dessin et les identifiants de sauvegarde sont conservés.

Les bruitages sont des textures PCM produites localement : pas, souffle des ailes, pépiements courts, friction et impacts des mécanismes. Le planificateur observe les vrais changements d’état et de position, tient compte du cadre et de la distance, et remet ses observations à zéro à la reprise. Il n’ajoute ni boucle de moteur au repos ni bande sonore extérieure. Les seize fragments de voix originale restent inchangés.

## Comprendre et agir — version 1.6.1

Le deuxième acte ajoute **six chapitres et dix-neuf salles d’énigmes**. Ses mécanismes et règles sont créés pour le jeu ; ils ne prétendent pas reproduire des scènes précises de l’œuvre. Les contrôles restent limités à marcher, se baisser, se redresser, dessiner et déplacer manuellement le décor. Aucun saut ou déplacement automatique n’est ajouté pour résoudre les nouvelles situations.

La difficulté repose sur des relations visibles : deux battants qui se retiennent, un pont utile entre ses butées, un passeur à rappeler après avoir débarqué, des contrepoids à accorder, un ascenseur à plusieurs paliers ou une commande réutilisée dans un ordre précis. Les petits symboles et les fils gravés relient les objets concernés. Le circuit observé expose des empreintes assorties aux contacts du rail, pour que le réglage puisse être déduit visuellement. Leurs contours se remplissent lorsque la position physique est correcte ; les crans ordinaires gardent tous le même aspect. L’ordre des manipulations et la place du personnage restent à comprendre.

La main suit le geste du joueur jusque dans les réglages intermédiaires. Les crans attirent légèrement une visée voisine pour rendre le réglage praticable au doigt. Relâcher immobilise l’objet ; aucune minuterie ne le conduit jusqu’à une butée. Lorsqu’une condition cesse d’être satisfaite, l’objet se verrouille à sa position actuelle, ce qui permet les enchaînements et les retours sur un réglage. La caméra prépare les commandes liées avant l’interaction, puis se fige pendant la prise.

Les tracés indicatifs restent masqués au départ. Le carnet dévoile trois indices progressifs uniquement à la demande ; afficher le guide d’un dessin compte aussi comme une aide. Les défis conservent les étoiles, l’absence de chute ou de retour au drapeau, l’autonomie et les autres tracés explorés. La maîtrise exige les trois étoiles sans mort, retour manuel ni indice dans la même traversée complète. Il n’y a pas de délai imposé pour réfléchir, et aucune durée de campagne mesurée n’est annoncée.

Les drapeaux et la sortie tiennent compte du palier réellement atteint. Depuis la version 1.6.1, le drapeau final ne recontrôle plus à distance les réglages des salles déjà franchies ; leurs verrous physiques continuent d’exiger la bonne manipulation sur place. Marcher sous un drapeau haut ne valide pas sa reprise. Les sauvegardes conservent les dessins, les positions des mécanismes et les aides déjà utilisées, sans attribuer rétroactivement une maîtrise aux anciennes parties.

## Vérification

Les tests contrôlent aussi le défilement sans retour en arrière à la validation d’un pont, la stabilité du cadrage sous le pointeur et les réactions des oiseaux. Ils vérifient l’absence d’impulsion de saut, la flexion sous un obstacle, les limites des mécanismes, la migration des anciennes touches et les traversées des deux actes avec leurs dangers actifs. Les salles avancées disposent de contrôles sur leurs deux itinéraires dessinés, les contacts simultanés, l’ordre des réglages, les conditions de sortie et la reprise des sauvegardes. Ils contrôlent également la priorité du mouvement sur les gestes, les raccords des poses basses au sol et la détection de la tête lorsque le personnage est accroupi.

La validation dans le navigateur porte sur les raccords, l’orientation, la lisibilité des poses, le dessin dans les deux sens et les interfaces portrait/paysage. L’examen visuel des images de la main ne constitue pas une écoute des extraits sonores. Les comptes rendus de validation de la version figurent dans les notes de publication.
