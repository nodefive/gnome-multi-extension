// SPDX-License-Identifier: GPL-3.0-only
// Panel tweaks. Logic ported from Just Perfection (GPL-3.0-only, Javad Rahmatzadeh).

import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {Module} from '../lib/module.js';
import {CLASS_PREFIX, onQuickSettingsItem, refreshStyles, walkActors} from '../lib/shell.js';

const PANEL_BOTTOM = 1;

function panelBoxes() {
    return [Main.panel._centerBox, Main.panel._rightBox, Main.panel._leftBox];
}

function setPanelMenusSide(side) {
    for (const box of panelBoxes()) {
        walkActors(box, actor => {
            if (actor instanceof PanelMenu.Button && actor.menu?._boxPointer)
                actor.menu._boxPointer._userArrowSide = side;
        });
    }
}

/** Hide a status area item's container while the feature is active. */
function hideContainer(lc, name) {
    const item = Main.panel.statusArea[name];
    if (!item)
        return;
    item.container.hide();
    lc.defer(() => {
        if (!Main.sessionMode.isLocked)
            item.container.show();
    });
}

function classFeature(name, key, className) {
    return {
        name,
        keys: [key],
        apply(lc, s) {
            if (!s.get_boolean(key))
                lc.addUiClass(`${CLASS_PREFIX}${className}`);
        },
    };
}

function sizeClassFeature(name, key, classStem, max) {
    return {
        name,
        keys: [key],
        apply(lc, s) {
            const value = s.get_int(key);
            if (value === 0)
                return;
            // 1 means "no padding" (0px); 2..61 map to 1..60px
            const size = Math.min(value - 1, max);
            lc.addUiClass(`${CLASS_PREFIX}${classStem}${size}`);
            refreshStyles();
            lc.defer(() => refreshStyles());
        },
    };
}

/**
 * Hide a quick settings toggle. On revert the visibility comes from the
 * toggle's own source of truth, not from a snapshot, so a toggle GNOME hid
 * meanwhile (no night light support, no keyboard backlight) stays hidden.
 */
function quickToggleFeature(name, key, property, restore) {
    return {
        name,
        keys: [key],
        apply(lc, s) {
            if (s.get_boolean(key))
                return;
            onQuickSettingsItem(lc, property, indicator => {
                const item = indicator.quickSettingsItems[0];
                // registered before the signal so the handler is gone when this runs
                lc.defer(() => restore(item, indicator));
                item.hide();
                lc.connect(item, 'show', () => item.hide());
            });
        },
    };
}

export class PanelModule extends Module {
    static get key() {
        return 'module-panel';
    }

