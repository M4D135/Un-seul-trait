#!/usr/bin/env bash
# Un seul trait : mise en ligne sur un VPS servi par Caddy (service systemd « caddy »).
#
#   curl -fsSL https://raw.githubusercontent.com/M4D135/Un-seul-trait/main/deploy/install-vps.sh | sudo bash
#
# Relançable sans risque. Le script :
#   1. installe le jeu compilé (branche « site » du dépôt) dans /srv/linea ;
#   2. ajoute le bloc linea.estrasse.fr au Caddyfile et recharge Caddy, qui obtient
#      seul le certificat Let's Encrypt. Si Caddy refuse la configuration, l'ancien
#      Caddyfile est restauré et les autres sites ne sont pas touchés ;
#   3. installe le timer systemd linea-update, qui récupère la dernière version toutes les 5 min.
#
# Désinstallation : curl -fsSL …/deploy/install-vps.sh | sudo bash -s -- uninstall
set -euo pipefail

DOMAIN=linea.estrasse.fr
REPO=M4D135/Un-seul-trait
BRANCH=site
ROOT=/srv/linea
UNIT=linea-update
UPDATER=/usr/local/sbin/$UNIT
MARK_BEGIN="# >>> $DOMAIN : Un seul trait (deploy/install-vps.sh)"
MARK_END="# <<< $DOMAIN"

say()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mATTENTION :\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31mERREUR :\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "à lancer en root (sudo)."
command -v systemctl >/dev/null || die "systemd introuvable."
command -v caddy >/dev/null || die "caddy introuvable dans le PATH."
systemctl is-active --quiet caddy \
  || die "le service systemd « caddy » n'est pas actif. Si Caddy tourne dans Docker, suis deploy/README.md (configuration manuelle)."

CADDYFILE=$(systemctl show -p ExecStart --value caddy | grep -oE -- '--config[= ][^ ;]+' | head -n1 | sed -E 's/^--config[= ]//' || true)
CADDYFILE=${CADDYFILE:-/etc/caddy/Caddyfile}
[ -f "$CADDYFILE" ] || die "Caddyfile introuvable : $CADDYFILE"
case "$CADDYFILE" in *.json) die "Caddy est configuré en JSON ($CADDYFILE) : ajoute le site à la main (deploy/README.md)." ;; esac

remove_block() {  # retire le bloc géré et la ligne vide qui le précède
  local tmp
  tmp=$(mktemp)
  awk -v b="$MARK_BEGIN" -v e="$MARK_END" '
    skip { if ($0 == e) skip = 0; next }
    $0 == b { skip = 1; hold = 0; next }
    hold { print ""; hold = 0 }
    $0 == "" { hold = 1; next }
    { print }
    END { if (hold) print "" }' "$CADDYFILE" > "$tmp"
  cat "$tmp" > "$CADDYFILE"
  rm -f "$tmp"
}

if [ "${1:-}" = uninstall ]; then
  systemctl disable --now "$UNIT.timer" >/dev/null 2>&1 || true
  rm -f "/etc/systemd/system/$UNIT.service" "/etc/systemd/system/$UNIT.timer" "$UPDATER"
  systemctl daemon-reload
  if grep -qxF "$MARK_BEGIN" "$CADDYFILE"; then
    cp -a "$CADDYFILE" "$CADDYFILE.bak-$(date +%Y%m%d-%H%M%S)"
    remove_block
    systemctl reload caddy
  fi
  rm -rf -- "$ROOT"
  say "$DOMAIN désinstallé."
  exit 0
fi

if ! grep -qxF "$MARK_BEGIN" "$CADDYFILE" \
  && grep -qE "(^|[[:space:],/])${DOMAIN//./\\.}([[:space:],:{]|$)" "$CADDYFILE"; then
  die "$CADDYFILE mentionne déjà $DOMAIN : je n'y touche pas, vérifie ce bloc à la main."
fi

