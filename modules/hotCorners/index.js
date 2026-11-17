// SPDX-License-Identifier: GPL-3.0-only
// Hot corners on the primary monitor. Corner, trigger, keybinding and panel
// menu logic ported from Custom Hot Corners - Extended (GPL-3.0, GdH).

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Layout from 'resource:///org/gnome/shell/ui/layout.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Ripples from 'resource:///org/gnome/shell/ui/ripples.js';

import {Module} from '../../lib/module.js';
import {ACTION_IDS, CORNERS} from '../../lib/actionList.js';
import {Actions} from './actions.js';

const PRESSURE_TIMEOUT = 1000;
// actions meant to repeat while the pointer keeps pushing
const REPEATABLE = new Set(['volume-up', 'volume-down', 'display-brightness-up', 'display-brightness-down']);

const CORNER_KEYS = CORNERS.flatMap(({id}) => [
    `hot-corners-${id}-action`, `hot-corners-${id}-command`, `hot-corners-${id}-fullscreen`,
    `hot-corners-${id}-ctrl-action`, `hot-corners-${id}-ctrl-command`, `hot-corners-${id}-ctrl-fullscreen`,
]);

const BUILD_KEYS = [
    ...CORNER_KEYS,
    'hot-corners-enabled', 'hot-corners-require-shift', 'hot-corners-ripple',
    'hot-corners-barrier-size-h', 'hot-corners-barrier-size-v', 'hot-corners-pressure-threshold',
    'hot-corners-action-delay', 'hot-corners-corners-visible', 'hot-corners-barrier-fallback',
];

function modifiers() {
    const [, , mods] = global.get_pointer();
    return mods;
}

function readTrigger(s, id, prefix) {
    const action = s.get_string(`hot-corners-${id}-${prefix}action`);
    return {
        action: ACTION_IDS.has(action) ? action : 'disabled',
        command: s.get_string(`hot-corners-${id}-${prefix}command`),
        fullscreen: s.get_boolean(`hot-corners-${id}-${prefix}fullscreen`),
    };
}

/**
 * A corner on the primary monitor: two pointer barriers feeding a pressure
 * detector, or a 3px reactive actor with barrier fallback. It provides the
 * destroy()/setBarrierSize() interface the layout manager expects.
 */
class Corner {
    constructor(spec, monitor, options, onTrigger) {
        this.spec = spec;
        this.monitor = monitor;
        this.x = spec.left ? monitor.x : monitor.x + monitor.width - 1;
        this.y = spec.top ? monitor.y : monitor.y + monitor.height - 1;
        this._actors = [];
        this._barriers = [];

        this._ripples = new Ripples.Ripples(0, 0, 'ripple-box');
        this._ripples.addTo(Main.layoutManager.uiGroup);
        const ltr = Clutter.get_default_text_direction() === Clutter.TextDirection.LTR;
        let angle;
        if (spec.left && ltr)
            angle = spec.top ? 0 : 270;
        else
            angle = spec.top ? 90 : 180;
        for (const ripple of [this._ripples._ripple1, this._ripples._ripple2, this._ripples._ripple3])
            ripple.rotation_angle_z = angle;

        if (options.fallback) {
            const actor = new Clutter.Actor({
                name: 'shell-tweaks-hot-corner',
                x: this.x - (spec.left ? 0 : 2),
                y: this.y - (spec.top ? 0 : 2),
                width: 3,
                height: 3,
                reactive: true,
                background_color: this._debugColor(options.visible, 255, 120, 0),
            });
            actor.connect('enter-event', () => onTrigger(this));
            Main.layoutManager.addTopChrome(actor);
            this._actors.push(actor);
            return;
        }

        this._pressure = new Layout.PressureBarrier(options.threshold, PRESSURE_TIMEOUT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW);
        this._pressure.connect('trigger', () => onTrigger(this));

        const sizeH = Math.max(1, Math.floor(options.sizeH / 100 * monitor.width));
        const sizeV = Math.max(1, Math.floor(options.sizeV / 100 * monitor.height));
        const D = Meta.BarrierDirection;
        const vertical = new Meta.Barrier({
            backend: global.backend,
            x1: this.x, x2: this.x,
            y1: this.y, y2: spec.top ? this.y + sizeV : this.y - sizeV,
            directions: spec.left ? D.POSITIVE_X : D.NEGATIVE_X,
        });
        const horizontal = new Meta.Barrier({
            backend: global.backend,
            x1: this.x, x2: spec.left ? this.x + sizeH : this.x - sizeH,
            y1: this.y, y2: this.y,
            directions: spec.top ? D.POSITIVE_Y : D.NEGATIVE_Y,
        });
        for (const barrier of [vertical, horizontal]) {
            this._pressure.addBarrier(barrier);
            this._barriers.push(barrier);
        }

        if (options.visible)
            this._drawBarriers(sizeH, sizeV);
    }

    _debugColor(visible, red, green, blue) {
        return new Cogl.Color({red, green, blue, alpha: visible ? 180 : 0});
    }

