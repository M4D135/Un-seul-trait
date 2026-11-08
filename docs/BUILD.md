# Compilation autonome

## Prérequis

- Node.js **22.13 ou plus récent** ; `.nvmrc` sélectionne la branche 22.
- npm ; les versions exactes sont enregistrées dans `package-lock.json`.
- Un navigateur moderne avec Canvas 2D et les événements pointeur. Web Audio est utilisé lorsque disponible.

## Projet public

```sh
npm ci
npm run typecheck
npm test
npm run build
```

`npm ci` télécharge les dépendances de compilation. Le jeu compilé ne dépend ensuite d’aucun CDN, serveur d’application, compte, clé API ou connexion réseau pour fonctionner.

L’entrée est `scripts/public-app/main.tsx`. Elle monte directement le composant `app/page.tsx` et importe les mêmes styles que le jeu. La configuration `scripts/public-vite.config.mjs` utilise React et Vite ; elle ne charge pas de framework serveur.

Le build produit `dist/index.html`, ses ressources locales et `dist/offline-play.html`. Ce dernier contient le JavaScript, le CSS, le favicon, la main et les notices de crédit. Les liens de référence restent de simples liens à ouvrir volontairement ; aucune vidéo ni piste audio originale n’est téléchargée au lancement.

`base: './'` permet de servir le dossier compilé à la racine ou dans un sous-dossier. Pour un hébergement statique, copier **tout le contenu** de `dist/`. Le fichier `.nojekyll` est fourni pour les hébergements compatibles avec cette convention. `npm run preview` sert localement le build sans le modifier.

## Tests

`scripts/public-test.mjs` repère les fichiers `tests/**/*.test.ts` et `.spec.ts`, puis les compile avec TypeScript en CommonJS, cible ES2022, dans un dossier temporaire. Node exécute les tests compilés ; le dossier est supprimé à la fin, même en cas d’échec. Cela permet de conserver les imports TypeScript relatifs du projet sans ajouter de transpileur d’exécution.

Les tests restent indépendants de React et du DOM. Les interactions visuelles, les touches, le son et les différences de navigateur se vérifient dans le jeu ouvert avec `npm run dev` ou `npm run preview`.

## Fichier hors ligne

Le build regroupe le code en un seul module, intègre les feuilles de style et embarque la main sous forme d’URL de données. `offline-play.html` peut donc être déplacé seul. Il conserve les contrôles tactiles et clavier ainsi que la synthèse sonore locale.

Une adresse `file:` ne possède pas les mêmes garanties de stockage qu’une adresse HTTP. Si le navigateur refuse `localStorage`, la partie fonctionne sans sauvegarde persistante. Le plein écran peut être restreint par le navigateur. Le mode de voix italienne ne propose que les voix locales déjà installées ; sinon le grammelot synthétique reste disponible.

## Export depuis le projet de création

Le checkout de création peut également conserver son hébergement et ses outils d’origine. Ses commandes principales ne sont pas remplacées. Les commandes séparées sont :

```sh
npm run public:build
npm run public:export -- /chemin/absolu/vers/un-dossier-vide
```

Le premier build est rangé dans `work/public-dist/`. L’exporteur suit les imports actifs depuis `app/page.tsx`, ajoute les tests et copie une liste explicite de fichiers de build et de documentation. Il refuse un dossier de destination non vide et n’initialise aucun dépôt distant.

L’export ne reprend ni historique Git, variables d’environnement, identifiants d’hébergement, configuration de serveur, connecteurs, médias d’étude ni composants inutilisés. `PUBLIC-MANIFEST.json` énumère chaque fichier exporté avec sa taille et son empreinte SHA-256, pour comparer précisément les contenus avant publication.

Dans le dossier exporté, `npm ci && npm run check` vérifie le projet comme le ferait une personne qui vient de le cloner. La publication GitHub ou la mise en ligne restent des opérations séparées de l’export et du build.

## Référence technique

La configuration des chemins relatifs et des builds statiques suit la [documentation officielle de Vite](https://vite.dev/guide/build.html).
