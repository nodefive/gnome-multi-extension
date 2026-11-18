#!/usr/bin/env bash
# Headless test of Shell Tweaks in a throwaway GNOME Shell.
#
# Isolation: own D-Bus session (dbus-run-session) and temporary XDG config,
# data, cache, state and runtime directories, so the real dconf database,
# ~/.local/share and caches are never written. The Shell runs headless with a
# virtual monitor and without Xwayland: no DRM, no logind session takeover.
#
# Usage: run-headless.sh [REPORT_DIR]
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
report="${1:-$here/../../test-report}"
mkdir -p "$report"
report="$(cd "$report" && pwd)"

scratch="$(mktemp -d "${TMPDIR:-/tmp}/shell-tweaks-test.XXXXXX")"
# sockets live in the runtime dir; unix socket paths are limited to 108 bytes
runtime="$(mktemp -d "${XDG_RUNTIME_DIR:-/tmp}/st-test.XXXXXX")"
chmod 700 "$runtime"

stop_leftovers() {
    # stop anything still running from the isolated session
    for pid in $(grep -lz "XDG_RUNTIME_DIR=$runtime" /proc/[0-9]*/environ 2>/dev/null | cut -d/ -f3); do
        [[ $pid != "$$" ]] && kill "$pid" 2>/dev/null
    done
    sleep 1
}

cleanup() {
    stop_leftovers
    rm -rf "$scratch" "$runtime"
}
trap cleanup EXIT

run_mode() {
    local mode="$1"
    stop_leftovers
    rm -rf "$scratch"/{config,data,cache,state,userapps} "${runtime:?}"/*
    mkdir -p "$scratch"/{config,data,cache,state}
    # optional: the user's own .desktop files, read-only through a link, so
    # folders hold the same apps as in the session
    local data_dirs="${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
    if [[ ${USER_APPS:-0} == 1 ]]; then
        mkdir -p "$scratch/userapps"
        ln -sfn "$HOME/.local/share/applications" "$scratch/userapps/applications"
        data_dirs="$scratch/userapps:$data_dirs"
    fi
    # no seat/session variables: the headless Shell must not attach to the
    # real logind session
    env -u WAYLAND_DISPLAY -u DISPLAY -u DBUS_SESSION_BUS_ADDRESS \
        -u XDG_SESSION_ID -u XDG_SEAT -u XDG_VTNR -u XDG_SESSION_CLASS \
        -u SESSION_MANAGER -u GNOME_SETUP_DISPLAY \
        XDG_CONFIG_HOME="$scratch/config" \
        XDG_DATA_HOME="$scratch/data" \
        XDG_CACHE_HOME="$scratch/cache" \
        XDG_STATE_HOME="$scratch/state" \
        XDG_RUNTIME_DIR="$runtime" \
        XDG_SESSION_TYPE=wayland \
        XDG_DATA_DIRS="$data_dirs" VMON="${VMON:-}" \
        SEED_DCONF="${SEED_DCONF:-}" THEME="${THEME:-}" TEST_IMAGE="${TEST_IMAGE:-}" \
        dbus-run-session -- "$here/inside.sh" "$report" "$mode"
}

for mode in ${MODES:-live coldstart}; do run_mode "$mode"; done

echo "report in $report"
