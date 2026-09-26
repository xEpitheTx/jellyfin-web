#!/bin/sh
# Installs the latest Plex-style web client and restarts Jellyfin.
# Usage: ./update-web.sh    Roll back: ./update-web.sh --rollback
set -eu

cd "$(dirname "$0")"

WEB_URL="${WEB_URL:-https://github.com/xEpitheTx/jellyfin-web/releases/download/plex-latest/jellyfin-web-plex.tar.gz}"
MOUNT_LINE='./web:/jellyfin/jellyfin-web:ro'

restart() {
    # "up -d" rather than "restart" so a newly enabled mount takes effect.
    docker compose up -d jellyfin
}

if [ "${1:-}" = "--rollback" ]; then
    [ -d web.old ] || { echo "No previous version to roll back to." >&2; exit 1; }
    rm -rf web
    mv web.old web
    restart
    echo "Rolled back to the previous web client."
    exit 0
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

echo "Downloading web client (about 35 MB)..."
# Show progress, retry on network errors, and give up if the download stalls
# (under 10 KB/s for a minute) instead of hanging forever.
if ! curl -fL --progress-bar --retry 3 --retry-delay 5 --connect-timeout 20 \
        --speed-limit 10240 --speed-time 60 "$WEB_URL" -o "$tmp/web.tar.gz"; then
    echo "Download failed or stalled; nothing was changed. Check the server's internet connection and try again." >&2
    exit 1
fi

echo "Unpacking..."
mkdir "$tmp/web"
tar -xzf "$tmp/web.tar.gz" -C "$tmp/web"

if [ ! -f "$tmp/web/index.html" ]; then
    echo "The download doesn't look like a web client; nothing was changed." >&2
    exit 1
fi

echo "Installing..."
rm -rf web.old
if [ -d web ]; then
    mv web web.old
fi
mv "$tmp/web" web

# Turn on the web client mount the first time.
if grep -q "# - $MOUNT_LINE" docker-compose.yml; then
    sed -i "s|# - $MOUNT_LINE|- $MOUNT_LINE|" docker-compose.yml
    echo "Enabled the custom web client in docker-compose.yml."
fi

restart
echo "Done. The previous version (if any) is in web.old; undo with: $0 --rollback"
