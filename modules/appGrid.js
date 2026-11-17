// SPDX-License-Identifier: GPL-3.0-only
// App grid and folder popup layout. Ported from app-grid-tuner, including the
// local folder-popup fixes (grid-mode lock, primary-monitor clamp, page-dot
// room, tuned style kept during the open animation).

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

import {Module} from '../lib/module.js';
import {appDisplay, hexToCss, isHexColor} from '../lib/shell.js';

const KEYS = [
    'app-grid-max-columns', 'app-grid-max-rows', 'app-grid-icon-size', 'app-grid-side-padding',
    'app-grid-icon-font-size', 'app-grid-label-style', 'app-grid-label-color',
    'app-grid-label-shadow-color', 'app-grid-background-mode',
    'app-grid-background-tint-color', 'app-grid-background-tint-opacity',
    'app-grid-background-color', 'app-grid-background-image', 'app-grid-gradient-type', 'app-grid-gradient-secondary-color',
    'app-grid-hover-tile-enabled', 'app-grid-hover-tile-background-color',
    'app-grid-hover-tile-background-opacity', 'app-grid-hover-tile-border-color',
    'app-grid-folder-max-columns', 'app-grid-folder-max-rows',
    'app-grid-folder-icon-size', 'app-grid-folder-icon-font-size', 'app-grid-folder-item-spacing',
    'app-grid-folder-item-height-offset', 'app-grid-folder-side-padding',
    'app-grid-folder-popup-width', 'app-grid-folder-popup-fixed-size',
    'app-grid-folder-popup-fixed-width', 'app-grid-folder-popup-fixed-height',
    'app-grid-folder-popup-height-offset',
    'app-grid-folder-popup-background-color', 'app-grid-folder-popup-background-opacity',
    'app-grid-folder-popup-border-color', 'app-grid-folder-popup-border-radius',
    'app-grid-folder-tile-background-color', 'app-grid-folder-tile-background-opacity',
    'app-grid-folder-tile-border-color', 'app-grid-folder-tile-border-radius',
    'app-grid-hide-folder-title', 'app-grid-open-animation-time',
    'app-grid-page-switch-animation-time', 'debug',
];

const GRID_CLASSES = [
    'shell-tweaks-label-color', 'shell-tweaks-label-style', 'shell-tweaks-app-hover', 'shell-tweaks-folder-tile',
];

function readConfig(s) {
    return {
        rows: s.get_int('app-grid-max-rows'),
        columns: s.get_int('app-grid-max-columns'),
        iconSize: s.get_int('app-grid-icon-size'),
        sidePadding: s.get_int('app-grid-side-padding'),
        iconFontSize: s.get_double('app-grid-icon-font-size'),
        labelStyle: s.get_string('app-grid-label-style'),
        labelColor: s.get_string('app-grid-label-color'),
        labelShadowColor: s.get_string('app-grid-label-shadow-color'),
        backgroundMode: s.get_string('app-grid-background-mode'),
        backgroundImage: s.get_string('app-grid-background-image'),
        backgroundTintColor: s.get_string('app-grid-background-tint-color'),
        backgroundTintOpacity: s.get_double('app-grid-background-tint-opacity'),
        backgroundColor: s.get_string('app-grid-background-color'),
        gradientType: s.get_string('app-grid-gradient-type'),
        gradientSecondaryColor: s.get_string('app-grid-gradient-secondary-color'),
        hoverEnabled: s.get_boolean('app-grid-hover-tile-enabled'),
        hoverBackgroundColor: s.get_string('app-grid-hover-tile-background-color'),
        hoverBackgroundOpacity: s.get_double('app-grid-hover-tile-background-opacity'),
        hoverBorderColor: s.get_string('app-grid-hover-tile-border-color'),
        folderColumns: s.get_int('app-grid-folder-max-columns'),
        folderRows: s.get_int('app-grid-folder-max-rows'),
        folderIconSize: s.get_int('app-grid-folder-icon-size'),
        folderIconFontSize: s.get_double('app-grid-folder-icon-font-size'),
        folderItemSpacing: s.get_int('app-grid-folder-item-spacing'),
        folderItemHeightOffset: s.get_int('app-grid-folder-item-height-offset'),
        folderSidePadding: s.get_int('app-grid-folder-side-padding'),
        folderPopupWidth: s.get_int('app-grid-folder-popup-width'),
        folderPopupFixedSize: s.get_boolean('app-grid-folder-popup-fixed-size'),
        folderPopupFixedWidth: s.get_int('app-grid-folder-popup-fixed-width'),
        folderPopupFixedHeight: s.get_int('app-grid-folder-popup-fixed-height'),
        folderPopupHeightOffset: s.get_int('app-grid-folder-popup-height-offset'),
        folderPopupBackgroundColor: s.get_string('app-grid-folder-popup-background-color'),
        folderPopupBackgroundOpacity: s.get_double('app-grid-folder-popup-background-opacity'),
        folderPopupBorderColor: s.get_string('app-grid-folder-popup-border-color'),
        folderPopupBorderRadius: s.get_int('app-grid-folder-popup-border-radius'),
        folderTileBackgroundColor: s.get_string('app-grid-folder-tile-background-color'),
        folderTileBackgroundOpacity: s.get_double('app-grid-folder-tile-background-opacity'),
        folderTileBorderColor: s.get_string('app-grid-folder-tile-border-color'),
        folderTileBorderRadius: s.get_int('app-grid-folder-tile-border-radius'),
        hideFolderTitle: s.get_boolean('app-grid-hide-folder-title'),
        openAnimationTime: s.get_int('app-grid-open-animation-time'),
        pageSwitchAnimationTime: s.get_int('app-grid-page-switch-animation-time'),
        debug: s.get_boolean('debug'),
    };
}

