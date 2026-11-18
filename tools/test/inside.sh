#!/usr/bin/env bash
# Runs inside dbus-run-session with isolated XDG directories (see run-headless.sh).
# Usage: inside.sh REPORT_DIR MODE
#   MODE: live | coldstart | probe | reload | burst | folders | background | measure
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
build="$(cd "$here/../.." && pwd)"
report="$1"
mode="$2"
uuid=shell-tweaks@unl0cker
helper=st-test-helper@local
shell_log="$report/gnome-shell-$mode.log"
results="$report/results-$mode.txt"
: > "$results"

say() { echo "== $*" | tee -a "$results"; }
eval_case() { gjs -m "$here/eval.js" "$here/cases/$1" "${@:2}"; }

ext_dir="$XDG_DATA_HOME/gnome-shell/extensions"
"$build/tools/install-dev.sh" "$ext_dir" >/dev/null
mkdir -p "$ext_dir/$helper"
cp "$here/helper/"* "$ext_dir/$helper/"

# Optionally seed the isolated dconf with a dump of a real configuration so
# the test Shell resembles that session, then write the test settings on top.
# SETTINGS_SCRIPT is called with --schemadir DIR (default: test-settings.sh).
if [[ -f ${SEED_DCONF:-} ]]; then
    dconf load / < "$SEED_DCONF"
fi
settings_script="${SETTINGS_SCRIPT:-$here/test-settings.sh}"
[[ $mode == measure ]] || "$settings_script" --schemadir "$ext_dir/$uuid/schemas" >/dev/null
gsettings set org.gnome.shell disable-user-extensions false
gsettings set org.gnome.shell welcome-dialog-last-shown-version "'999'"
gsettings set org.gnome.shell disabled-extensions "@as []"
if [[ $mode == coldstart ]]; then
    gsettings set org.gnome.shell enabled-extensions "['$helper', '$uuid']"
else
    gsettings set org.gnome.shell enabled-extensions "['$helper']"
fi

gnome-shell --headless --no-x11 --wayland --virtual-monitor "${VMON:-1920x1080}" > "$shell_log" 2>&1 &
shell_pid=$!

ready=0
for _ in $(seq 1 60); do
    sleep 1
    if out=$(eval_case ready.js 2>/dev/null) && [[ $out == true ]]; then
        ready=1
        break
    fi
done
if [[ $ready -ne 1 ]]; then
    say "shell did not become ready"
    kill "$shell_pid" 2>/dev/null
    exit 1
fi

if [[ $mode == burst ]]; then
    gnome-extensions enable "$uuid"
    sleep 3
    st_set() { gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks "$@"; }
    st_set debug true
    sleep 1
    before=$(grep -c 'shell-tweaks\[folder\]' "$shell_log")
    for v in 0.10 0.11 0.12 0.13 0.14 0.15 0.16 0.17 0.18 0.19; do
        st_set app-grid-folder-tile-background-opacity "$v"
        sleep 0.05
    done
    sleep 1.5
    after=$(grep -c 'shell-tweaks\[folder\]' "$shell_log")
    say "burst: 10 changes"
    echo "{\"name\":\"folder layout lines logged after 10 quick changes\",\"ok\":true,\"detail\":$((after - before))}" >> "$results"
    final=$(gsettings --schemadir "$ext_dir/$uuid/schemas" get org.gnome.shell.extensions.shell-tweaks app-grid-folder-tile-background-opacity)
    echo "{\"name\":\"final value kept\",\"ok\":$([[ $final == 0.19* ]] && echo true || echo false),\"detail\":\"$final\"}" >> "$results"
elif [[ $mode == background ]]; then
    gnome-extensions enable "$uuid"
    sleep 3
    st_set() { gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks "$@"; }
    st_set app-grid-hover-tile-enabled true
    st_set app-grid-hover-tile-background-opacity 0.3
    say "background: image"
    st_set app-grid-background-image "${TEST_IMAGE:?}"
    st_set app-grid-background-mode image
    eval_case background-state.js >> "$results"
    say "background: image with tint"
    st_set app-grid-background-tint-color "'#102030'"
    st_set app-grid-background-tint-opacity 0.5
    eval_case background-state.js >> "$results"
    say "background: current wallpaper"
    st_set app-grid-background-mode wallpaper
    eval_case background-state.js >> "$results"
    say "background: wallpaper changed"
    gsettings set org.gnome.desktop.background picture-uri "'file://${TEST_IMAGE}'"
    gsettings set org.gnome.desktop.background picture-uri-dark "'file://${TEST_IMAGE}'"
    eval_case background-state.js >> "$results"
    say "folder tile probe"
    eval_case folder-tile-probe.js >> "$results"
    say "hover probe"
    eval_case hover-probe.js >> "$results"
    say "render probe"
    eval_case render-probe.js IMAGE="$TEST_IMAGE" >> "$results"
    say "background: back to theme"
    st_set app-grid-background-mode system
    eval_case background-state.js >> "$results"
