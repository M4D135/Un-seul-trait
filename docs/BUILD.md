# Compilation autonome — version 1.6.1

## Prérequis

- Node.js **22.13 ou plus récent** ; `.nvmrc` sélectionne la branche 22.
- npm ; les versions exactes sont enregistrées dans `package-lock.json`.
- Un navigateur moderne avec Canvas 2D, les événements pointeur et le décodage WebP. Web Audio est utilisé lorsque disponible.

## Projet public

```sh
npm ci
npm run typecheck
npm test
npm run build
```

`npm ci` télécharge les dépendances de compilation. Le jeu compilé ne dépend ensuite d’aucun CDN, serveur d’application, compte, clé API ou connexion réseau pour fonctionner.

L’entrée est `scripts/public-app/main.tsx`. Elle monte directement le composant `app/page.tsx` et importe les mêmes styles que le jeu. La configuration `scripts/public-vite.config.mjs` utilise React et Vite ; elle ne charge pas de framework serveur.

Le build produit `dist/index.html`, ses ressources locales et `dist/offline-play.html`. Le fichier autonome contient le JavaScript, le CSS, le favicon, la main photographique générée, les courts extraits sonores sélectionnés et les notices de crédit. Les sources intégrales de Quipos et les liens YouTube restent des références externes : le jeu utilise les ressources locales préparées, sans télécharger les épisodes au lancement.

La campagne complète est incluse : **12 chapitres**, **37 passages à dessiner**, dont **28 à deux choix**, et **36 étoiles**. Les six nouveaux chapitres sont déclarés dans `lib/trait/platform-advanced-levels.ts` ; leurs **19 salles** fournissent les conditions physiques des mécanismes, les verrouillages locaux et les trois indices de chaque situation. Aucun contenu de chapitre n’est chargé depuis un service distant.

`base: './'` permet de servir le dossier compilé à la racine ou dans un sous-dossier. Pour un hébergement statique, copier **tout le contenu** de `dist/`, y compris les médias et leurs manifestes. Le fichier `.nojekyll` est fourni pour les hébergements compatibles avec cette convention. `npm run preview` sert localement le build sans le modifier.

## Médias embarqués et provenance

| Ressource | Contenu |
| --- | --- |
| `public/drawing-hand-hd.webp` | Image transparente de main et d’avant-bras au rendu photographique, générée pour le jeu |
| `public/drawing-hand-hd-manifest.json` | Prompt exact, provenance, résolution réelle, empreinte et ancre de la pointe |
| `public/original-voice.wav` | Seize courts fragments de bande sonore originale, réunis en PCM mono |
| `public/original-voice-manifest.json` | Sources, minutages, durées, empreintes des découpes et positions dans le WAV |

La main mesure réellement **941 × 1 672 pixels**, avec pointe à **(41, 226)**. Le WebP est sans perte et conserve l’alpha. Le moteur l’utilise à une taille stable et anime le poignet autour de la pointe; il n’agrandit plus automatiquement le bras pour couvrir un téléphone très haut. Il ne s’agit pas de 4K native ni d’une nouvelle capture du dessin animé.

L’audio est PCM signé 16 bits, mono, **44 100 Hz**. Il contient **11,42 secondes de source**, avec quinze séparations silencieuses de 0,12 seconde, pour **13,22 secondes** au total. Les fragments durent de 0,58 à 0,98 seconde et conservent hauteur, vitesse et accompagnement. La banque exclut les cinq dernières prises. Le fichier chargé par le site porte une clé de version `?v=3` pour éviter l’ancien cache à trois sons.

La compilation remplace `__TRAIT_HD_HAND_ASSET__` et `__TRAIT_ORIGINAL_AUDIO_ASSET__` par des URLs de données. Le HTML autonome décode donc la main et le WAV localement sans requête média. Les notices et manifestes sont inclus dans ce HTML et copiés dans `docs/` du build. Les origines et limites sont précisées dans [CREDITS.md](../CREDITS.md).

La version 1.6.1 conserve ces fichiers médias. Ses ajouts concernent les énigmes, la progression, les indices et leur présentation ; elle n’introduit pas de nouveaux enregistrements du dessin animé.

## Logique des énigmes et sauvegardes

`platform-mechanisms.ts` évalue les verrouillages à partir des positions réelles des objets et des constructions validées. Toutes les conditions d’une liaison doivent être satisfaites. Les fenêtres de progression autorisent des positions intermédiaires ; les crans aimantés rapprochent une visée tactile de son repère sans lancer de déplacement autonome. Une poignée verrouillée reste à la position où le joueur l’a laissée. Les collisions et le dessin utilisent ces mêmes coordonnées.

