# Crédits et références

## L’œuvre de référence

**La Linea** est une création d’**Osvaldo Cavandoli**. La voix du personnage original est celle de **Carlo Bonomi** ; la musique des épisodes est associée à **Franco Godi**. Le site consacré à Cavandoli explique notamment le trait continu, l’intervention de sa main filmée et le grammelot du personnage :

- [Osvaldo Cavandoli — I Serial](https://osvaldocavandoli.com/i-serial/)
- [Osvaldo Cavandoli — Processo creativo](https://osvaldocavandoli.com/processo-creativo/)
- [Quipos — La Linea](https://www.quipos.net/en/animations/la-linea/)
- [Épisode indiqué comme référence initiale](https://www.youtube.com/watch?v=qXr2DUwI6UQ)

Les séquences ont servi à l’étude du mouvement et des poses. Les vidéos, les images extraites et la bande sonore originale ne sont pas fournies dans ce dépôt ni dans le fichier de jeu autonome.

**Un seul trait est un projet de fan non officiel**, sans affiliation ni approbation annoncée des ayants droit. La publication du code ne concède aucun droit supplémentaire sur La Linea, son personnage ou l’œuvre d’origine.

## Ce qui a été créé pour le jeu

- Le code du jeu, les parcours, les interactions et les dessins vectoriels sont une réalisation pour ce projet. Les situations de plateforme et les poses associées adaptent la référence à une expérience interactive.
- `public/drawing-hand.png` est une image générée pour le prototype, au rendu photographique et au fond transparent. La main est animée par transformation de cette image ; **ce n’est pas une séquence filmée**.
- Les réactions en grammelot, les pas et le bruit du crayon sont synthétisés localement. **Aucun enregistrement ni clonage de la voix de Carlo Bonomi n’est utilisé.** Le mode italien optionnel utilise une voix installée sur l’appareil.
- Les icônes d’interface proviennent de **Lucide**.

## Logiciels

Le jeu utilise React, React DOM et Lucide React. Sa compilation autonome utilise Vite, le plugin React de Vite, TypeScript et Tailwind CSS. Ces dépendances conservent leurs licences respectives ; les notices des bibliothèques intégrées au navigateur figurent dans [THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md) et sont incluses dans le fichier hors ligne.