function boxStyle(color, opacity, radius, borderColor) {
    let style = '';
    if (isHexColor(color))
        style += ` background-color: ${hexToCss(color, Math.min(1, Math.max(0, opacity)))};`;
    if (radius > 0)
        style += ` border-radius: ${radius}px;`;
    if (isHexColor(borderColor))
        style += ` border: 1px solid ${borderColor};`;
    return style;
}

/**
 * Background for the visible folder popup. A custom colour gets the
 * opacity; with no custom colour the opacity applies to the theme's own
 * popup colour (captured before Shell Tweaks styled the popup).
 */
function popupBackground(c, themeColor) {
    const opacity = Math.min(1, Math.max(0, c.folderPopupBackgroundOpacity));
    if (isHexColor(c.folderPopupBackgroundColor))
        return ` background-color: ${hexToCss(c.folderPopupBackgroundColor, opacity)};`;
    if (themeColor && opacity < 1) {
        const {red, green, blue, alpha} = themeColor;
        const a = Math.round(alpha / 255 * opacity * 1000) / 1000;
        return ` background-color: rgba(${red}, ${green}, ${blue}, ${a});`;
    }
    return '';
}

function themeBackground(actor) {
    try {
        const color = actor.get_theme_node().get_background_color();
        return color.alpha > 0 ? {red: color.red, green: color.green, blue: color.blue, alpha: color.alpha} : null;
    } catch {
        return null;
    }
}

function imageUri(path) {
    if (!path)
        return null;
    const file = path.includes('://')
        ? Gio.File.new_for_uri(path)
        : Gio.File.new_for_path(path.replace(/^~(?=\/|$)/, GLib.get_home_dir()));
    return file.query_exists(null) ? file.get_uri() : null;
}

/** The theme's folder tile colour as #rrggbb (alpha comes from the opacity setting). */
function themeFolderColor(display) {
    const icon = display?._folderIcons?.[0];
    try {
        const color = icon?.get_theme_node().get_background_color();
        if (color && color.alpha > 0) {
            const hex = v => v.toString(16).padStart(2, '0');
            return `#${hex(color.red)}${hex(color.green)}${hex(color.blue)}`;
        }
    } catch {
        // not styled yet
    }
    return '#ffffff';
}

