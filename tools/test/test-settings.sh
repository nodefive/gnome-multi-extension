#!/usr/bin/env bash
# Test fixture: writes the configuration that cases/checks.js and
# cases/functional.js expect into the isolated test database.
# Only keys of org.gnome.shell.extensions.shell-tweaks are written.
#
# Usage: test-settings.sh --schemadir DIR
set -euo pipefail

SCHEMA=org.gnome.shell.extensions.shell-tweaks
schemadir=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --schemadir) schemadir="$2"; shift 2 ;;
        *) echo "unknown option: $1" >&2; exit 2 ;;
    esac
done
if [[ ! -f $schemadir/gschemas.compiled ]]; then
    echo "no compiled schema in '$schemadir'" >&2
    exit 1
fi

set_key() {
    gsettings --schemadir "$schemadir" set "$SCHEMA" "$1" "$2"
}

for module in panel date-menu overview app-grid app-menu hot-corners workspaces windows shell wallpaper; do
    set_key "module-$module" true
done

# panel, quick settings, shell, windows
set_key panel-activities-button false
set_key panel-notification-icon false
set_key qs-airplane-mode false
set_key qs-dark-mode false
set_key qs-night-light false
set_key shell-animation 5
set_key overview-startup-status 0
set_key windows-switcher-popup-delay false
set_key windows-restore-alt-f5 true

# overview
set_key overview-double-super-to-app-grid false
set_key overview-window-picker-icon false
set_key overview-workspace-switcher false
set_key overview-hide-search-until-typing true
set_key overview-firefox-pip true
set_key overview-super-opens-app-grid true
set_key overview-click-empty-to-close true
set_key overview-click-clears-search-first true

# date menu
set_key date-menu-hide-message-list true
set_key date-menu-hide-scope "'whole-list'"

# hot corners
set_key hot-corners-enabled true
set_key hot-corners-ripple false
set_key hot-corners-top-left-action "'toggle-applications'"
set_key hot-corners-top-right-action "'toggle-overview'"
set_key hot-corners-top-right-fullscreen false
set_key hot-corners-bottom-left-action "'show-desktop-mon'"
set_key hot-corners-bottom-right-action "'screensaver'"

# workspaces
set_key workspaces-panel-scroll true
set_key workspaces-popup false

# app grid
set_key app-grid-max-columns 8
set_key app-grid-max-rows 5
set_key app-grid-icon-font-size 13.0
set_key app-grid-label-style "'font-weight: bold;'"
set_key app-grid-background-mode "'gradient'"
set_key app-grid-background-color "'#0f172a'"
set_key app-grid-gradient-type "'linear-horizontal'"

# app menu
set_key app-menu-hide-item true
set_key app-menu-hide-from-search-item true
set_key app-menu-edit-entry-item true
set_key app-menu-open-location-item true
set_key app-menu-hidden-apps "['jshell-java-openjdk.desktop', 'jconsole-java-openjdk.desktop']"

# wallpaper: button only, no folder
set_key wallpaper-auto-change false
