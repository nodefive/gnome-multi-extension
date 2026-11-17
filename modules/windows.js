// SPDX-License-Identifier: GPL-3.0-only
// Window and switcher behaviour. Ported from Just Perfection (GPL-3.0-only,
// Javad Rahmatzadeh), plus the Alt+F5 restore for tilingshell.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import * as SwitcherPopup from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import * as WindowMenu from 'resource:///org/gnome/shell/ui/windowMenu.js';

import {Module} from '../lib/module.js';

// GNOME 51 altTab.js constants (module-private there)
const WINDOW_PREVIEW_SIZE = 128;
const APP_ICON_SIZE = 96;
const APP_ICON_SIZE_SMALL = 48;
const AppIconMode = {THUMBNAIL_ONLY: 1, APP_ICON_ONLY: 2, BOTH: 3};

const WM_KEYBINDINGS = 'org.gnome.desktop.wm.keybindings';
const ALT_F5 = '<Alt>F5';

function windowClone(actor, size) {
    const [width, height] = actor.get_size();
    const scale = Math.min(1.0, size / width, size / height);
    return new Clutter.Clone({
        source: actor,
        width: width * scale,
        height: height * scale,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        y_expand: true,
    });
}

export class WindowsModule extends Module {
    static get key() {
        return 'module-windows';
    }

    features() {
        return [
            {
                name: 'windows-switcher-popup-delay',
                keys: ['windows-switcher-popup-delay'],
                apply(lc, s) {
                    if (s.get_boolean('windows-switcher-popup-delay'))
                        return;
                    lc.override(SwitcherPopup.SwitcherPopup.prototype, 'show', original =>
                        function (...args) {
                            const shown = original.call(this, ...args);
                            if (shown)
                                this._showImmediately();
                            return shown;
                        });
                },
            },
            {
                name: 'windows-alt-tab-sizes',
                keys: [
                    'windows-alt-tab-icon-size', 'windows-alt-tab-small-icon-size',
                    'windows-alt-tab-window-preview-size',
                ],
                apply(lc, s) {
                    const iconSize = s.get_int('windows-alt-tab-icon-size');
                    const smallSize = s.get_int('windows-alt-tab-small-icon-size');
                    const previewSize = s.get_int('windows-alt-tab-window-preview-size');
                    if (!iconSize && !smallSize && !previewSize)
                        return;
                    const sizes = {
                        icon: iconSize || APP_ICON_SIZE,
                        small: smallSize || APP_ICON_SIZE_SMALL,
                        preview: previewSize || WINDOW_PREVIEW_SIZE,
                    };

                    // The sizes are module constants in altTab.js; rebuild the
                    // icon box with ours after GNOME built it.
                    lc.override(AltTab.WindowIcon.prototype, '_init', original =>
                        function (window, mode) {
                            original.call(this, window, mode);
                            const actor = window.get_compositor_private();
                            const {scaleFactor} = St.ThemeContext.get_for_stage(global.stage);
                            let size;
                            this._icon.destroy_all_children();
                            switch (mode) {
                            case AppIconMode.THUMBNAIL_ONLY:
                                size = sizes.preview;
                                this._icon.add_child(windowClone(actor, size * scaleFactor));
                                break;
                            case AppIconMode.BOTH:
                                size = sizes.preview;
                                this._icon.add_child(windowClone(actor, size * scaleFactor));
                                if (this.app)
                                    this._icon.add_child(this._createAppIcon(this.app, sizes.small));
                                break;
                            case AppIconMode.APP_ICON_ONLY:
                            default:
                                size = sizes.icon;
                                this._icon.add_child(this._createAppIcon(this.app, size));
                            }
                            this._icon.set_size(size * scaleFactor, size * scaleFactor);
                        });
                },
            },
            {
                name: 'windows-menu',
                keys: ['windows-menu'],
                apply(lc, s) {
                    if (s.get_boolean('windows-menu'))
                        return;
                    lc.override(WindowMenu.WindowMenuManager.prototype, 'showWindowMenuForWindow', () =>
                        window => {
                            window.focus(global.get_current_time());
                            window.raise();
                        });
                },
            },
            {
                name: 'windows-menu-screenshot-item',
                keys: ['windows-menu-screenshot-item'],
                apply(lc, s) {
                    if (s.get_boolean('windows-menu-screenshot-item'))
                        return;
                    lc.override(WindowMenu.WindowMenu.prototype, '_buildMenu', original =>
                        function (window) {
                            original.call(this, window);
                            // "Take Screenshot" is the first entry GNOME adds
                            this.firstMenuItem?.hide();
                        });
                },
            },
            {
                name: 'windows-demands-attention-focus',
                keys: ['windows-demands-attention-focus'],
                apply(lc, s) {
                    if (!s.get_boolean('windows-demands-attention-focus'))
                        return;
                    // Block GNOME's "is ready" notification handlers and focus instead.
                    const display = global.display;
                    for (const signal of ['window-demands-attention', 'window-marked-urgent']) {
                        const id = GObject.signal_handler_find(display, {signalId: signal});
                        if (id) {
                            GObject.signal_handler_block(display, id);
                            lc.defer(() => GObject.signal_handler_unblock(display, id));
                        }
                        lc.connect(display, signal, (_display, window) => {
                            if (window && !window.has_focus() && !window.is_skip_taskbar())
                                Main.activateWindow(window);
                        });
                    }
                },
            },
            {
                name: 'windows-maximized-on-create',
                keys: ['windows-maximized-on-create'],
                apply(lc, s) {
                    if (!s.get_boolean('windows-maximized-on-create'))
                        return;
                    lc.connect(global.display, 'window-created', (_display, window) => {
                        if (window.can_maximize())
                            window.maximize();
                    });
                },
            },
            {
                name: 'windows-restore-alt-f5',
                keys: ['windows-restore-alt-f5'],
                apply(lc, s) {
                    if (!s.get_boolean('windows-restore-alt-f5'))
                        return;
                    // tilingshell empties `unmaximize` when it enables; keep Alt+F5
                    // there. On revert, undo only our own write.
                    const wm = new Gio.Settings({schema_id: WM_KEYBINDINGS});
                    let before = null;
                    let written = null;
                    const ensure = () => {
                        const current = wm.get_strv('unmaximize');
                        if (current.includes(ALT_F5))
                            return;
                        before = current;
                        written = [...current, ALT_F5];
                        wm.set_strv('unmaximize', written);
                    };
                    lc.defer(() => {
                        if (written === null)
                            return;
                        const current = wm.get_strv('unmaximize');
                        if (current.length === written.length && current.every((v, i) => v === written[i]))
                            wm.set_strv('unmaximize', before);
                    });
                    lc.connect(wm, 'changed::unmaximize', ensure);
                    ensure();
                },
            },
        ];
    }
}
