// SPDX-License-Identifier: GPL-3.0-only

import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const CLASS_PREFIX = 'shell-tweaks-';

/**
 * Run `callback(item)` once the quick settings indicator `name` exists.
 * The quick settings menu builds its indicators asynchronously at startup.
 */
export function onQuickSettingsItem(lc, name, callback) {
    const quickSettings = Main.panel.statusArea.quickSettings;
    if (quickSettings[name]) {
        callback(quickSettings[name]);
        return;
    }

    let id = 0;
    id = quickSettings._indicators.connect('child-added', () => {
        if (!quickSettings[name])
            return;
        quickSettings._indicators.disconnect(id);
        id = 0;
        callback(quickSettings[name]);
    });
    lc.defer(() => {
        if (id)
            quickSettings._indicators.disconnect(id);
    });
}

/**
 * Some style properties (for example -natural-hpadding) do not trigger a
 * restyle on their own. Toggling a class with real rules forces one.
 */
export function refreshStyles() {
    const uiGroup = Main.layoutManager.uiGroup;
    const className = `${CLASS_PREFIX}refresh-styles`;
    uiGroup.add_style_class_name(className);
    uiGroup.remove_style_class_name(className);
}

export function walkActors(actor, callback) {
    callback(actor);
    for (const child of actor.get_children())
        walkActors(child, callback);
}

export function appDisplay() {
    return Main.overview._overview?._controls?._appDisplay ?? null;
}

let _redisplayId = 0;

/**
 * Rebuild the app grid once per main loop iteration, however many
 * features ask for it.
 */
export function queueAppGridRedisplay() {
    if (_redisplayId)
        return;
    _redisplayId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        _redisplayId = 0;
        appDisplay()?._redisplay();
        return GLib.SOURCE_REMOVE;
    });
}

export function cancelAppGridRedisplay() {
    if (_redisplayId) {
        GLib.source_remove(_redisplayId);
        _redisplayId = 0;
    }
}

export function primaryMonitor() {
    return Main.layoutManager.primaryMonitor;
}

export function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function hexToCss(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (alpha >= 1)
        return `rgb(${r}, ${g}, ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, alpha)})`;
}
