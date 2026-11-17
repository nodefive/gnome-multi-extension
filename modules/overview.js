// SPDX-License-Identifier: GPL-3.0-only
// Overview tweaks. Logic ported from Just Perfection (GPL-3.0-only, Javad
// Rahmatzadeh), gnome-ui-tune (hide search, Firefox PiP), start-overlay-in-
// application-view (Super opens the app grid) and click-to-close-overview.

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as OverviewControls from 'resource:///org/gnome/shell/ui/overviewControls.js';
import * as Search from 'resource:///org/gnome/shell/ui/search.js';
import * as WindowPreview from 'resource:///org/gnome/shell/ui/windowPreview.js';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import * as WorkspacesView from 'resource:///org/gnome/shell/ui/workspacesView.js';
import * as WorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

import {Module} from '../lib/module.js';
import {CLASS_PREFIX, refreshStyles} from '../lib/shell.js';

const {ControlsState} = OverviewControls;

// Firefox "Picture-in-Picture" window titles in every Firefox locale.
// Data from gnome-ui-tune (generated from Firefox translations).
const FIREFOX_PIP_TITLES = new Set([
    'Aslaɣ n uvidyu', 'Beeld-in-Beeld', 'Bideoa beste leiho batean', 'Bilde-i-bilde',
    'Bild-i-bild', 'Bild-im-Bild', 'Bildo en bildo', 'Billede-i-billede',
    'Dealbh am broinn deilbh', 'Gambar-dalam-Gambar', 'Görüntü içinde görüntü',
    'Hình trong hình', 'Imachen sobre imachen', 'Imagine-in-imagine', 'Imagine în imagine',
    'Imatge sobre imatge', 'Imaxe en imaxe', 'Imaxe sobre imaxe', 'Immàgine-subra-immàgine',
    'Incrustation vidéo', 'Kép a képben', 'Kuva kuvassa', 'Llun mewn Llun', 'Maletg-en-maletg',
    'Mmàggini-nnâ-Mmàggini', 'Mynd-í-mynd', 'Obraz v obraze', 'Obraz w obrazie',
    'Ôbroz w ôbrazie', 'Pictiúr i bPictiúr', 'Picture-in-picture', 'Picture-in-Picture',
    'Pictur-in-Pictur', 'Pilt-pildis', "Sa ni'io' Riña sa ni'io'", 'Şəkildə-Şəkil',
    'Skeudenn-ouzh-skeudenn', 'Slika u slici', 'Slika-u-slici', 'Slika v sliki', '화면 속 화면',
    'Vaizdas-vaizde', "Vatzib'al", 'Vídeo em janela flutuante', 'Vidèo incrustada',
    'Wobraz-we-wobrazu', 'Εικόνα εντός εικόνας', 'Выява ў выяве', 'Зображення в зображенні',
    'Картина в картината', 'Картинка в картинке', 'Расм-дар-расм', 'Слика у слици',
    'Суреттегі сурет', 'ეკრანი-ეკრანში', 'Նկար նկարում', 'Նկար֊նկարում', 'תמונה בתוך תמונה',
    'تصویر در تصویر', 'تصویر میں تصویر', 'تصویر وِچ تصویر', 'ڤديو معترِض', 'وێنە-لەناو-وێنە',
    'पिक्चर-इन-पिक्चर', 'सावगारि-गेजेरौ-सावगारि', 'ছবির মধ্যে ছবি', 'ছবিৰ-ওপৰত-ছবি',
    'ਤਸਵੀਰ-ਚ-ਤਸਵੀਰ', 'රූපයෙන් රූපයට', 'ภาพที่เล่นควบคู่', 'ᱪᱤᱛᱟᱹᱨᱼᱵᱷᱤᱛᱨᱤᱼᱪᱤᱛᱟᱹᱨ',
    'ピクチャーインピクチャー', '子母畫面', '画中画',
]);

function controls() {
    return Main.overview._overview._controls;
}