    features() {
        return [
            {
                name: 'panel-position',
                keys: ['panel-position'],
                apply(lc, s) {
                    if (s.get_int('panel-position') !== PANEL_BOTTOM)
                        return;

                    const panelBox = Main.layoutManager.panelBox;
                    const place = () => {
                        const monitor = Main.layoutManager.primaryMonitor;
                        if (monitor)
                            panelBox.set_position(monitor.x, monitor.y + monitor.height - Main.panel.height);
                    };

                    lc.defer(() => {
                        const monitor = Main.layoutManager.primaryMonitor;
                        panelBox.set_position(monitor?.x ?? 0, monitor?.y ?? 0);
                        setPanelMenusSide(St.Side.TOP);
                    });

                    place();
                    lc.addUiClass(`${CLASS_PREFIX}bottom-panel`);
                    lc.connect(global.display, 'workareas-changed', place);
                    lc.connect(panelBox, 'notify::height', place);

                    setPanelMenusSide(St.Side.BOTTOM);
                    lc.override(PanelMenu.Button.prototype, 'setMenu', original => function (menu) {
                        original.call(this, menu);
                        if (menu?._boxPointer)
                            menu._boxPointer._userArrowSide = St.Side.BOTTOM;
                    });
                },
            },
            {
                name: 'panel-visible',
                keys: ['panel-visible', 'panel-in-overview', 'panel-position'],
                apply(lc, s) {
                    if (s.get_boolean('panel-visible'))
                        return;

                    const desktopOnly = s.get_boolean('panel-in-overview');
                    const layoutManager = Main.layoutManager;
                    const panelBox = layoutManager.panelBox;
                    const searchParent = Main.overview.searchEntry.get_parent();
                    const searchStyle = searchParent.get_style();

                    // Registered first so it runs last: the no-panel class must be
                    // gone before the panel box returns to the chrome, otherwise
                    // St can crash looking up a stale shadow.
                    lc.defer(() => {
                        panelBox.translation_y = 0;
                        if (panelBox.get_parent() === layoutManager.overviewGroup) {
                            layoutManager.overviewGroup.remove_child(panelBox);
                            layoutManager.addChrome(panelBox, {
                                affectsStruts: true,
                                trackFullscreen: true,
                            });
                        }
                        searchParent.set_style(searchStyle);
                        panelBox.hide();
                        panelBox.show();
                        layoutManager._updateHotCorners();
                    });

                    let busy = false;
                    const hide = () => {
                        if (busy)
                            return;
                        busy = true;
                        const bottom = s.get_int('panel-position') === PANEL_BOTTOM;
                        const height = Main.panel.height;

                        if (panelBox.get_parent() === layoutManager.uiGroup) {
                            layoutManager.removeChrome(panelBox);
                            layoutManager.overviewGroup.insert_child_at_index(panelBox, 0);
                        }
                        panelBox.translation_y = desktopOnly ? 0 : height * (bottom ? 1 : -1);

                        if (bottom) {
                            searchParent.set_style('margin-top: 0;');
                        } else {
                            const {scaleFactor} = St.ThemeContext.get_for_stage(global.stage);
                            const margin = desktopOnly ? Math.round(height / scaleFactor) : 15;
                            searchParent.set_style(`margin-top: ${margin}px;`);
                        }

                        // hide/show keeps maximized windows from sliding under the panel
                        panelBox.hide();
                        panelBox.show();
                        busy = false;
                    };

                    hide();
                    lc.connect(global.display, 'workareas-changed', hide);
                    lc.connect(panelBox, 'notify::height', hide);
                    lc.addUiClass(`${CLASS_PREFIX}no-panel`);
                    layoutManager._updateHotCorners();
                },
            },
            {
                name: 'panel-size',
                keys: ['panel-size'],
                apply(lc, s) {
                    const size = s.get_int('panel-size');
                    if (size === 0)
                        return;
                    lc.set(Main.panel, 'height', size);
                    lc.defer(() => {
                        Main.panel.height = -1;
                    });
                },
            },
            {
                name: 'panel-activities-button',
                keys: ['panel-activities-button'],
                apply(lc, s) {
                    if (!s.get_boolean('panel-activities-button'))
                        hideContainer(lc, 'activities');
                },
            },
            {
                name: 'panel-clock-menu',
                keys: ['panel-clock-menu'],
                apply(lc, s) {
                    if (!s.get_boolean('panel-clock-menu'))
                        hideContainer(lc, 'dateMenu');
                },
            },
            {
                name: 'panel-clock-menu-position',
                keys: ['panel-clock-menu-position', 'panel-clock-menu-position-offset'],
                apply(lc, s) {
                    const position = s.get_int('panel-clock-menu-position');
                    const offset = s.get_int('panel-clock-menu-position-offset');
                    if (position === 0 && offset === 0)
                        return;

                    const container = Main.panel.statusArea.dateMenu.container;
                    const boxes = panelBoxes();
                    const originalBox = container.get_parent();
                    const originalIndex = originalBox?.get_children().indexOf(container) ?? -1;
                    if (!originalBox || originalIndex < 0)
                        return;

                    let moving = false;
                    const place = () => {
                        if (moving)
                            return;
                        const target = boxes[position];
                        const current = container.get_parent();
                        const index = Math.min(offset, target.get_children().length);
                        if (current === target && target.get_children().indexOf(container) === index)
                            return;
                        moving = true;
                        current?.remove_child(container);
                        target.insert_child_at_index(container, Math.min(index, target.get_children().length));
                        moving = false;
                    };

                    lc.defer(() => {
                        const current = container.get_parent();
                        if (current === originalBox)
                            return;
                        current?.remove_child(container);
                        originalBox.insert_child_at_index(container,
                            Math.min(originalIndex, originalBox.get_children().length));
                    });

                    place();
                    for (const box of boxes)
                        lc.connect(box, 'child-added', place);
                },
            },
            {
                name: 'panel-keyboard-layout',
                keys: ['panel-keyboard-layout'],
                apply(lc, s) {
                    if (!s.get_boolean('panel-keyboard-layout'))
                        hideContainer(lc, 'keyboard');
                },
            },
            {
                name: 'panel-accessibility-menu',
                keys: ['panel-accessibility-menu'],
                apply(lc, s) {
                    if (!s.get_boolean('panel-accessibility-menu'))
                        hideContainer(lc, 'a11y');
                },
            },
            {
                name: 'panel-quick-settings',
                keys: ['panel-quick-settings'],
                apply(lc, s) {
                    if (!s.get_boolean('panel-quick-settings'))
                        hideContainer(lc, 'quickSettings');
                },
            },
            classFeature('panel-power-icon', 'panel-power-icon', 'no-power-icon'),
            classFeature('panel-notification-icon', 'panel-notification-icon', 'no-panel-notification-icon'),
            classFeature('panel-screen-sharing-indicator', 'panel-screen-sharing-indicator', 'no-screen-sharing-indicator'),
            classFeature('panel-screen-recording-indicator', 'panel-screen-recording-indicator', 'no-screen-recording-indicator'),
            sizeClassFeature('panel-button-padding-size', 'panel-button-padding-size', 'panel-button-padding-size', 60),
            sizeClassFeature('panel-indicator-padding-size', 'panel-indicator-padding-size', 'panel-indicator-padding-size', 60),
            {
                name: 'panel-icon-size',
                keys: ['panel-icon-size'],
                apply(lc, s) {
                    const size = s.get_int('panel-icon-size');
                    if (size === 0)
                        return;
                    lc.addUiClass(`${CLASS_PREFIX}panel-icon-size${size}`);
                    refreshStyles();

                    const indicator = Main.panel.statusArea.dateMenu?._indicator;
                    if (indicator?.set_icon_size) {
                        const previous = indicator.icon_size;
                        indicator.set_icon_size(size);
                        lc.defer(() => indicator.set_icon_size(previous));
                    }
                    lc.defer(() => refreshStyles());
                },
            },
            quickToggleFeature('qs-dark-mode', 'qs-dark-mode', '_darkMode', item => item.show()),
            quickToggleFeature('qs-night-light', 'qs-night-light', '_nightLight', item => {
                item.visible = global.backend.get_monitor_manager().night_light_supported;
            }),
            quickToggleFeature('qs-do-not-disturb', 'qs-do-not-disturb', '_doNotDisturb', item => item.show()),
            quickToggleFeature('qs-backlight', 'qs-backlight', '_backlight', item => {
                if (item._sync)
                    item._sync();
                else
                    item.show();
            }),
            {
                name: 'qs-airplane-mode',
                keys: ['qs-airplane-mode'],
                apply(lc, s) {
                    if (s.get_boolean('qs-airplane-mode'))
                        return;
                    onQuickSettingsItem(lc, '_rfkill', rfkill => {
                        const toggle = rfkill._rfkillToggle;
                        const wasVisible = toggle.visible;
                        // registered before the signal so the handler is gone when this runs
                        lc.defer(() => {
                            toggle.visible = toggle._manager?.show_airplane_mode ?? wasVisible;
                            rfkill._sync();
                        });
                        toggle.hide();
                        rfkill._sync();
                        lc.connect(toggle, 'show', () => {
                            toggle.hide();
                            rfkill._sync();
                        });
                    });
                },
            },
        ];
    }
}