elif [[ $mode == reload ]]; then
    gnome-extensions enable "$uuid"
    sleep 3
    copy="$XDG_STATE_HOME/build-copy"
    for n in 1 2; do
        rsync -a --delete --exclude=.git --exclude=test-report --exclude=dist "$build/" "$copy/"
        sed -i "s|^    enable() {$|    enable() {\n        console.log('RELOAD-MARKER-$n');|" "$copy/core.js"
        say "reload $n"
        "$copy/tools/reload.sh" >> "$results" 2>&1 || true
        sleep 2
        grep -q "RELOAD-MARKER-$n" "$shell_log" && echo "{\"name\":\"new code runs after reload $n\",\"ok\":true}" >> "$results" ||
            echo "{\"name\":\"new code runs after reload $n\",\"ok\":false}" >> "$results"
    done
    say "checks after reloads"
    eval_case checks.js >> "$results"
    ls "$ext_dir/$uuid/versions" >> "$results"
elif [[ $mode == measure ]]; then
    # SEED_DCONF is a dump of the current settings; keep them, no migration
    gnome-extensions enable "$uuid"
    sleep 3
    [[ -n ${THEME:-} ]] && eval_case load-theme.js THEME="$THEME" >/dev/null && sleep 2
    say "measure folder popups"
    eval_case folder-measure.js >> "$results"
elif [[ $mode == folders ]]; then
    gnome-extensions enable "$uuid"
    sleep 3
    st_set() { gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks "$@"; }
    say "folders: test settings (min width 640, no other limits)"
    eval_case folder-geometry.js >> "$results"
    say "folders: fixed 400x300"
    st_set app-grid-folder-popup-fixed-width 400
    st_set app-grid-folder-popup-fixed-height 300
    st_set app-grid-folder-popup-fixed-size true
    eval_case folder-geometry.js >> "$results"
    say "folders: fixed 900x700"
    st_set app-grid-folder-popup-fixed-width 900
    st_set app-grid-folder-popup-fixed-height 700
    eval_case folder-geometry.js >> "$results"
    say "folders: fixed size off again"
    st_set app-grid-folder-popup-fixed-size false
    eval_case folder-geometry.js >> "$results"
elif [[ $mode == probe ]]; then
    say "probe without the extension"
    eval_case probe-overview.js STEPS=toggle,hide,toggle,hide >> "$results"
    gnome-extensions enable "$uuid"
    sleep 3
    say "probe with the extension"
    eval_case probe-overview.js STEPS=super,super,toggle,hide >> "$results"
elif [[ $mode == coldstart ]]; then
    say "coldstart checks"
    eval_case checks.js >> "$results"
    say "coldstart overview state after login"
    eval_case state.js >> "$results"
    say "coldstart startup feature"
    eval_case probe-startup.js >> "$results"
else
    say "snapshot base"
    eval_case snapshot.js LABEL=base > "$report/snapshot-base.json"

    for cycle in 1 2 3; do
        gnome-extensions enable "$uuid"
        sleep 3
        say "cycle $cycle: checks"
        eval_case checks.js >> "$results"
        if [[ $cycle -eq 1 ]]; then
            say "cycle $cycle: functional"
            eval_case functional.js >> "$results"
            say "cycle $cycle: module toggles"
            for module in panel date-menu overview app-grid app-menu hot-corners workspaces windows shell wallpaper; do
                gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks "module-$module" false
                sleep 0.5
                gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks "module-$module" true
                sleep 0.5
            done
            say "cycle $cycle: feature changes"
            gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks app-grid-max-rows 4
            gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks date-menu-hide-scope notifications-only
            gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks panel-position 1
            gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks panel-visible false
            sleep 1
            gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks panel-visible true
            gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks panel-position 0
            gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks date-menu-hide-scope whole-list
            gsettings --schemadir "$ext_dir/$uuid/schemas" set org.gnome.shell.extensions.shell-tweaks app-grid-max-rows 5
            sleep 1
            say "cycle $cycle: checks after toggles"
            eval_case checks.js >> "$results"
            eval_case snapshot.js LABEL=on > "$report/snapshot-on.json"
        fi
        gnome-extensions disable "$uuid"
        sleep 2
        eval_case snapshot.js LABEL=off > "$report/snapshot-off-$cycle.json"
    done

    say "preferences window"
    gnome-extensions prefs "$uuid" >> "$results" 2>&1
    sleep 6
    pkill -f 'org.gnome.Shell.Extensions' 2>/dev/null
fi

say "extension info"
gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell \
    --method org.gnome.Shell.Extensions.GetExtensionInfo "$uuid" >> "$results" 2>&1

kill "$shell_pid" 2>/dev/null
wait "$shell_pid" 2>/dev/null
exit 0