function searchController() {
    return controls()._searchController;
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

/** Collapse the search entry; it reappears while a search is active. */
function collapseSearchEntry(lc, {cssClass, collapseDuration, expandDuration}) {
    const entry = Main.overview.searchEntry;
    const parent = entry.get_parent();
    const controller = searchController();

    lc.defer(() => {
        parent.remove_all_transitions();
        entry.remove_all_transitions();
        parent.height = -1;
        parent.opacity = 255;
        entry.opacity = 255;
    });

    const collapse = animate => {
        entry.ease({opacity: 0, mode: Clutter.AnimationMode.EASE, duration: animate ? 50 : 0});
        parent.ease({
            height: 0,
            opacity: 0,
            mode: Clutter.AnimationMode.EASE,
            duration: animate ? collapseDuration : 0,
        });
    };
    const expand = () => {
        parent.ease({
            height: entry.height,
            opacity: 255,
            mode: Clutter.AnimationMode.EASE,
            duration: expandDuration,
            onComplete: () => {
                parent.height = -1;
                entry.ease({opacity: 255, mode: Clutter.AnimationMode.EASE, duration: 300});
            },
        });
    };

    if (cssClass)
        lc.addUiClass(cssClass);
    if (!controller.searchActive)
        collapse(false);

    lc.connect(controller, 'notify::search-active', () => {
        if (controller.searchActive)
            expand();
        else
            collapse(true);
    });
    lc.connect(Main.overview, 'showing', () => {
        if (!controller.searchActive)
            collapse(false);
    });
}

export class OverviewModule extends Module {
    static get key() {
        return 'module-overview';
    }

    features() {
        return [
            {
                name: 'overview-startup-status',
                keys: ['overview-startup-status'],
                apply(lc, s) {
                    // The first enable in a Shell process is the login. Extensions
                    // load asynchronously and may arrive after startup finished,
                    // with the overview still open from the startup animation.
                    const firstEnable = !globalThis.__shellTweaksStartupSeen;
                    globalThis.__shellTweaksStartupSeen = true;

                    if (s.get_int('overview-startup-status') !== 0)
                        return;
                    const layoutManager = Main.layoutManager;
                    if (!layoutManager._startingUp) {
                        if (firstEnable && Main.overview._shown)
                            Main.overview.hide();
                        return;
                    }

                    // Extensions load asynchronously in GNOME 51 and can be enabled
                    // after the startup animation already took the overview path:
                    // switch the session to "no overview" for the animation if still
                    // in time, and close the overview at startup-complete if not.
                    const sessionMode = Main.sessionMode;
                    const hadOverview = sessionMode.hasOverview;
                    sessionMode.hasOverview = false;
                    layoutManager.startInOverview = false;
                    if (!Main.overview._shown)
                        controls()._stateAdjustment.value = ControlsState.HIDDEN;

                    lc.connect(layoutManager, 'startup-complete', () => {
                        sessionMode.hasOverview = hadOverview;
                        if (Main.overview._shown)
                            Main.overview.hide();
                    });
                    lc.defer(() => {
                        if (layoutManager._startingUp)
                            sessionMode.hasOverview = hadOverview;
                    });
                },
            },
            {
                name: 'overview-search-entry',
                keys: ['overview-search', 'overview-hide-search-until-typing'],
                apply(lc, s) {
                    if (!s.get_boolean('overview-search')) {
                        collapseSearchEntry(lc, {
                            cssClass: `${CLASS_PREFIX}no-search`,
                            collapseDuration: 120,
                            expandDuration: 110,
                        });
                    } else if (s.get_boolean('overview-hide-search-until-typing')) {
                        collapseSearchEntry(lc, {
                            cssClass: null,
                            collapseDuration: 100,
                            expandDuration: 10,
                        });
                    }
                },
            },
            {
                name: 'overview-type-to-search',
                keys: ['overview-type-to-search'],
                apply(lc, s) {
                    if (s.get_boolean('overview-type-to-search'))
                        return;
                    // GNOME 51 routes typing to the entry through an input
                    // interceptor set on 'showing'; drop it after GNOME sets it.
                    const text = Main.overview.searchEntry.clutter_text;
                    if (Main.overview.visible)
                        text.set_input_interceptor(null);
                    lc.connectAfter(Main.overview, 'showing', () => text.set_input_interceptor(null));
                    lc.defer(() => {
                        if (Main.overview.visible)
                            text.set_input_interceptor(global.stage);
                    });
                },
            },
            {
                name: 'overview-workspaces-box',
                keys: ['overview-search', 'overview-workspaces-in-app-grid'],
                apply(lc, s) {
                    const searchHidden = !s.get_boolean('overview-search');
                    const workspacesInAppGrid = s.get_boolean('overview-workspaces-in-app-grid');
                    if (!searchHidden && workspacesInAppGrid)
                        return;

                    const layout = controls().layout_manager;
                    lc.override(layout, '_computeWorkspacesBoxForState', original =>
                        function (state, box, searchHeight, ...args) {
                            const inAppGrid = state === ControlsState.APP_GRID;
                            if (inAppGrid && searchHidden)
                                searchHeight = 40;
                            box = original.call(this, state, box, searchHeight, ...args);
                            if (inAppGrid && !workspacesInAppGrid)
                                box.set_size(box.get_width(), 0);
                            return box;
                        });

                    if (!workspacesInAppGrid) {
                        // the empty workspace box still draws a shadow in the app grid
                        const button = Main.overview.dash.showAppsButton;
                        const className = `${CLASS_PREFIX}no-workspaces-in-app-grid`;
                        const uiGroup = Main.layoutManager.uiGroup;
                        const sync = () => {
                            if (button.checked)
                                uiGroup.add_style_class_name(className);
                            else
                                uiGroup.remove_style_class_name(className);
                        };
                        lc.defer(() => uiGroup.remove_style_class_name(className));
                        lc.connect(button, 'notify::checked', sync);
                        sync();
                    }
                    controls().queue_relayout();
                    lc.defer(() => controls().queue_relayout());
                },
            },
            {
                name: 'overview-max-search-results',
                keys: ['overview-max-search-results'],
                apply(lc, s) {
                    const items = s.get_int('overview-max-search-results');
                    if (items === 0)
                        return;
                    lc.override(Search.ListSearchResults.prototype, '_getMaxDisplayedResults',
                        () => () => items);
                },
            },
            {
                name: 'overview-dash',
                keys: ['overview-dash'],
                apply(lc, s) {
                    if (s.get_boolean('overview-dash'))
                        return;
                    const dash = Main.overview.dash;
                    if (!dash)
                        return;
                    // dash-to-dock rebuilds its dash; never touch a destroyed one
                    let alive = true;
                    const destroyId = dash.connect('destroy', () => {
                        alive = false;
                    });
                    lc.defer(() => {
                        if (!alive)
                            return;
                        dash.disconnect(destroyId);
                        dash.show();
                        dash.height = -1;
                        dash.setMaxSize(-1, -1);
                    });
                    dash.hide();
                    dash.height = 0;
                    lc.override(WindowPreview.WindowPreview.prototype, 'overlapHeights', original =>
                        function () {
                            const [top, bottom] = original.call(this);
                            return [top + 24, bottom + 24];
                        });
                },
            },
            classFeature('overview-dash-app-running', 'overview-dash-app-running', 'no-dash-app-running-dot'),
            classFeature('overview-show-apps-button', 'overview-show-apps-button', 'no-show-apps-button'),
            {
                name: 'overview-workspace-switcher',
                keys: ['overview-workspace-switcher', 'overview-workspace-switcher-should-show'],
                apply(lc, s) {
                    let shouldShow;
                    if (!s.get_boolean('overview-workspace-switcher'))
                        shouldShow = false;
                    else if (s.get_boolean('overview-workspace-switcher-should-show'))
                        shouldShow = true;
                    else
                        return;

                    const thumbnails = controls()._thumbnailsBox;
                    // registered first: re-evaluate with the original method on revert
                    lc.defer(() => thumbnails._updateShouldShow());
                    lc.set(WorkspaceThumbnail.ThumbnailsBox.prototype, '_updateShouldShow', function () {
                        if (this._shouldShow === shouldShow)
                            return;
                        this._shouldShow = shouldShow;
                        this.notify('should-show');
                    });
                    thumbnails._updateShouldShow();
                },
            },
            {
                name: 'overview-workspace-switcher-size',
                keys: ['overview-workspace-switcher-size'],
                apply(lc, s) {
                    const percent = s.get_int('overview-workspace-switcher-size');
                    if (percent === 0)
                        return;
                    const scale = percent / 100;
                    const thumbnails = controls()._thumbnailsBox;
                    lc.set(thumbnails, '_maxThumbnailScale', scale);
                    lc.override(WorkspaceThumbnail.ThumbnailsBox.prototype, '_init', original =>
                        function (...params) {
                            this._maxThumbnailScale = scale;
                            original.call(this, ...params);
                        });
                    thumbnails.queue_relayout();
                },
            },
            {
                name: 'overview-workspace-peek',
                keys: ['overview-workspace-peek'],
                apply(lc, s) {
                    if (s.get_boolean('overview-workspace-peek'))
                        return;
                    lc.override(WorkspacesView.WorkspacesView.prototype, '_getSpacing', original =>
                        function (box, fitMode, vertical) {
                            if (fitMode === 0)
                                return 400;
                            return original.call(this, box, fitMode, vertical);
                        });
                },
            },
            {
                name: 'overview-workspace-thumbnail-to-main-view',
                keys: ['overview-workspace-thumbnail-to-main-view'],
                apply(lc, s) {
                    if (!s.get_boolean('overview-workspace-thumbnail-to-main-view'))
                        return;
                    const {ThumbnailState} = WorkspaceThumbnail;
                    lc.override(WorkspaceThumbnail.WorkspaceThumbnail.prototype, 'activate', () =>
                        function (time) {
                            if (this.state > ThumbnailState.NORMAL)
                                return;
                            if (!this.metaWorkspace.active)
                                this.metaWorkspace.activate(time);
                            Main.overview.hide();
                        });
                },
            },
            classFeature('overview-window-picker-icon', 'overview-window-picker-icon', 'no-window-picker-icon'),
            {
                name: 'overview-window-preview-caption',
                keys: ['overview-window-preview-caption'],
                apply(lc, s) {
                    if (s.get_boolean('overview-window-preview-caption'))
                        return;
                    lc.override(WindowPreview.WindowPreview.prototype, '_getCaption', () => () => '');
                    lc.addUiClass(`${CLASS_PREFIX}no-window-caption`);
                },
            },
            classFeature('overview-window-preview-close-button', 'overview-window-preview-close-button', 'no-window-close'),
            {
                name: 'overview-controls-spacing-size',
                keys: ['overview-controls-spacing-size'],
                apply(lc, s) {
                    const size = s.get_int('overview-controls-spacing-size');
                    if (size === 0)
                        return;
                    lc.addUiClass(`${CLASS_PREFIX}controls-manager-spacing-size${size}`);
                },
            },
            {
                name: 'overview-workspace-background-corner-size',
                keys: ['overview-workspace-background-corner-size'],
                apply(lc, s) {
                    const value = s.get_int('overview-workspace-background-corner-size');
                    if (value === 0)
                        return;
                    const size = value - 1;
                    lc.override(Workspace.WorkspaceBackground.prototype, '_updateBorderRadius', () =>
                        function () {
                            const {scaleFactor} = St.ThemeContext.get_for_stage(global.stage);
                            const content = this._bgManager.backgroundActor.content;
                            content.rounded_clip_radius =
                                Util.lerp(0, scaleFactor * size, this._stateAdjustment.value);
                        });
                    lc.addUiClass(`${CLASS_PREFIX}workspace-background-radius-size${size}`);
                    refreshStyles();
                },
            },
            {
                name: 'overview-firefox-pip',
                keys: ['overview-firefox-pip'],
                apply(lc, s) {
                    if (!s.get_boolean('overview-firefox-pip'))
                        return;
                    lc.override(Workspace.Workspace.prototype, '_isOverviewWindow', original =>
                        function (window) {
                            if (window.title && FIREFOX_PIP_TITLES.has(window.title) &&
                                window.get_wm_class?.()?.toLowerCase().includes('firefox'))
                                return true;
                            return original.call(this, window);
                        });
                },
            },
            {
                name: 'overview-super-key',
                keys: [
                    'overview-super-key',
                    'overview-double-super-to-app-grid',
                    'overview-super-opens-app-grid',
                ],
                apply(lc, s) {
                    const enabled = s.get_boolean('overview-super-key');
                    const appGrid = s.get_boolean('overview-super-opens-app-grid');
                    const doubleSuper = s.get_boolean('overview-double-super-to-app-grid');
                    if (enabled && !appGrid && doubleSuper)
                        return;

                    // The ControlsManager handler is the first one connected to
                    // overlay-key; block it and, unless the key is disabled,
                    // install a replacement. Other toggle() callers are untouched.
                    const originalId = GObject.signal_handler_find(global.display, {signalId: 'overlay-key'});
                    if (!originalId)
                        return;
                    GObject.signal_handler_block(global.display, originalId);
                    lc.defer(() => GObject.signal_handler_unblock(global.display, originalId));

                    if (!enabled)
                        return;

                    const a11y = new Gio.Settings({schema_id: 'org.gnome.desktop.a11y.keyboard'});
                    lc.connect(global.display, 'overlay-key', () => {
                        if (a11y.get_boolean('stickykeys-enable'))
                            return;
                        if (!appGrid) {
                            Main.overview.toggle();
                            return;
                        }
                        if (Main.overview.visible)
                            Main.overview.hide();
                        else
                            Main.overview.showApps();
                    });
                },
            },
            {
                name: 'overview-click-empty-to-close',
                keys: ['overview-click-empty-to-close', 'overview-click-clears-search-first'],
                apply(lc, s) {
                    if (!s.get_boolean('overview-click-empty-to-close'))
                        return;
                    const clearsFirst = s.get_boolean('overview-click-clears-search-first');
                    const controller = searchController();
                    const entry = Main.overview.searchEntry;

                    // GNOME itself cancels an empty search on press; remember when
                    // search ended so that click is not also treated as "close".
                    let searchEndedAt = 0;
                    lc.connect(controller, 'notify::search-active', () => {
                        if (!controller.searchActive)
                            searchEndedAt = GLib.get_monotonic_time();
                    });

                    const gesture = new Clutter.ClickGesture();
                    lc.connect(gesture, 'recognize', action => {
                        const button = action.get_button();
                        if (button !== 0 && button !== Clutter.BUTTON_PRIMARY)
                            return;

                        const [x, y] = global.get_pointer();
                        const actor = global.stage.get_actor_at_pos(Clutter.PickMode.ALL, x, y);
                        if (actor && entry.contains(actor))
                            return;

                        if (clearsFirst) {
                            if (controller.searchActive) {
                                controller.reset();
                                return;
                            }
                            if (GLib.get_monotonic_time() - searchEndedAt < 400 * 1000)
                                return;
                        }
                        if (Main.overview.visible)
                            Main.overview.hide();
                    });

                    Main.layoutManager.overviewGroup.add_action(gesture);
                    lc.defer(() => Main.layoutManager.overviewGroup.remove_action(gesture));
                },
            },
        ];
    }
}