    _drawBarriers(sizeH, sizeV) {
        const {left, top} = this.spec;
        const lines = [
            {x: this.x - (left ? 0 : sizeH), y: this.y + (top ? 1 : -1), width: sizeH, height: 1},
            {x: this.x + (left ? 1 : -1), y: this.y - (top ? 0 : sizeV), width: 1, height: sizeV},
        ];
        for (const geometry of lines) {
            const actor = new Clutter.Actor({
                ...geometry,
                reactive: false,
                background_color: this._debugColor(true, 0, 255, 0),
            });
            Main.layoutManager.addTopChrome(actor);
            this._actors.push(actor);
        }
    }

    playRipple() {
        this._ripples.playAnimation(this.x, this.y);
    }

    // The layout manager resizes native corners when the panel changes.
    setBarrierSize() {
    }

    destroy() {
        if (this._pressure) {
            for (const barrier of this._barriers)
                this._pressure.removeBarrier(barrier);
            this._pressure.destroy();
            this._pressure = null;
        }
        for (const barrier of this._barriers)
            barrier.destroy();
        this._barriers = [];
        for (const actor of this._actors)
            actor.destroy();
        this._actors = [];
        this._ripples?.destroy();
        this._ripples = null;
    }
}

/** Global accelerators bound through Mutter, as GSConnect and CHC do. */
class Keybindings {
    constructor() {
        this._bindings = new Map();
        this._id = global.display.connect('accelerator-activated', (_display, action) => {
            try {
                this._bindings.get(action)?.callback();
            } catch (e) {
                logError(e, 'shell-tweaks: shortcut');
            }
        });
    }

    add(accelerator, callback) {
        const action = global.display.grab_accelerator(accelerator, Meta.KeyBindingFlags.NONE);
        if (action === Meta.KeyBindingAction.NONE) {
            console.warn(`shell-tweaks: could not bind ${accelerator}`);
            return;
        }
        const name = Meta.external_binding_name_for_action(action);
        Main.wm.allowKeybinding(name, Shell.ActionMode.ALL);
        this._bindings.set(action, {name, callback});
    }

    destroy() {
        for (const [action, {name}] of this._bindings) {
            global.display.ungrab_accelerator(action);
            Main.wm.allowKeybinding(name, Shell.ActionMode.NONE);
        }
        this._bindings.clear();
        global.display.disconnect(this._id);
    }
}

