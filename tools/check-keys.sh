#!/usr/bin/env bash
# Static check: every schema key is used by the extension and shown in prefs.
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
schema="$root/schemas/org.gnome.shell.extensions.shell-tweaks.gschema.xml"
status=0

mapfile -t keys < <(grep -oE '<key name="[^"]+"' "$schema" | sed -E 's/<key name="([^"]+)"/\1/')

code="$(cat "$root"/extension.js "$root"/core.js "$root"/lib/*.js "$root"/modules/*.js "$root"/modules/*/*.js)"
prefs="$(cat "$root"/prefs.js "$root"/prefs/*.js)"

# keys built from templates in code/prefs
templated='^(hot-corners-(top|bottom)-(left|right)-|hot-corners-custom-menu-[1-4]$)'

for key in "${keys[@]}"; do
    if [[ $key =~ $templated ]]; then
        continue
    fi
    if [[ $key == module-* ]]; then
        grep -q "'$key'" <<<"$code" || { echo "module key not used by a module: $key"; status=1; }
        grep -q "'$key'" <<<"$prefs" || { echo "module key missing in prefs: $key"; status=1; }
        continue
    fi
    grep -q "'$key'" <<<"$code" || { echo "unused by extension: $key"; status=1; }
    grep -q "'$key'" <<<"$prefs" || { echo "missing in prefs: $key"; status=1; }
done

# keys referenced in code that the schema lacks
# feature names (name: '...'), enum values, signal and class names are not keys
not_keys='^(app-grid-only|hot-corners-changed|panel-button|shell-tweaks.*)$'
for ref in $(grep -hvE "name: '" "$root"/extension.js "$root"/core.js "$root"/modules/*.js "$root"/modules/*/*.js "$root"/prefs.js "$root"/prefs/*.js |
        grep -oE "'((panel|qs|date-menu|overview|app-grid|app-menu|hot-corners|workspaces|windows|shell|wallpaper|module)-[a-z0-9-]+)'" |
        tr -d "'" | sort -u); do
    [[ $ref =~ $not_keys ]] && continue
    printf '%s\n' "${keys[@]}" | grep -qx "$ref" || { echo "not in schema: $ref"; status=1; }
done

[[ $status -eq 0 ]] && echo "keys OK (${#keys[@]} keys)"
exit $status