missing=()
for tool in git curl tar; do command -v "$tool" >/dev/null || missing+=("$tool"); done
if [ ${#missing[@]} -gt 0 ]; then
  command -v apt-get >/dev/null || die "outils manquants : ${missing[*]}"
  say "installation de : ${missing[*]}"
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${missing[@]}" >/dev/null
fi

# 1. Script de mise à jour : télécharge la dernière version de la branche, puis bascule
#    le lien « current » d'un coup (aucune page à moitié copiée). Garde les 3 dernières versions.
say "script de mise à jour : $UPDATER"
{
  printf '#!/usr/bin/env bash\n'
  printf '# Généré par deploy/install-vps.sh : met %s à jour depuis la branche %s de %s.\n' "$DOMAIN" "$BRANCH" "$REPO"
  printf 'REPO=%q BRANCH=%q ROOT=%q\n' "$REPO" "$BRANCH" "$ROOT"
  cat <<'UPDATER_EOF'
set -euo pipefail
export GIT_TERMINAL_PROMPT=0
sha=$(git ls-remote "https://github.com/$REPO.git" "refs/heads/$BRANCH" | cut -f1)
[ -n "$sha" ] || { echo "branche $BRANCH introuvable sur $REPO" >&2; exit 1; }
[ "$(readlink "$ROOT/current" 2>/dev/null || true)" = "releases/$sha" ] && exit 0
install -d -m 755 "$ROOT/releases"
tmp=$(mktemp -d "$ROOT/releases/.tmp-XXXXXX")
trap 'rm -rf -- "$tmp"' EXIT
curl -fsSL --retry 3 "https://codeload.github.com/$REPO/tar.gz/$sha" | tar -xzf - -C "$tmp" --strip-components=1
[ -s "$tmp/index.html" ] || { echo "archive incomplète : index.html absent" >&2; exit 1; }
chmod -R u=rwX,go=rX "$tmp"
rm -rf -- "${ROOT:?}/releases/$sha"
mv "$tmp" "$ROOT/releases/$sha"
trap - EXIT
ln -sfn "releases/$sha" "$ROOT/current.new"
mv -T "$ROOT/current.new" "$ROOT/current"
echo "version en ligne : $sha"
cd "$ROOT/releases"
ls -1t | tail -n +4 | while read -r old; do [ "$old" = "$sha" ] || rm -rf -- "$old"; done
UPDATER_EOF
} > "$UPDATER"
chmod 755 "$UPDATER"

cat > "/etc/systemd/system/$UNIT.service" <<EOF
[Unit]
Description=Mise à jour d'Un seul trait ($DOMAIN) depuis GitHub
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=$UPDATER
Environment=HOME=/tmp
PrivateTmp=yes
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$ROOT
EOF

cat > "/etc/systemd/system/$UNIT.timer" <<EOF
[Unit]
Description=Vérifie toutes les 5 minutes si Un seul trait a une nouvelle version

[Timer]
OnCalendar=*:0/5
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload

say "récupération du jeu compilé ($REPO, branche $BRANCH)"
install -d -m 755 "$ROOT"
systemctl start "$UNIT.service" || { journalctl -u "$UNIT" -n 20 --no-pager >&2 || true; die "échec du téléchargement."; }
[ -s "$ROOT/current/index.html" ] || die "aucun index.html dans $ROOT/current."
systemctl enable --now "$UNIT.timer" >/dev/null
say "version installée : $(readlink "$ROOT/current")"

# 2. Bloc Caddy.
BACKUP=
if grep -qxF "$MARK_BEGIN" "$CADDYFILE"; then
  say "bloc $DOMAIN déjà présent dans $CADDYFILE"
else
  BACKUP="$CADDYFILE.bak-$(date +%Y%m%d-%H%M%S)"
  cp -a "$CADDYFILE" "$BACKUP"
  cat >> "$CADDYFILE" <<EOF

$MARK_BEGIN
$DOMAIN {
	root * $ROOT/current
	encode zstd gzip
	@html path / /index.html /offline-play.html
	header @html Cache-Control "no-cache"
	header /assets/* Cache-Control "public, max-age=31536000, immutable"
	file_server
}
$MARK_END
EOF
  say "bloc $DOMAIN ajouté à $CADDYFILE (sauvegarde : $BACKUP)"
fi

say "rechargement de Caddy"
if ! systemctl reload caddy; then
  if [ -n "$BACKUP" ]; then
    cp -a "$BACKUP" "$CADDYFILE"
    warn "Caddyfile restauré depuis $BACKUP"
  fi
  journalctl -u caddy -n 20 --no-pager >&2 || true
  die "Caddy a refusé la configuration ; les sites existants tournent toujours avec l'ancienne."
fi

# 3. Contrôles.
ip_dns=$(getent ahostsv4 "$DOMAIN" | awk 'NR == 1 { print $1 }' || true)
if [ -z "$ip_dns" ]; then
  warn "$DOMAIN ne résout pas : ajoute un enregistrement A vers l'IP de ce serveur."
elif command -v ip >/dev/null && ! ip -4 -o addr show | grep -qF " $ip_dns/"; then
  warn "$DOMAIN pointe vers $ip_dns, qui n'est pas une adresse de ce serveur."
fi

say "attente du certificat HTTPS (jusqu'à 2 min)"
for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null --max-time 5 "https://$DOMAIN/"; then
    say "en ligne : https://$DOMAIN/"
    exit 0
  fi
  sleep 3
done
warn "pas encore de réponse HTTPS valide. Journal : journalctl -u caddy -n 50 --no-pager | grep -i '$DOMAIN'"
exit 1