// A unique type name per load: tools/reload.sh imports this module again
// and GObject type names cannot be registered twice.
const MenuButton = GObject.registerClass({
    GTypeName: `ShellTweaksHotCornersButton_${GLib.uuid_string_random().replaceAll('-', '')}`,
}, class ShellTweaksHotCornersButton extends PanelMenu.Button {
    _init(settings, extension) {
        super._init(0.5, 'Shell Tweaks Hot Corners', false);
        this._settings = settings;

        this._icon = new St.Icon({style_class: 'system-status-icon'});
        this.add_child(this._icon);

        this._disableItem = new PopupMenu.PopupMenuItem('Disable all corners');
        this._disableItem.connect('activate', () =>
            settings.set_boolean('hot-corners-enabled', !settings.get_boolean('hot-corners-enabled')));
        this._shiftItem = new PopupMenu.PopupMenuItem('Corners require Shift');
        this._shiftItem.connect('activate', () =>
            settings.set_boolean('hot-corners-require-shift', !settings.get_boolean('hot-corners-require-shift')));
        const resetItem = new PopupMenu.PopupMenuItem('Re-create corners');
        resetItem.connect('activate', () => Main.layoutManager._updateHotCorners());
        const prefsItem = new PopupMenu.PopupMenuItem('Settings');
        prefsItem.connect('activate', () => extension.openPreferences());

        this.menu.addMenuItem(this._disableItem);
        this.menu.addMenuItem(this._shiftItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(resetItem);
        this.menu.addMenuItem(prefsItem);

        this._changedId = settings.connect('changed', (_s, key) => {
            if (key === 'hot-corners-enabled' || key === 'hot-corners-require-shift')
                this._sync();
        });
        this.connect('destroy', () => settings.disconnect(this._changedId));
        this._sync();
    }

    _sync() {
        const enabled = this._settings.get_boolean('hot-corners-enabled');
        const shift = this._settings.get_boolean('hot-corners-require-shift');
        this._disableItem.setOrnament(enabled ? PopupMenu.Ornament.NONE : PopupMenu.Ornament.CHECK);
        this._shiftItem.setOrnament(shift ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        this._icon.gicon = new Gio.ThemedIcon({
            name: enabled ? 'input-mouse-symbolic' : 'action-unavailable-symbolic',
        });
    }
});

export class HotCornersModule extends Module {
    static get key() {
        return 'module-hot-corners';
    }

    onEnable(lc) {
        this.actions = new Actions(this.settings);
        lc.defer(() => {
            this.actions.clean();
            this.actions = null;
        });
    }

    features() {
        const module = this;
        return [
            {
                name: 'hot-corners',
                keys: BUILD_KEYS,
                apply(lc, s) {
                    const layoutManager = Main.layoutManager;
                    let unredirectDisabled = false;
                    let removedPanelBarrier = false;
                    const lastRun = new Map();

                    const setUnredirect = disable => {
                        if (disable === unredirectDisabled)
                            return;
                        if (disable)
                            global.compositor.disable_unredirect();
                        else
                            global.compositor.enable_unredirect();
                        unredirectDisabled = disable;
                    };

                    const onTrigger = corner => {
                        const mods = modifiers();
                        const ctrl = (mods & Clutter.ModifierType.CONTROL_MASK) !== 0;
                        if (!ctrl && s.get_boolean('hot-corners-require-shift') &&
                            (mods & Clutter.ModifierType.SHIFT_MASK) === 0)
                            return;

                        const trigger = readTrigger(s, corner.spec.id, ctrl ? 'ctrl-' : '');
                        if (trigger.action === 'disabled')
                            return;

                        const now = Date.now();
                        const last = lastRun.get(corner) ?? 0;
                        if (!REPEATABLE.has(trigger.action) && now - last <= s.get_int('hot-corners-action-delay'))
                            return;
                        lastRun.set(corner, now);

                        if (corner.monitor.inFullscreen && !trigger.fullscreen)
                            return;
                        if (s.get_boolean('hot-corners-ripple'))
                            corner.playRipple();
                        module.actions?.run(trigger.action, {command: trigger.command});
                    };

                    const build = () => {
                        layoutManager.hotCorners.forEach(corner => corner?.destroy());
                        layoutManager.hotCorners = [];

                        const monitor = layoutManager.primaryMonitor;
                        if (!s.get_boolean('hot-corners-enabled') || !monitor) {
                            setUnredirect(false);
                            layoutManager.emit('hot-corners-changed');
                            return;
                        }

                        const options = {
                            threshold: s.get_int('hot-corners-pressure-threshold'),
                            sizeH: s.get_int('hot-corners-barrier-size-h'),
                            sizeV: s.get_int('hot-corners-barrier-size-v'),
                            visible: s.get_boolean('hot-corners-corners-visible'),
                            fallback: s.get_boolean('hot-corners-barrier-fallback'),
                        };

                        let fullscreenNeeded = false;
                        for (const spec of CORNERS) {
                            const triggers = [readTrigger(s, spec.id, ''), readTrigger(s, spec.id, 'ctrl-')]
                                .filter(t => t.action !== 'disabled');
                            if (!triggers.length)
                                continue;
                            fullscreenNeeded ||= triggers.some(t => t.fullscreen);
                            layoutManager.hotCorners.push(new Corner(spec, monitor, options, onTrigger));

                            // the panel's right-edge barrier sits on top of a top-right corner
                            if (spec.top && !spec.left && layoutManager._rightPanelBarrier) {
                                layoutManager._destroyPanelBarrier();
                                removedPanelBarrier = true;
                            }
                        }

                        // corners that fire in fullscreen need the compositor to keep
                        // drawing fullscreen windows (no unredirection)
                        setUnredirect(fullscreenNeeded);
                        layoutManager.emit('hot-corners-changed');
                    };

                    // Registered first so it runs last, after our _updateHotCorners
                    // is removed: rebuild GNOME's own corners and panel barrier.
                    lc.defer(() => {
                        layoutManager.hotCorners.forEach(corner => corner?.destroy());
                        layoutManager.hotCorners = [];
                        setUnredirect(false);
                        if (removedPanelBarrier)
                            layoutManager._updatePanelBarrier();
                        layoutManager._updateHotCorners();
                    });

                    lc.set(layoutManager, '_updateHotCorners', build);
                    // GNOME binds the original method to this setting at startup
                    lc.connectAfter(layoutManager._interfaceSettings, 'changed::enable-hot-corners', build);
                    build();
                },
            },
            {
                name: 'hot-corners-shortcuts',
                keys: ['hot-corners-keyboard-shortcuts'],
                apply(lc, s) {
                    const entries = s.get_strv('hot-corners-keyboard-shortcuts');
                    if (!entries.length)
                        return;
                    const bindings = new Keybindings();
                    lc.defer(() => bindings.destroy());
                    for (const entry of entries) {
                        const [action, accelerator] = entry.split(' ');
                        if (ACTION_IDS.has(action) && action !== 'disabled' && accelerator)
                            bindings.add(accelerator, () => module.actions?.run(action));
                    }
                },
            },
            {
                name: 'hot-corners-panel-menu',
                keys: ['hot-corners-panel-menu'],
                apply(lc, s) {
                    if (!s.get_boolean('hot-corners-panel-menu'))
                        return;
                    const button = new MenuButton(s, module.extension);
                    Main.panel.addToStatusArea('shell-tweaks-hot-corners', button, 0, 'right');
                    lc.defer(() => button.destroy());
                },
            },
        ];
    }
}
