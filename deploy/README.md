# Mise en ligne sur linea.estrasse.fr

Le jeu est servi par le VPS (Caddy), comme les autres sites de `estrasse.fr`.

- **GitHub Actions** (`.github/workflows/deploy-site.yml`) : à chaque push sur `main`, `npm run check` (types, tests, build), puis le contenu de `dist/` est poussé sur la branche orpheline `site`.
- **VPS** : Caddy sert `/srv/linea/current` sur `linea.estrasse.fr`, avec un certificat Let's Encrypt obtenu et renouvelé automatiquement. Le timer systemd `linea-update.timer` récupère la branche `site` toutes les 5 minutes. Le lien `current` bascule d'un coup vers la nouvelle version, et les 3 dernières versions restent dans `/srv/linea/releases/`.

## Installation (une seule fois, sur le VPS)

Prérequis : l'enregistrement DNS `linea` en **A** vers l'IP du VPS, et Caddy installé comme service systemd `caddy` avec un Caddyfile.

```sh
curl -fsSL https://raw.githubusercontent.com/M4D135/Un-seul-trait/main/deploy/install-vps.sh | sudo bash
```

Le script peut être relancé sans risque. Il sauvegarde le Caddyfile avant d'y ajouter le bloc. Si Caddy refuse la nouvelle configuration, il restaure l'original : les sites existants ne sont pas touchés.

## Exploitation

| Besoin | Commande |
| --- | --- |
| Forcer la mise à jour | `sudo systemctl start linea-update` |
| Journal des mises à jour | `journalctl -u linea-update` |
| Version en ligne | `readlink /srv/linea/current` |
| Revenir à une version précédente | `sudo systemctl stop linea-update.timer && sudo ln -sfn releases/<sha> /srv/linea/current` |
| Reprendre les mises à jour | `sudo systemctl start linea-update.timer` |
| Désinstaller | `curl -fsSL https://raw.githubusercontent.com/M4D135/Un-seul-trait/main/deploy/install-vps.sh \| sudo bash -s -- uninstall` |

## Variante sans serveur : GitHub Pages

La branche `site` contient aussi un fichier `CNAME` et peut être servie par GitHub Pages :

1. Dans le dépôt, **Settings → Pages** : source « Deploy from a branch », branche `site`, dossier `/ (root)`.
2. Zone DNS OVH de `estrasse.fr` : remplacer l'enregistrement A `linea` par un **CNAME** `linea` vers `m4d135.github.io.` (avec le point final).
3. Une fois le certificat émis par GitHub (quelques minutes à 1 h), cocher **Enforce HTTPS**.

## Configuration manuelle (Caddy dans Docker, Caddyfile importé, etc.)

Copie le contenu de la branche `site` dans un dossier lisible par Caddy, puis ajoute ce bloc et recharge Caddy :

```caddyfile
linea.estrasse.fr {
	root * /srv/linea/current
	encode zstd gzip
	@html path / /index.html /offline-play.html
	header @html Cache-Control "no-cache"
	header /assets/* Cache-Control "public, max-age=31536000, immutable"
	file_server
}
```

Les fichiers de `assets/` ont un nom qui change à chaque build : ils peuvent être mis en cache longtemps. `index.html` est revalidé à chaque visite, donc une nouvelle version apparaît dès le rechargement de la page.
