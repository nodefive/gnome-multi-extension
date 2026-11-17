// SPDX-License-Identifier: GPL-3.0-only
// Shell-wide tweaks. Ported from Just Perfection (GPL-3.0-only, Javad Rahmatzadeh).

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BackgroundMenu from 'resource:///org/gnome/shell/ui/backgroundMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as OsdWindow from 'resource:///org/gnome/shell/ui/osdWindow.js';

import {Module} from '../lib/module.js';
import {CLASS_PREFIX} from '../lib/shell.js';

// animation setting: 0 off, 1 default, 2.. these slow-down factors
const ANIMATION_FACTORS = [0.01, 0.2, 0.6, 0.8, 1.3, 1.6, 2.8];

const {START, CENTER, END} = Clutter.ActorAlign;
// [x, y] for positions 0..8: top, bottom and middle rows, each start/center/end
const POSITIONS = [
    [START, START], [CENTER, START], [END, START],
    [START, END], [CENTER, END], [END, END],
    [START, CENTER], [CENTER, CENTER], [END, CENTER],
];

export class ShellModule extends Module {
    static get key() {
        return 'module-shell';
    }

    features() {
        return [
            {
                name: 'shell-animation',
                keys: ['shell-animation'],
                apply(lc, s) {
                    const value = s.get_int('shell-animation');
                    if (value === 1)
                        return;
                    if (value === 0) {
                        const iface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
                        const previous = iface.get_boolean('enable-animations');
                        iface.set_boolean('enable-animations', false);
                        lc.defer(() => iface.set_boolean('enable-animations', previous));
                        return;
                    }
                    const factor = ANIMATION_FACTORS[value - 2];
                    if (factor === undefined)
                        return;
                    const stSettings = St.Settings.get();
                    const previous = stSettings.slow_down_factor;
                    stSettings.slow_down_factor = factor;
                    lc.defer(() => {
                        stSettings.slow_down_factor = previous;
                    });
                },
            },
            {
                name: 'shell-osd',
                keys: ['shell-osd'],
                apply(lc, s) {
                    if (s.get_boolean('shell-osd'))
                        return;
                    const manager = Main.osdWindowManager;
                    for (const method of ['show', 'showOne', 'showAll'])
                        lc.set(manager, method, () => {});
                },
            },
            {
                name: 'shell-osd-position',
                keys: ['shell-osd-position'],
                apply(lc, s) {
                    const value = s.get_int('shell-osd-position');
                    if (value === 0 || !POSITIONS[value - 1])
                        return;
                    const position = value - 1;
                    const [xAlign, yAlign] = POSITIONS[position];
                    const windows = Main.osdWindowManager._osdWindows;
                    const originals = windows.map(w => [w.x_align, w.y_align]);

                    lc.override(OsdWindow.OsdWindow.prototype, 'show', original => function () {
                        this.x_align = xAlign;
                        this.y_align = yAlign;
                        original.call(this);
                    });
                    lc.defer(() => windows.forEach((w, i) => {
                        if (originals[i])
                            [w.x_align, w.y_align] = originals[i];
                    }));

                    const row = position < 3 ? 'top' : position < 6 ? 'bottom' : 'center';
                    lc.addUiClass(`${CLASS_PREFIX}osd-position-${row}`);
                },
            },
            {
                name: 'shell-notification-banner-position',
                keys: ['shell-notification-banner-position'],
                apply(lc, s) {
                    const position = s.get_int('shell-notification-banner-position');
                    if (position === 1 || !POSITIONS[position] || position > 5)
                        return;
                    const tray = Main.messageTray;
                    const bin = tray._bannerBin;
                    const [xAlign, yAlign] = POSITIONS[position];

                    const previousX = tray.bannerAlignment;
                    const previousY = bin.get_y_align();
                    lc.defer(() => {
                        tray.bannerAlignment = previousX;
                        bin.set_y_align(previousY);
                    });
                    tray.bannerAlignment = xAlign;
                    bin.set_y_align(yAlign);

                    if (yAlign === END) {
                        // GNOME's hide animation slides up with EASE_OUT_BACK, which
                        // glitches at the bottom; slide down with EASE instead.
                        const {State, ANIMATION_TIME} = MessageTray;
                        lc.set(tray, '_hideNotification', function (animate) {
                            this._notificationFocusGrabber.ungrabFocus();
                            this._banner.disconnectObject(this);
                            this._resetNotificationLeftTimeout();
                            this._bannerBin.remove_all_transitions();

                            const duration = animate ? ANIMATION_TIME : 0;
                            this._notificationState = State.HIDING;
                            this._bannerBin.ease({opacity: 0, duration, mode: Clutter.AnimationMode.EASE});
                            this._bannerBin.ease({
                                y: this._bannerBin.height,
                                duration,
                                mode: Clutter.AnimationMode.EASE,
                                onStopped: () => {
                                    this._notificationState = State.HIDDEN;
                                    this._hideNotificationCompleted();
                                    this._updateState();
                                },
                            });
                        });
                    }
                },
            },
            {
                name: 'shell-looking-glass-size',
                keys: ['shell-looking-glass-width', 'shell-looking-glass-height'],
                apply(lc, s) {
                    const widthSetting = s.get_int('shell-looking-glass-width');
                    const heightSetting = s.get_int('shell-looking-glass-height');
                    if (!widthSetting && !heightSetting)
                        return;

                    let lookingGlass = null;
                    const resize = () => {
                        const monitor = Main.layoutManager.primaryMonitor;
                        if (!lookingGlass || !monitor)
                            return;
                        lookingGlass._resize();
                        const width = widthSetting ? monitor.width * widthSetting / 10 : lookingGlass.width;
                        const available = monitor.height - Main.layoutManager.keyboardBox.height;
                        const height = heightSetting
                            ? Math.min(monitor.height * heightSetting / 10, available * 0.9)
                            : lookingGlass.height;
                        lookingGlass.set_x(monitor.x + (monitor.width - width) / 2);
                        lookingGlass._hiddenY = monitor.y + Main.layoutManager.panelBox.height - height;
                        lookingGlass._targetY = lookingGlass._hiddenY + height;
                        lookingGlass.set_size(width, height);
                    };

                    // Creating Looking Glass before the primary monitor exists crashes.
                    const attach = () => {
                        if (!Main.layoutManager.primaryMonitor)
                            return false;
                        lookingGlass = Main.createLookingGlass();
                        lc.connect(lookingGlass, 'show', resize);
                        lc.defer(() => lookingGlass._resize());
                        return true;
                    };
                    if (!attach()) {
                        lc.timeout(1000, () => (attach() ? false : true));
                    }
                    lc.connect(Main.layoutManager, 'monitors-changed', resize);
                },
            },
            {
                name: 'shell-theme',
                keys: ['shell-theme'],
                apply(lc, s) {
                    if (s.get_boolean('shell-theme'))
                        lc.addUiClass(`${CLASS_PREFIX}theme`);
                },
            },
            {
                name: 'shell-accent-color-icon',
                keys: ['shell-accent-color-icon'],
                apply(lc, s) {
                    if (s.get_boolean('shell-accent-color-icon'))
                        lc.addUiClass(`${CLASS_PREFIX}accent-color-icon`);
                },
            },
            {
                name: 'shell-background-menu',
                keys: ['shell-background-menu'],
                apply(lc, s) {
                    if (s.get_boolean('shell-background-menu'))
                        return;
                    lc.override(BackgroundMenu.BackgroundMenu.prototype, 'open', () => () => {});
                },
            },
        ];
    }
}
