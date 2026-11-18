#!/usr/bin/env bash
# Copy the runtime files into an extensions directory. Does not enable anything.
#
# Usage: install-dev.sh [EXTENSIONS_DIR]
#   default: ${XDG_DATA_HOME:-~/.local/share}/gnome-shell/extensions
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
uuid=shell-tweaks@unl0cker
dest_root="${1:-${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions}"
dest="$dest_root/$uuid"

glib-compile-schemas --strict "$root/schemas"

mkdir -p "$dest"
rsync -a --delete \
    --include='/metadata.json' --include='/extension.js' --include='/core.js' --include='/prefs.js' \
    --include='/stylesheet.css' --include='/LICENSE' \
    --include='/lib/***' --include='/modules/***' --include='/prefs/***' \
    --include='/schemas/' --include='/schemas/*.gschema.xml' --include='/schemas/gschemas.compiled' \
    --exclude='*' \
    "$root/" "$dest/"

echo "installed to $dest"
