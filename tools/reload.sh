#!/usr/bin/env bash
# Load the current build into the running session without logging out.
#
# Installs the build, copies the code to versions/<stamp>/ inside the
# installed extension, points reload-version at it and disables/enables the
# extension; the loader in extension.js then imports the fresh copy.
#
# Limits: changes to extension.js or metadata.json still need a logout; each
# reload keeps the previous code in memory until logout (small); the three
# newest copies are kept on disk.
set -euo pipefail

uuid=shell-tweaks@unl0cker
root="$(cd "$(dirname "$0")/.." && pwd)"
ext_root="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions"
dest="$ext_root/$uuid"
stamp="$(date +%Y%m%d-%H%M%S)"

"$root/tools/install-dev.sh" "$ext_root" >/dev/null

mkdir -p "$dest/versions/$stamp"
rsync -a --include='/core.js' --include='/lib/***' --include='/modules/***' --exclude='*' \
    "$root/" "$dest/versions/$stamp/"
echo "$stamp" > "$dest/reload-version"

# keep the three newest copies
mapfile -t old < <(find "$dest/versions" -mindepth 1 -maxdepth 1 -type d | sort | head -n -3)
for dir in "${old[@]}"; do
    rm -rf -- "$dir"
done

gnome-extensions disable "$uuid"
sleep 1
gnome-extensions enable "$uuid"
sleep 2

state="$(gnome-extensions info "$uuid" | sed -n 's/^ *State: //p')"
echo "reloaded $stamp, state: $state"
if ! journalctl --user --since "-10s" -o cat 2>/dev/null | grep -q "running reloaded code $stamp"; then
    echo "note: the running Shell did not report the new code. If this is the first"
    echo "reload since installing the loader, log out once; reloads work after that."
fi
