# Compilation autonome — version 1.4.0

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

## Tests et vérification visuelle

`scripts/public-test.mjs` repère les fichiers `tests/**/*.test.ts` et `.spec.ts`, puis les compile avec TypeScript en CommonJS, cible ES2022, dans un dossier temporaire. Node exécute les tests compilés ; le dossier est supprimé à la fin, même en cas d’échec. Cela permet de conserver les imports TypeScript relatifs du projet sans ajouter de transpileur d’exécution.

Les tests restent indépendants de React et du DOM. Ils couvrent notamment les dessins manuels, le moteur sans saut, la marche baissée, les collisions, les mécanismes et la sauvegarde. La suite complète de la version 1.4.0 passe ses **90 tests**. Elle comprend **14 tests sur les oiseaux**, **10 tests sur les choix, la reprise du dessin et les marches franchissables**, et **6 tests sur les conséquences physiques des énigmes**. Ces contrôles ne remplacent pas une vérification dans le navigateur ou une écoute des ressources audio.

Pour vérifier l’interface de la version 1.4.0, ouvrir `npm run dev` ou `npm run preview` et contrôler les vues **390 × 844**, **320 × 568** et **844 × 390** :

- La scène et les commandes restent dans le viewport ; le geste de jeu ne fait pas défiler la page.
- Les flèches sont à gauche, baisser et se redresser à droite ; les boutons restent accessibles avec les zones réservées aux encoches et à la barre d’accueil.
- Le trait commence directement depuis A ou B et se valide à l’autre ancre. Un lever de doigt intermédiaire conserve le brouillon, reprenable sur son extrémité dans les deux sens. E reste facultatif.
- Les cartes de parcours ne construisent aucun terrain. Le guide peut être masqué, **Reculer** retire uniquement la fin du brouillon, et une annulation ou une validation refusée conserve le dernier pont valide.
- Les variantes basse et haute changent réellement le passage : poignée à soulever, flexion nécessaire, presse contournée ou étoile laissée sur le détour. La jauge d’encre accompagne le tracé sans obliger à recopier exactement le guide.
- Les menus possèdent leur propre défilement et un bouton de fermeture accessible ; les réglages restent disponibles en plein écran.
- Pendant un geste, caméra et zoom sont immobiles. Une rotation d’écran interrompt proprement le geste, conserve le brouillon reprenable à son extrémité et garde le dernier pont valide.
- Les poignées se déplacent uniquement pendant une prise directe; relâcher interrompt le mouvement, y compris celui d’un ascenseur.
- Les oiseaux préparent leur envol, tournent sans inversion brusque du profil, freinent avant le posé et gardent les pieds sur la ligne au repos. Observer un cycle en mouvement, ainsi que la proximité d’une scie, d’une presse et d’un plafond bas ; une simple image fixe ne valide pas le rythme.
- Après une action du joueur, vérifier les réactions audio, le volume, la pause et les éventuels replis de lecture du navigateur. La préparation des extraits a vérifié leurs formats et durées ; elle n’a pas comporté de validation auditive par les outils d’étude.

## Fichier hors ligne

Le build regroupe le code en un seul module, intègre les feuilles de style et embarque les ressources visuelles et sonores nécessaires. **`offline-play.html` peut être déplacé seul.** Le fichier diffusé pour cette version est nommé **`Un-seul-trait-1.4.0.html`** ; il conserve les contrôles tactiles et clavier ainsi que les ressources locales.

Une adresse `file:` ne possède pas les mêmes garanties de stockage qu’une adresse HTTP. Si le navigateur refuse `localStorage`, la partie fonctionne sans sauvegarde persistante. Le plein écran peut être restreint par le navigateur. **Extraits originaux** est le mode audio par défaut ; **Grammelot synthétique** et **Italien synthétique** restent des options. Le mode italien ne propose que les voix locales déjà installées.

## Export depuis le projet de création

Le checkout de création peut également conserver son hébergement et ses outils d’origine. Ses commandes principales ne sont pas remplacées. Les commandes séparées sont :

```sh
npm run public:build
npm run public:export -- /chemin/absolu/vers/un-dossier-vide
```

Le premier build est rangé dans `work/public-dist/`. L’exporteur suit les imports actifs depuis `app/page.tsx`, ajoute automatiquement les tests et copie une liste explicite de fichiers de build, de documentation et de médias retenus pour le jeu. Le rendu articulé des oiseaux, la palette de dessin et les nouveaux tests sont ainsi inclus par leurs imports et par la découverte de `tests/`. Il refuse un dossier de destination non vide et n’initialise aucun dépôt distant.

L’export ne reprend ni historique Git, variables d’environnement, identifiants d’hébergement, configuration de serveur, connecteurs, captures d’étude ni composants inutilisés. Les seuls médias originaux sélectionnés pour le jeu sont décrits par leurs manifestes ; les épisodes complets et les planches de travail restent exclus. `PUBLIC-MANIFEST.json` énumère chaque fichier exporté avec sa taille et son empreinte SHA-256, pour comparer précisément les contenus avant publication.

Dans le dossier exporté, `npm ci && npm run check` vérifie le projet comme le ferait une personne qui vient de le cloner. La publication GitHub ou la mise en ligne restent des opérations séparées de l’export et du build.

## Publication et déploiement

GitHub Actions conserve deux rôles : le workflow **« Vérification du jeu »** contrôle les types, les tests et le build ; le workflow **« Publication linea.estrasse.fr »** déploie le site utilisateur sur **https://linea.estrasse.fr** à chaque push sur `main`. La configuration du déploiement est décrite dans [deploy/README.md](../deploy/README.md).

La configuration des chemins relatifs et des builds statiques suit la [documentation officielle de Vite](https://vite.dev/guide/build.html).
