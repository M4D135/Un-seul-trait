# Compilation autonome — version 1.2.0

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

Le build produit `dist/index.html`, ses ressources locales et `dist/offline-play.html`. Le fichier autonome contient le JavaScript, le CSS, le favicon, l’atlas de la main filmée, les courts extraits sonores sélectionnés et les notices de crédit. Les sources intégrales de Quipos et les liens YouTube restent des références externes : le jeu utilise les ressources locales préparées, sans télécharger les épisodes au lancement.

`base: './'` permet de servir le dossier compilé à la racine ou dans un sous-dossier. Pour un hébergement statique, copier **tout le contenu** de `dist/`, y compris les médias et leurs manifestes. Le fichier `.nojekyll` est fourni pour les hébergements compatibles avec cette convention. `npm run preview` sert localement le build sans le modifier.

## Médias embarqués et provenance

| Ressource | Contenu |
| --- | --- |
| `public/original-hand-atlas.webp` | Atlas transparent de quatre images de la main, préparé à partir de l’extrait officiel 100 |
| `public/original-hand-manifest.json` | URL source, minutages, rectangles des images, cadence et ancre de la pointe |
| `public/original-voice.wav` | Trois courts extraits sonores réunis dans un fichier PCM mono |
| `public/original-voice-manifest.json` | Sources, durées, positions des extraits dans le WAV et empreinte du fichier |

L’atlas de la main mesure **1 216 × 304 pixels**, avec une rangée de quatre cellules de **304 × 304 pixels**. La pointe du crayon est stabilisée à **(16, 16)** dans chaque cellule. Les quatre images successives, issues de **1,32 s incluse à 1,48 s exclue**, contiennent deux poses photographiques maintenues et correspondent à **0,16 seconde à 25 images par seconde**. Le jeu réutilise ce petit mouvement de poignet et programme le déplacement de la main pour suivre le tracé. Les bords où le poignet est coupé dans la source sont décrits dans le manifeste et doivent sortir du Canvas.

Le fichier audio est un WAV PCM signé 16 bits, mono, à **44 100 Hz**. Il contient **2,68 secondes de son source** et deux séparations silencieuses de 0,12 seconde, pour une durée de fichier de **2,92 secondes**. La conversion en mono conserve la bande sonore des passages sélectionnés. Les détails d’attribution et les limites d’utilisation sont dans [CREDITS.md](../CREDITS.md).

Les manifestes documentent la provenance et la préparation. Ils sont également inclus dans le fichier HTML autonome et copiés dans le sous-dossier `docs/` du build statique. Ils ne constituent pas des licences de réutilisation des médias.

## Tests et vérification visuelle

`scripts/public-test.mjs` repère les fichiers `tests/**/*.test.ts` et `.spec.ts`, puis les compile avec TypeScript en CommonJS, cible ES2022, dans un dossier temporaire. Node exécute les tests compilés ; le dossier est supprimé à la fin, même en cas d’échec. Cela permet de conserver les imports TypeScript relatifs du projet sans ajouter de transpileur d’exécution.

Les tests restent indépendants de React et du DOM. Ils couvrent notamment les dessins manuels, le moteur sans saut, la marche baissée, les collisions, les mécanismes et la sauvegarde. Ils ne remplacent pas une vérification dans le navigateur ou une écoute des ressources audio.

Pour vérifier l’interface de la version 1.2.0, ouvrir `npm run dev` ou `npm run preview` et contrôler les vues **390 × 844**, **320 × 568** et **844 × 390** :

- La scène et les commandes restent dans le viewport ; le geste de jeu ne fait pas défiler la page.
- Les flèches sont à gauche, la flexion et la manipulation à droite ; les boutons restent accessibles avec les zones réservées aux encoches et à la barre d’accueil.
- Le trait commence directement depuis A ou B, se valide à l’autre ancre et peut être effacé ou annulé. E reste facultatif.
- Les menus possèdent leur propre défilement et un bouton de fermeture accessible ; les réglages restent disponibles en plein écran.
- Le changement d’orientation conserve les coordonnées du pointeur, la pointe du crayon et le raccord du trait.
- Après une action du joueur, vérifier les réactions audio, le volume, la pause et les éventuels replis de lecture du navigateur. La préparation des extraits a vérifié leurs formats et durées ; elle n’a pas comporté de validation auditive par les outils d’étude.

## Fichier hors ligne

Le build regroupe le code en un seul module, intègre les feuilles de style et embarque les ressources visuelles et sonores nécessaires. **`offline-play.html` peut être déplacé seul.** Le fichier diffusé pour cette version est nommé **`Un-seul-trait-1.2.0.html`** ; il conserve les contrôles tactiles et clavier ainsi que les ressources locales.

Une adresse `file:` ne possède pas les mêmes garanties de stockage qu’une adresse HTTP. Si le navigateur refuse `localStorage`, la partie fonctionne sans sauvegarde persistante. Le plein écran peut être restreint par le navigateur. **Extraits originaux** est le mode audio par défaut ; **Grammelot synthétique** et **Italien synthétique** restent des options. Le mode italien ne propose que les voix locales déjà installées.

## Export depuis le projet de création

Le checkout de création peut également conserver son hébergement et ses outils d’origine. Ses commandes principales ne sont pas remplacées. Les commandes séparées sont :

```sh
npm run public:build
npm run public:export -- /chemin/absolu/vers/un-dossier-vide
```

Le premier build est rangé dans `work/public-dist/`. L’exporteur suit les imports actifs depuis `app/page.tsx`, ajoute les tests et copie une liste explicite de fichiers de build, de documentation et de médias retenus pour le jeu. Il refuse un dossier de destination non vide et n’initialise aucun dépôt distant.

L’export ne reprend ni historique Git, variables d’environnement, identifiants d’hébergement, configuration de serveur, connecteurs, captures d’étude ni composants inutilisés. Les seuls médias originaux sélectionnés pour le jeu sont décrits par leurs manifestes ; les épisodes complets et les planches de travail restent exclus. `PUBLIC-MANIFEST.json` énumère chaque fichier exporté avec sa taille et son empreinte SHA-256, pour comparer précisément les contenus avant publication.

Dans le dossier exporté, `npm ci && npm run check` vérifie le projet comme le ferait une personne qui vient de le cloner. La publication GitHub ou la mise en ligne restent des opérations séparées de l’export et du build.

## Publication et déploiement

GitHub Actions conserve deux rôles : le workflow **« Vérification du jeu »** contrôle les types, les tests et le build ; le workflow **« Publication linea.estrasse.fr »** déploie le site utilisateur sur **https://linea.estrasse.fr** à chaque push sur `main`. La configuration du déploiement est décrite dans [deploy/README.md](../deploy/README.md).

La configuration des chemins relatifs et des builds statiques suit la [documentation officielle de Vite](https://vite.dev/guide/build.html).
