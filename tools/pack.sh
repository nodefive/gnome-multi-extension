#!/usr/bin/env bash
# Compile the schema, regenerate the stylesheet and build the extension zip.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

tools/gen-stylesheet.sh
glib-compile-schemas --strict schemas
tools/check-keys.sh

mkdir -p dist
gnome-extensions pack --force --out-dir=dist \
    --extra-source=core.js --extra-source=lib --extra-source=modules --extra-source=prefs \
    --extra-source=LICENSE \
    .

echo "built $(ls dist/*.zip)"