function shade(hex, factor) {
    const channel = i => {
        const v = Math.round(parseInt(hex.slice(i, i + 2), 16) * factor);
        return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
    };
    return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/**
 * Automatic folder popup size and grid: the popup fits the icons, at least
 * the minimum width, at most 90% x 80% of the primary monitor, capped by the
 * folder column/row settings. Uses the item spacing and height offset
 * settings as estimates of the icon cell and the title area.
 */
function folderGeometry(c, appCount, dotsHeight) {
    const monitor = Main.layoutManager.primaryMonitor;
    const screenWidth = monitor?.width || global.stage.width || 0;
    const screenHeight = monitor?.height || global.stage.height || 0;
    const padding = c.folderSidePadding;
    const cellWidth = c.folderIconSize + c.folderItemSpacing;
    const cellHeight = c.folderIconSize + c.folderItemHeightOffset;
    const offset = c.folderPopupHeightOffset;
    const maxWidth = screenWidth > 0 ? Math.floor(screenWidth * 0.9) : Infinity;
    const maxHeight = screenHeight > 0 ? Math.floor(screenHeight * 0.8) : Infinity;

    const fitColumns = Math.floor((maxWidth - padding * 2) / cellWidth);
    const columns = Math.max(1, Math.min(appCount, c.folderColumns, fitColumns));
    const fitRows = dots => Math.floor((maxHeight - offset - dots) / cellHeight);
    let rows = Math.max(1, Math.min(Math.ceil(appCount / columns), c.folderRows, fitRows(0)));
    const paged = appCount > rows * columns;
    if (paged)
        rows = Math.max(1, Math.min(rows, fitRows(dotsHeight)));
    const dots = paged ? dotsHeight : 0;

    return {
        rows,
        columns,
        width: Math.min(Math.max(columns * cellWidth + padding * 2, c.folderPopupWidth), maxWidth),
        height: Math.min(rows * cellHeight + offset + dots, maxHeight),
    };
}

/**
 * Fixed folder popup size: the visible popup is exactly W x H px (limited
 * only to the monitor). Columns and rows come from GNOME's real layout: the
 * icon cell (largest icon), the theme's grid spacing and page padding, the
 * popup's padding and border, the title row and the page dots. Icons beyond
 * one page go to the next page, to the right.
 */
function fixedFolderGeometry(icon, dialog, c, appCount) {
    const monitor = Main.layoutManager.primaryMonitor;
    const width = monitor ? Math.min(c.folderPopupFixedWidth, monitor.width) : c.folderPopupFixedWidth;
    const height = monitor ? Math.min(c.folderPopupFixedHeight, monitor.height) : c.folderPopupFixedHeight;

    const grid = icon.view._grid;
    const layout = grid.layout_manager;
    let cell = 0;
    for (const item of grid.get_children()) {
        if (!item.visible)
            continue;
        cell = Math.max(cell, item.get_preferred_width(-1)[0], item.get_preferred_height(-1)[0]);
    }
    // before the popup was ever shown items can report less than the icon
    // itself; use an estimate until the measurement on open
    if (cell < c.folderIconSize)
        cell = c.folderIconSize + 40;
    const columnSpacing = layout.columnSpacing || 0;
    const rowSpacing = layout.rowSpacing || 0;
    const pagePadding = layout.pagePadding ?? {};
    const padH = (pagePadding.left ?? 0) + (pagePadding.right ?? 0);
    const padV = (pagePadding.top ?? 0) + (pagePadding.bottom ?? 0);

    const box = dialog._viewBox;
    let chromeH = 0;
    let chromeV = 0;
    try {
        const node = box.get_theme_node();
        chromeH = node.get_horizontal_padding() +
            node.get_border_width(St.Side.LEFT) + node.get_border_width(St.Side.RIGHT);
        chromeV = node.get_vertical_padding() +
            node.get_border_width(St.Side.TOP) + node.get_border_width(St.Side.BOTTOM);
    } catch {
        // not styled yet
    }

    const entry = dialog._entryBox;
    let title = 0;
    if (entry?.visible) {
        title = entry.get_preferred_height(-1)[1];
        if (title > 0)
            title += box.layout_manager?.spacing ?? 0;
    }

    let dots = 0;
    try {
        [, dots] = icon.view._pageIndicators.get_preferred_height(-1);
    } catch {
        dots = 0;
    }
    dots = (dots || 40) + (icon.view._box?.layout_manager?.spacing ?? 0);

    const fit = (available, spacing, padding) =>
        Math.max(1, Math.floor((available - padding + spacing) / (cell + spacing)));
    const availableWidth = width - chromeH;
    const availableHeight = height - chromeV - title;

    const columns = Math.min(appCount, fit(availableWidth, columnSpacing, padH));
    let rows = Math.min(Math.ceil(appCount / columns), fit(availableHeight, rowSpacing, padV));
    if (appCount > rows * columns)
        rows = Math.min(rows, fit(availableHeight - dots, rowSpacing, padV));

    return {rows, columns, width, height, debug: {cell, columnSpacing, rowSpacing, chromeH, chromeV, title, dots}};
}

class AppGridTuner {
    constructor(config, extension) {
        this._c = config;
        this._extension = extension;
        this._folderStates = new Map();
        this._backgroundStates = new Map();
        this._gridState = null;
        this._stylesheet = null;
        this._viewLoadedId = 0;
        this._injections = new InjectionManager();
        this._applying = new Set();
    }

    start() {
        const display = appDisplay();
        const grid = display?._grid;
        if (!grid)
            return;
        const c = this._c;

        this._gridState = {
            fixedIconSize: grid.layout_manager.fixedIconSize,
            rowsPerPage: grid.layout_manager.rowsPerPage,
            columnsPerPage: grid.layout_manager.columnsPerPage,
            gridModes: grid._gridModes?.map(mode => ({...mode})),
            currentMode: grid._currentMode,
            style: grid.style,
            pageIndicatorStyle: display._pageIndicators?.style ?? null,
            hadOwnAdaptToSize: Object.prototype.hasOwnProperty.call(display, 'adaptToSize'),
            adaptToSize: display.adaptToSize,
        };

        for (const className of GRID_CLASSES)
            grid.remove_style_class_name(className);
        if (isHexColor(c.labelColor))
            grid.add_style_class_name('shell-tweaks-label-color');
        if (c.labelStyle)
            grid.add_style_class_name('shell-tweaks-label-style');
        if (c.hoverEnabled)
            grid.add_style_class_name('shell-tweaks-app-hover');
        this._themeFolderColor = themeFolderColor(display);
        grid.add_style_class_name('shell-tweaks-folder-tile');
        this._loadStylesheet();

        const fontStyle = c.iconFontSize > 0 ? ` font-size: ${c.iconFontSize}px;` : '';
        grid.style = `${this._gridState.style ?? ''}${fontStyle}`;
        grid.layout_manager.fixedIconSize = c.iconSize;

        const tuner = this;
        display.adaptToSize = function (width, height) {
            tuner._adaptToSize(this, width, height);
        };

        // GNOME creates a folder popup on first open and again when the folder
        // changes; style every popup at creation, not only the existing ones.
        this._injections.overrideMethod(AppDisplay.FolderIcon.prototype, '_ensureFolderDialog',
            original => function (...args) {
                const created = !this._dialog;
                const result = original.call(this, ...args);
                if (created && this._dialog && !tuner._applying.has(this))
                    tuner._applyFolderSafe(this);
                return result;
            });

        if (display._folderIcons?.length)
            this._applyFolders();
        this._themeChangedId = St.ThemeContext.get_for_stage(global.stage).connect('changed', () => {
            this._applyFolders();
        });
        this._viewLoadedId = display.connect('view-loaded', () => {
            this._applyFolders();
            this._applyAnimations();
        });

        this._applyAnimations();
        if (c.backgroundMode === 'wallpaper') {
            this._wallpaperSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.background'});
            this._interfaceSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
            const refresh = () => this._applyBackground();
            this._wallpaperIds = [
                [this._wallpaperSettings, this._wallpaperSettings.connect('changed::picture-uri', refresh)],
                [this._wallpaperSettings, this._wallpaperSettings.connect('changed::picture-uri-dark', refresh)],
                [this._interfaceSettings, this._interfaceSettings.connect('changed::color-scheme', refresh)],
            ];
        }
        this._applyBackground();

        if (grid.setGridModes)
            grid.setGridModes([{rows: c.rows, columns: c.columns}]);
        else if (grid._gridModes?.[0])
            grid._gridModes[0] = {rows: c.rows, columns: c.columns};
        grid._currentMode = 0;
        grid.layout_manager.rowsPerPage = c.rows;
        grid.layout_manager.columnsPerPage = c.columns;
        this._relayoutGrid(grid);

        display._redisplay?.();
    }

    destroy() {
        const display = appDisplay();
        const grid = display?._grid;
        this._injections.clear();

        for (const [settings, id] of this._wallpaperIds ?? [])
            settings.disconnect(id);
        this._wallpaperIds = null;
        this._wallpaperSettings = null;
        this._interfaceSettings = null;

        if (this._themeChangedId) {
            St.ThemeContext.get_for_stage(global.stage).disconnect(this._themeChangedId);
            this._themeChangedId = 0;
        }
        if (this._viewLoadedId && display) {
            display.disconnect(this._viewLoadedId);
            this._viewLoadedId = 0;
        }

        if (grid && this._gridState) {
            const state = this._gridState;
            if (state.hadOwnAdaptToSize)
                display.adaptToSize = state.adaptToSize;
            else
                delete display.adaptToSize;

            grid.layout_manager.fixedIconSize = state.fixedIconSize;
            grid.layout_manager.rowsPerPage = state.rowsPerPage;
            grid.layout_manager.columnsPerPage = state.columnsPerPage;
            grid.style = state.style;
            if (state.gridModes) {
                if (grid.setGridModes)
                    grid.setGridModes(state.gridModes.map(mode => ({...mode})));
                else
                    grid._gridModes = state.gridModes.map(mode => ({...mode}));
            }
            if (state.currentMode !== undefined)
                grid._currentMode = state.currentMode;
            if (display._pageIndicators)
                display._pageIndicators.style = state.pageIndicatorStyle;
            for (const className of GRID_CLASSES)
                grid.remove_style_class_name(className);
            this._relayoutGrid(grid);
        }

        this._restoreFolders();
        this._restoreBackground();
        this._unloadStylesheet();

        display?._redisplay?.();
        this._gridState = null;
    }

    _relayoutGrid(grid) {
        const layout = grid.layout_manager;
        if (layout._pageWidth !== undefined && layout._pageHeight !== undefined) {
            layout._pageWidth--;
            layout.adaptToSize(layout._pageWidth, layout._pageHeight);
        }
    }

    _adaptToSize(display, width, height) {
        let indicatorHeight = 0;
        try {
            [, indicatorHeight] = display._pageIndicators.get_preferred_height(-1);
        } catch {
            indicatorHeight = 0;
        }
        height -= indicatorHeight;

        let box = new Clutter.ActorBox({x2: width, y2: height});
        try {
            box = display.get_theme_node().get_content_box(box);
            box = display._scrollView.get_theme_node().get_content_box(box);
            box = display._grid.get_theme_node().get_content_box(box);
        } catch (e) {
            logError(e, 'shell-tweaks: app grid theme node');
        }

        const availWidth = box.get_width();
        const availHeight = box.get_height();
        const hPadding = this._c.sidePadding;
        let pageWidth = availWidth - hPadding * 2;
        if (hPadding < 0)
            pageWidth = Math.min(pageWidth, availWidth * 1.2);

        display._grid.layout_manager.adaptToSize(pageWidth, availHeight);

        const vPadding = Math.floor((availHeight - (display._grid.layout_manager.pageHeight ?? 0)) / 2);
        display._scrollView.content_padding = new Clutter.Margin({
            left: hPadding,
            right: hPadding,
            top: vPadding,
            bottom: vPadding,
        });

        display._availWidth = availWidth;
        display._availHeight = availHeight;
        display._pageIndicatorOffset = hPadding;
        display._pageArrowOffset = Math.max(hPadding - 80, 0);
    }

    _applyFolders() {
        const display = appDisplay();
        if (!Array.isArray(display?._folderIcons))
            return;
        const c = this._c;

        const active = new Set(display._folderIcons);
        for (const icon of this._folderStates.keys()) {
            if (!active.has(icon))
                this._folderStates.delete(icon);
        }

        for (const icon of display._folderIcons)
            this._applyFolderSafe(icon, c);
    }

    _applyFolderSafe(icon, c = this._c) {
        if (this._applying.has(icon))
            return;
        this._applying.add(icon);
        try {
            this._applyFolder(icon, c);
        } catch (e) {
            logError(e, 'shell-tweaks: folder icon');
        } finally {
            this._applying.delete(icon);
        }
    }

    _applyFolder(icon, c) {
        const grid = icon.view?._grid;
        if (!grid?.layout_manager)
            return;

        if (!this._folderStates.has(icon)) {
            this._folderStates.set(icon, {
                fixedIconSize: grid.layout_manager.fixedIconSize,
                rowsPerPage: grid.layout_manager.rowsPerPage,
                columnsPerPage: grid.layout_manager.columnsPerPage,
                gridStyle: grid.style,
                gridModes: grid._gridModes?.map(mode => ({...mode})),
                tile: null,
                dialogStyle: undefined,
                tunedDialogStyle: undefined,
                innerStyle: undefined,
                scrollClip: undefined,
                scrollPolicy: undefined,
                scrollPadding: undefined,
                openId: 0,
                dialog: null,
            });
        }
        const state = this._folderStates.get(icon);

        icon._ensureFolderDialog?.();
        const dialog = icon._dialog;
        if (dialog) {
            // title class first: the fixed geometry measures the title row
            if (c.hideFolderTitle)
                dialog.add_style_class_name('shell-tweaks-hide-folder-title');
            else
                dialog.remove_style_class_name('shell-tweaks-hide-folder-title');

            // re-check on every open: app count and theme may have changed
            if (state.dialog !== dialog) {
                if (state.openId && state.dialog)
                    state.dialog.disconnect(state.openId);
                state.dialog = dialog;
                state.openId = dialog.connect('open-state-changed', (_dialog, open) => {
                    if (!open)
                        return;
                    this._applyFolderSafe(icon);
                    if (this._c.debug)
                        this._logAllocation(icon);
                });
            }
        }

        const appCount = Math.max(1, icon.getAppIds().length);
        const fixed = c.folderPopupFixedSize && dialog;
        let geometry;
        if (fixed) {
            geometry = fixedFolderGeometry(icon, dialog, c, appCount);
        } else {
            // page dots appear only with more than one page and take room in the dialog
            let dotsHeight = 0;
            try {
                [, dotsHeight] = icon.view._pageIndicators.get_preferred_height(-1);
            } catch {
                dotsHeight = 0;
            }
            geometry = folderGeometry(c, appCount, dotsHeight || 40);
        }
        const {rows, columns, width, height} = geometry;
        if (c.debug) {
            console.log(`shell-tweaks[folder] ${icon.name}: apps=${appCount} fixed=${!!fixed} ` +
                `mode=${columns}x${rows} popup=${width}x${height} ${JSON.stringify(geometry.debug ?? {})}`);
        }

        grid.layout_manager.fixedIconSize = c.folderIconSize;
        grid.layout_manager.rowsPerPage = rows;
        grid.layout_manager.columnsPerPage = columns;

        // FolderGrid only has a 3x3 mode and IconGrid re-applies the grid mode
        // on first allocation; make the tuned size the only mode.
        const mode = [{rows, columns}];
        if (grid.setGridModes)
            grid.setGridModes(mode);
        else if (grid._gridModes)
            grid._gridModes = mode;

        const gridStyle = state.gridStyle ?? '';
        grid.style = c.folderIconFontSize > 0
            ? `${gridStyle} font-size: ${c.folderIconFontSize}px;`
            : gridStyle;

        if (dialog?.child) {
            if (state.dialogStyle === undefined)
                state.dialogStyle = dialog.child.style ?? '';

            const padding = fixed ? 0 : c.folderSidePadding;
            const colors = boxStyle(c.folderPopupBackgroundColor, c.folderPopupBackgroundOpacity,
                c.folderPopupBorderRadius, c.folderPopupBorderColor);
            // St sizes the content box: with no side padding the visible popup
            // (the inner box) is exactly width x height; colours go on that box only
            const dialogStyle = `${state.dialogStyle} height: ${height}px; width: ${width}px; ` +
                `padding-left: ${padding}px; padding-right: ${padding}px;${fixed ? '' : colors}`;
            state.tunedDialogStyle = dialogStyle;
            dialog.child.style = `${dialogStyle} transition-duration: ${c.openAnimationTime}ms;`;

            const inner = dialog.child.get_first_child?.() ?? null;
            if (inner) {
                if (state.innerStyle === undefined)
                    state.innerStyle = inner.style ?? '';
                // read the theme colour without our style each time: the theme
                // can change (light/dark, user theme) after the first apply
                inner.style = state.innerStyle || null;
                const themeColor = themeBackground(inner);
                inner.style = state.innerStyle + popupBackground(c, themeColor) +
                    boxStyle('', 1, c.folderPopupBorderRadius, c.folderPopupBorderColor);

                if (fixed) {
                    // CSS width/height are only preferred sizes in St: content
                    // asking for more (the folder view asks 720x720) wins, and the
                    // container fills the whole monitor. A Clutter fixed size and a
                    // centred container make W x H a hard limit; content is clipped.
                    if (state.innerFixed === undefined) {
                        state.innerFixed = {
                            minWidthSet: inner.min_width_set,
                            minHeightSet: inner.min_height_set,
                            naturalWidthSet: inner.natural_width_set,
                            naturalHeightSet: inner.natural_height_set,
                            clip: inner.clip_to_allocation,
                            xAlign: dialog.child.x_align,
                            yAlign: dialog.child.y_align,
                        };
                    }
                    inner.set_size(width, height);
                    inner.clip_to_allocation = true;
                    dialog.child.x_align = Clutter.ActorAlign.CENTER;
                    dialog.child.y_align = Clutter.ActorAlign.CENTER;
                } else if (state.innerFixed) {
                    this._releaseFixedSize(dialog, inner, state);
                }
            }

            const scrollView = dialog._scrollView;
            if (scrollView) {
                if (state.scrollClip === undefined)
                    state.scrollClip = scrollView.clip_to_allocation ?? false;
                if (state.scrollPolicy === undefined && scrollView.get_policy)
                    state.scrollPolicy = scrollView.get_policy();
                if (state.scrollPadding === undefined && scrollView.content_padding) {
                    const p = scrollView.content_padding;
                    state.scrollPadding = {left: p.left, right: p.right, top: p.top, bottom: p.bottom};
                }
                scrollView.clip_to_allocation = true;
                scrollView.content_padding = new Clutter.Margin({left: padding, right: padding, top: 0, bottom: 0});
                scrollView.set_policy?.(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
            }
        }

        icon.view._redisplay?.();
        grid.queue_relayout();
    }

    _logAllocation(icon) {
        // after the open animation, report what GNOME actually allocated
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
            try {
                const size = actor => {
                    const box = actor.get_allocation_box();
                    return `${Math.round(box.get_width())}x${Math.round(box.get_height())}`;
                };
                const dialog = icon._dialog;
                const grid = icon.view._grid;
                const mode = grid._gridModes?.[0] ?? {};
                console.log(`shell-tweaks[folder] ${icon.name} opened: popup=${size(dialog._viewBox)} ` +
                    `container=${size(dialog.child)} grid=${size(grid)} mode=${mode.columns}x${mode.rows} ` +
                    `pages=${grid.nPages} viewBoxPreferred=${dialog._viewBox.get_preferred_height(-1).map(Math.round)} ` +
                    `style="${dialog.child.style}"`);
            } catch (e) {
                logError(e, 'shell-tweaks: folder debug');
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _releaseFixedSize(dialog, inner, state) {
        const saved = state.innerFixed;
        inner.set_size(-1, -1);
        inner.min_width_set = saved.minWidthSet;
        inner.min_height_set = saved.minHeightSet;
        inner.natural_width_set = saved.naturalWidthSet;
        inner.natural_height_set = saved.naturalHeightSet;
        inner.clip_to_allocation = saved.clip;
        dialog.child.x_align = saved.xAlign;
        dialog.child.y_align = saved.yAlign;
        state.innerFixed = undefined;
    }

    _restoreFolders() {
        for (const [icon, state] of this._folderStates) {
            try {
                const grid = icon.view?._grid;
                if (grid?.layout_manager) {
                    grid.layout_manager.fixedIconSize = state.fixedIconSize;
                    grid.layout_manager.rowsPerPage = state.rowsPerPage;
                    grid.layout_manager.columnsPerPage = state.columnsPerPage;
                    if (state.gridModes) {
                        if (grid.setGridModes)
                            grid.setGridModes(state.gridModes.map(mode => ({...mode})));
                        else
                            grid._gridModes = state.gridModes.map(mode => ({...mode}));
                    }
                    grid.style = state.gridStyle;
                }

                if (state.openId && state.dialog)
                    state.dialog.disconnect(state.openId);
                const dialog = icon._dialog;
                if (dialog?.child) {
                    dialog.remove_style_class_name('shell-tweaks-hide-folder-title');
                    if (state.dialogStyle !== undefined)
                        dialog.child.style = state.dialogStyle;
                    const inner = dialog.child.get_first_child?.() ?? null;
                    if (inner && state.innerStyle !== undefined)
                        inner.style = state.innerStyle;
                    if (inner && state.innerFixed)
                        this._releaseFixedSize(dialog, inner, state);
                    const scrollView = dialog._scrollView;
                    if (scrollView) {
                        if (state.scrollClip !== undefined)
                            scrollView.clip_to_allocation = state.scrollClip;
                        if (state.scrollPadding)
                            scrollView.content_padding = new Clutter.Margin(state.scrollPadding);
                        if (state.scrollPolicy && scrollView.set_policy)
                            scrollView.set_policy(...state.scrollPolicy);
                    }
                }
            } catch (e) {
                logError(e, 'shell-tweaks: restore folder');
            }
        }
        this._folderStates.clear();
    }

    _applyAnimations() {
        const display = appDisplay();
        if (!display)
            return;
        const c = this._c;
        if (display._pageIndicators) {
            display._pageIndicators.style =
                `${this._gridState?.pageIndicatorStyle ?? ''} transition-duration: ${c.pageSwitchAnimationTime}ms;`;
        }
        for (const icon of display._folderIcons ?? []) {
            if (!icon._dialog?.child)
                continue;
            // keep the size and colours set by _applyFolder()
            const state = this._folderStates.get(icon);
            const base = state?.tunedDialogStyle ?? state?.dialogStyle ?? '';
            icon._dialog.child.style = `${base} transition-duration: ${c.openAnimationTime}ms;`;
        }
    }

    _backgroundActors() {
        const overview = Main.overview._overview;
        return [overview, overview?._workspacesDisplay, overview?._controls, appDisplay()]
            .filter((actor, i, all) => actor && all.indexOf(actor) === i);
    }

    _applyBackground() {
        const c = this._c;
        const overview = Main.overview._overview;
        const target = overview;
        const tintTarget = overview?._controls;

        let declarations = '';
        let tint = '';
        if (c.backgroundMode === 'solid-color' && isHexColor(c.backgroundColor)) {
            declarations = `background-color: ${c.backgroundColor};`;
        } else if (c.backgroundMode === 'image' || c.backgroundMode === 'wallpaper') {
            const uri = c.backgroundMode === 'image' ? imageUri(c.backgroundImage) : this._wallpaperUri();
            if (uri) {
                declarations = `background-image: url("${uri}");` +
                    'background-size: cover; background-position: center;';
                // the tint sits on the controls actor, which covers the image
                const opacity = Math.min(1, Math.max(0, c.backgroundTintOpacity));
                if (opacity > 0 && isHexColor(c.backgroundTintColor))
                    tint = `background-color: ${hexToCss(c.backgroundTintColor, opacity)};`;
            }
        } else if (c.backgroundMode === 'gradient' && isHexColor(c.backgroundColor)) {
            const end = isHexColor(c.gradientSecondaryColor)
                ? c.gradientSecondaryColor
                : shade(c.backgroundColor, 0.8);
            const direction = c.gradientType === 'linear-horizontal' ? 'horizontal' : 'vertical';
            declarations = `background-gradient-direction: ${direction};` +
                `background-gradient-start: ${c.backgroundColor};` +
                `background-gradient-end: ${end};`;
        }

        for (const actor of this._backgroundActors()) {
            if (!this._backgroundStates.has(actor))
                this._backgroundStates.set(actor, actor.style);
            const base = (this._backgroundStates.get(actor) ?? '')
                .replace(/background-(color|image|size|position|gradient-direction|gradient-start|gradient-end):[^;]*;?/g, '');
            let style = base;
            if (actor === target && declarations)
                style += declarations;
            else if (actor === tintTarget && tint)
                style += tint;
            actor.style = style || null;
        }
    }

    /** The desktop wallpaper, dark variant with the dark style; null for XML slideshows. */
    _wallpaperUri() {
        const background = this._wallpaperSettings;
        if (!background)
            return null;
        const dark = this._interfaceSettings?.get_string('color-scheme') === 'prefer-dark';
        const uri = background.get_string(dark ? 'picture-uri-dark' : 'picture-uri') ||
            background.get_string('picture-uri');
        if (!uri || uri.toLowerCase().endsWith('.xml'))
            return null;
        // through GFile, so the URI in CSS is always properly encoded
        const file = uri.startsWith('file://')
            ? Gio.File.new_for_path(decodeURIComponent(uri.slice('file://'.length)))
            : Gio.File.new_for_uri(uri);
        return file.query_exists(null) ? file.get_uri() : null;
    }

    _restoreBackground() {
        for (const [actor, style] of this._backgroundStates)
            actor.style = style;
        this._backgroundStates.clear();
    }

    _loadStylesheet() {
        const c = this._c;
        let css = '';

        if (isHexColor(c.labelColor)) {
            css += `.shell-tweaks-label-color .icon-label, .shell-tweaks-label-color .overview-icon-label, .shell-tweaks-label-color StLabel ` +
                `{ color: ${c.labelColor} !important; }\n`;
        }

        if (c.labelStyle) {
            let style = c.labelStyle;
            if (isHexColor(c.labelShadowColor)) {
                style = style.replace(/text-shadow:\s*([^;]*?)(#[0-9a-fA-F]{6}|rgba?\([^)]+\))/g,
                    `text-shadow: $1${c.labelShadowColor}`);
            }
            const declarations = style.split(';').map(part => part.trim()).filter(Boolean)
                .map(part => {
                    const at = part.indexOf(':');
                    return at < 0 ? null : `${part.slice(0, at).trim()}: ${part.slice(at + 1).trim()} !important;`;
                })
                .filter(Boolean);
            if (!declarations.some(d => d.startsWith('text-shadow:')))
                declarations.push('text-shadow: none !important;');
            css += `.shell-tweaks-label-style .icon-label, .shell-tweaks-label-style .overview-icon-label, .shell-tweaks-label-style StLabel ` +
                `{ ${declarations.join(' ')} }\n`;
        }

        // folder icons in the grid (.app-folder): colour (or the theme's) at the
        // chosen opacity, a little brighter on hover
        const tileColor = isHexColor(c.folderTileBackgroundColor)
            ? c.folderTileBackgroundColor
            : this._themeFolderColor;
        if (tileColor) {
            const opacity = Math.min(1, Math.max(0, c.folderTileBackgroundOpacity));
            const rgba = (a) => hexToCss(tileColor, Math.min(1, a));
            let extra = '';
            if (c.folderTileBorderRadius > 0)
                extra += ` border-radius: ${c.folderTileBorderRadius}px !important;`;
            if (isHexColor(c.folderTileBorderColor))
                extra += ` border: 1px solid ${c.folderTileBorderColor} !important;`;
            css += `.shell-tweaks-folder-tile .app-folder { background-color: ${rgba(opacity)} !important;${extra} }\n`;
            css += `.shell-tweaks-folder-tile .app-folder:hover { background-color: ${rgba(opacity + 0.08)} !important; }\n`;
            css += `.shell-tweaks-folder-tile .app-folder:active, .shell-tweaks-folder-tile .app-folder:checked ` +
                `{ background-color: ${rgba(opacity + 0.18)} !important; }\n`;
        }

        if (c.hoverEnabled) {
            const parts = [];
            if (isHexColor(c.hoverBackgroundColor))
                parts.push(`background-color: ${hexToCss(c.hoverBackgroundColor, c.hoverBackgroundOpacity)} !important;`);
            if (isHexColor(c.hoverBorderColor))
                parts.push(`box-shadow: 0 0 0 1px ${c.hoverBorderColor} !important;`);
            if (parts.length)
                css += `.shell-tweaks-app-hover .overview-tile:hover { ${parts.join(' ')} }\n`;
        }

        if (!css)
            return;

        const dir = GLib.build_filenamev([GLib.get_user_cache_dir(), 'shell-tweaks']);
        GLib.mkdir_with_parents(dir, 0o755);
        const file = Gio.File.new_for_path(GLib.build_filenamev([dir, 'app-grid.css']));
        try {
            file.replace_contents(css, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            St.ThemeContext.get_for_stage(global.stage).get_theme()?.load_stylesheet(file);
            this._stylesheet = file;
        } catch (e) {
            logError(e, 'shell-tweaks: app grid stylesheet');
        }
    }

    _unloadStylesheet() {
        if (!this._stylesheet)
            return;
        St.ThemeContext.get_for_stage(global.stage).get_theme()?.unload_stylesheet(this._stylesheet);
        this._stylesheet = null;
    }
}

export class AppGridModule extends Module {
    static get key() {
        return 'module-app-grid';
    }

    features() {
        const extension = this.extension;
        return [{
            name: 'app-grid-layout',
            keys: KEYS,
            apply(lc, s) {
                if (!appDisplay())
                    return;
                const tuner = new AppGridTuner(readConfig(s), extension);
                lc.defer(() => tuner.destroy());
                tuner.start();
            },
        }];
    }
}