`puzzle-signals.ts` dessine les contacts, les symboles associés et les crans. Une seule liaison proche est développée à la fois pour préserver la lisibilité. Sur ce circuit, des empreintes portant les symboles attendus indiquent les contacts physiques des rails ; leur position est calculée sur la même trajectoire que celle de la poignée. Elles restent en contour tant que l’alignement n’est pas réalisé. Les crans ordinaires restent visuellement neutres ; les explications détaillées viennent du carnet demandé par le joueur. Les verrous restent locaux à chaque salle. Le drapeau final valide le passage lorsque le personnage l’atteint à la bonne hauteur, sans revérifier les réglages des salles précédentes. Les sauvegardes 1.6.0 bloquées à l’arrivée se reprennent sans modification de leurs données. Les drapeaux exigent une présence sur leur palier : marcher en dessous ne valide pas une reprise à l’étage supérieur.

`campaign.ts` conserve les résultats, les variantes parcourues et les conditions de la traversée en cours. Les six premiers chapitres et l’entrée du deuxième acte restent ouverts ; les suivants se débloquent progressivement. Un chapitre déjà commencé ou terminé reste accessible. La maîtrise exige les trois étoiles, aucune mort, aucun retour manuel au drapeau et aucun indice dans une seule traversée complète. Afficher le guide d’un dessin compte comme une aide. La migration n’additionne pas des records de parties séparées pour fabriquer une maîtrise et n’en attribue pas aux sauvegardes anciennes dépourvues de ces informations.

## Tests et vérification visuelle

`scripts/public-test.mjs` repère les fichiers `tests/**/*.test.ts` et `.spec.ts`, puis les compile avec TypeScript en CommonJS, cible ES2022, dans un dossier temporaire. Node exécute les tests compilés ; le dossier est supprimé à la fin, même en cas d’échec. Cela permet de conserver les imports TypeScript relatifs du projet sans ajouter de transpileur d’exécution.

Les tests restent indépendants de React et du DOM. Ils couvrent notamment les dessins manuels, le moteur sans saut, la marche baissée, les collisions, les mécanismes et la sauvegarde. Les parcours du deuxième acte sont exercés par les API de marche, de tracé et de manipulation, avec leurs dangers actifs. Des contrôles distincts vérifient les contacts intermédiaires et simultanés, le refus d’une ouverture systématique de toutes les poignées, la reprise des positions, les drapeaux à la bonne hauteur, l’arrivée après déplacement d’un mécanisme déjà franchi, la reprise d’une sauvegarde 1.6.0 bloquée et les défis. La suite conserve aussi les contrôles sur les oiseaux, les poses et les textures sonores. Les notes de version donnent le résultat de la suite complète au moment de la publication. Ces contrôles ne remplacent pas une vérification dans le navigateur ou une écoute des ressources audio.

Pour vérifier l’interface de la version 1.6.1, ouvrir `npm run dev` ou `npm run preview` et contrôler les vues **390 × 844**, **320 × 568** et **844 × 390** :

- La scène et les commandes restent dans le viewport ; le geste de jeu ne fait pas défiler la page.
- Les flèches sont à gauche, baisser et se redresser à droite ; les boutons restent accessibles avec les zones réservées aux encoches et à la barre d’accueil.
- Le trait commence directement depuis A ou B et se valide à l’autre ancre. Un lever de doigt intermédiaire conserve le brouillon, reprenable sur son extrémité dans les deux sens. E reste facultatif.
- Les cartes de parcours ne construisent aucun terrain. Le guide peut être masqué, **Reculer** retire uniquement la fin du brouillon, et une annulation ou une validation refusée conserve le dernier pont valide.
- Les variantes basse et haute changent réellement le passage : poignée à soulever, flexion nécessaire, presse contournée ou étoile laissée sur le détour. La jauge d’encre accompagne le tracé sans obliger à recopier exactement le guide.
- Les menus possèdent leur propre défilement et un bouton de fermeture accessible ; les réglages restent disponibles en plein écran.
- Pendant un geste, caméra et zoom sont immobiles. Une rotation d’écran interrompt proprement le geste, conserve le brouillon reprenable à son extrémité et garde le dernier pont valide.
- Les poignées se déplacent uniquement pendant une prise directe; relâcher interrompt le mouvement, y compris celui d’un ascenseur.
- Le menu permet d’entrer directement au chapitre 7. Les chapitres suivants respectent leur déblocage et les anciennes parties restent accessibles.
- Dans une salle liée, essayer un réglage incorrect, puis intermédiaire ; le contact et le verrou doivent correspondre à la physique. Les commandes concernées restent cadrées avant la prise, et le cadre ne bouge plus sous le doigt.
- Le carnet ne révèle rien avant la demande. Ses trois indices restent progressifs ; afficher un indice ou le guide de dessin compte dans les aides de la traversée. Vérifier la conservation de ce compteur après reprise.
- Les résultats distinguent étoiles, parcours sans chute ni retour, autonomie et maîtrise. Une combinaison de bons scores obtenus dans plusieurs parties ne doit pas attribuer une traversée parfaite.
- Suivre un oiseau jusqu’à sa sortie complète, en portrait et en paysage. Faire défiler la caméra pendant sa fuite et changer de format : aucune limite de nombre ou de durée ne doit le masquer à l’intérieur du cadre. Les retours partent de leur dernière position hors champ.
- Les oiseaux préparent leur envol, tournent sans inversion brusque du profil, freinent avant le posé et gardent les pieds sur la ligne au repos. Observer un cycle en mouvement, ainsi que la proximité d’une scie, d’une presse et d’un plafond bas ; une simple image fixe ne valide pas le rythme.
- Déplacer le pont coulissant du chapitre 2 puis marcher dessus. Ouvrir le volet oblique du chapitre 5 et parcourir les deux variantes du passage ; le dessin du mécanisme et sa collision doivent rester alignés.
- Après une action du joueur, vérifier les réactions audio, le volume, la pause et les éventuels replis de lecture du navigateur. Les tests audio contrôlent le signal PCM, la variété, les attaques et fins silencieuses, les déclenchements liés au mouvement, la pause et la déconnexion des sources. Ils ne constituent pas une écoute subjective. Les seize fragments originaux n’ont pas changé.

## Fichier hors ligne

Le build regroupe le code en un seul module, intègre les feuilles de style et embarque les ressources visuelles et sonores nécessaires. **`offline-play.html` peut être déplacé seul.** Le fichier diffusé pour cette version est nommé **`Un-seul-trait-1.6.1.html`** ; il conserve les contrôles tactiles et clavier ainsi que les ressources locales. Le menu affiche la version pour distinguer le nouveau fichier d’un ancien onglet resté ouvert.

Une adresse `file:` ne possède pas les mêmes garanties de stockage qu’une adresse HTTP. Si le navigateur refuse `localStorage`, la partie fonctionne sans sauvegarde persistante. Le plein écran peut être restreint par le navigateur. **Extraits originaux** est le mode audio par défaut ; **Grammelot synthétique** et **Italien synthétique** restent des options. Le mode italien ne propose que les voix locales déjà installées.

## Export depuis le projet de création

Le checkout de création peut également conserver son hébergement et ses outils d’origine. Ses commandes principales ne sont pas remplacées. Les commandes séparées sont :

```sh
npm run public:build
npm run public:export -- /chemin/absolu/vers/un-dossier-vide
```

Le premier build est rangé dans `work/public-dist/`. L’exporteur suit les imports actifs depuis `app/page.tsx`, ajoute automatiquement les tests et copie une liste explicite de fichiers de build, de documentation et de médias retenus pour le jeu. Les salles avancées, les signaux des énigmes, la progression, le rendu des oiseaux et la palette de dessin sont ainsi inclus par leurs imports ; les contrôles le sont par la découverte de `tests/`. Il refuse un dossier de destination non vide et n’initialise aucun dépôt distant.

L’export ne reprend ni historique Git, variables d’environnement, identifiants d’hébergement, configuration de serveur, connecteurs, captures d’étude ni composants inutilisés. Les seuls médias originaux sélectionnés pour le jeu sont décrits par leurs manifestes ; les épisodes complets et les planches de travail restent exclus. `PUBLIC-MANIFEST.json` énumère chaque fichier exporté avec sa taille et son empreinte SHA-256, pour comparer précisément les contenus avant publication.

Dans le dossier exporté, `npm ci && npm run check` vérifie le projet comme le ferait une personne qui vient de le cloner. La publication GitHub ou la mise en ligne restent des opérations séparées de l’export et du build.

## Publication et déploiement

GitHub Actions conserve deux rôles : le workflow **« Vérification du jeu »** contrôle les types, les tests et le build ; le workflow **« Publication linea.estrasse.fr »** compile les fichiers et met à jour la branche `site` à chaque push sur `main`. La mise en service sur **https://linea.estrasse.fr** dépend ensuite du service de mise à jour du serveur. La configuration du déploiement est décrite dans [deploy/README.md](../deploy/README.md).

La réussite du workflow vérifie la publication de la branche de fichiers ; elle ne prouve pas à elle seule que le serveur public l’a déjà récupérée. Contrôler la version affichée dans le menu du site servi avant d’annoncer sa mise à jour.

La configuration des chemins relatifs et des builds statiques suit la [documentation officielle de Vite](https://vite.dev/guide/build.html).
