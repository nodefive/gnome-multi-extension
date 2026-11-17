// SPDX-License-Identifier: GPL-3.0-only

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {keyedGroup, modulePage, rowFor} from './widgets.js';

// GLib 2.86 moved DesktopAppInfo to GioUnix; keep Gio as a fallback
// (reading Gio.DesktopAppInfo at all logs a deprecation warning on GLib 2.86)
let DesktopAppInfo;
try {
    DesktopAppInfo = (await import('gi://GioUnix')).default.DesktopAppInfo;
} catch {
    DesktopAppInfo = Gio.DesktopAppInfo;
}

function appLabel(appId) {
    const info = DesktopAppInfo.new(appId);
    return info ? [info.get_display_name(), appId, info.get_icon()] : [appId, 'not installed', null];
}

/** Group listing the apps of a string-array key, each with an unhide button. */
function hiddenAppsGroup(settings, key, title, buttonLabel) {
    const g = new Adw.PreferencesGroup({title});
    const placeholder = new Adw.ActionRow({title: 'None'});
    placeholder.add_css_class('dim-label');
    const rows = [];

    const rebuild = () => {
        for (const row of rows)
            g.remove(row);
        rows.length = 0;

        const ids = settings.get_strv(key);
        if (!ids.length) {
            g.add(placeholder);
            rows.push(placeholder);
            return;
        }
        for (const id of ids) {
            const [name, subtitle, icon] = appLabel(id);
            const row = new Adw.ActionRow({title: GLib.markup_escape_text(name, -1), subtitle});
            if (icon)
                row.add_prefix(new Gtk.Image({gicon: icon, pixel_size: 32}));
            const button = new Gtk.Button({label: buttonLabel, valign: Gtk.Align.CENTER});
            button.connect('clicked', () => settings.set_strv(key, settings.get_strv(key).filter(v => v !== id)));
            row.add_suffix(button);
            g.add(row);
            rows.push(row);
        }
    };

    settings.connect(`changed::${key}`, rebuild);
    rebuild();
    return {widget: g, keys: [key]};
}

export function appMenuPage(settings) {
    return modulePage({
        title: 'Apps',
        icon: 'view-app-grid-symbolic',
        settings,
        moduleKey: 'module-app-menu',
        groups: [
            keyedGroup('App Icon Menu', settings, [
                'app-menu-hide-item', 'app-menu-hide-from-search-item',
                'app-menu-edit-entry-item', 'app-menu-open-location-item',
            ], 'Hide items appear on app grid and folder icons; edit items on every app menu'),
            keyedGroup('Editing', settings, [
                'app-menu-edit-local-copy', 'app-menu-use-custom-edit-command', 'app-menu-custom-edit-command',
            ]),
            hiddenAppsGroup(settings, 'app-menu-hidden-apps', 'Hidden from the App Grid', 'Unhide'),
            hiddenAppsGroup(settings, 'app-menu-hidden-search-apps', 'Hidden from Search', 'Show in search'),
        ],
    });
}

export function wallpaperPage(settings, window) {
    const folderGroup = new Adw.PreferencesGroup({title: 'Folder'});
    const folderRow = new Adw.ActionRow({title: 'Wallpaper folder'});
    const sync = () => {
        folderRow.subtitle = GLib.markup_escape_text(
            settings.get_string('wallpaper-folder') || 'Pictures folder', -1);
    };
    sync();
    settings.connect('changed::wallpaper-folder', sync);

    const choose = new Gtk.Button({label: 'Choose…', valign: Gtk.Align.CENTER});
    choose.connect('clicked', () => {
        const dialog = new Gtk.FileDialog({title: 'Wallpaper folder', modal: true});
        const current = settings.get_string('wallpaper-folder');
        if (current)
            dialog.initial_folder = Gio.File.new_for_path(current);
        dialog.select_folder(window, null, (_dialog, result) => {
            try {
                const folder = dialog.select_folder_finish(result);
                if (folder?.get_path())
                    settings.set_string('wallpaper-folder', folder.get_path());
            } catch {
                // dismissed
            }
        });
    });
    folderRow.add_suffix(choose);
    folderGroup.add(folderRow);
    folderGroup.add(rowFor(settings, 'wallpaper-avoid-repeat'));

    return modulePage({
        title: 'Wallpaper',
        icon: 'preferences-desktop-wallpaper-symbolic',
        settings,
        moduleKey: 'module-wallpaper',
        groups: [
            {widget: folderGroup, keys: ['wallpaper-folder', 'wallpaper-avoid-repeat']},
            keyedGroup('Automatic Change', settings, ['wallpaper-auto-change', 'wallpaper-interval']),
        ],
    });
}

/**
 * Row choosing an image file for a string key; active only while
 * `modeKey` is `modeValue`.
 */
export function imageFileRow(settings, key, window, modeKey, modeValue) {
    const row = new Adw.ActionRow({title: 'Background image'});
    const sync = () => {
        const path = settings.get_string(key);
        row.subtitle = GLib.markup_escape_text(path || 'None', -1);
        row.sensitive = settings.get_string(modeKey) === modeValue;
    };
    sync();
    settings.connect(`changed::${key}`, sync);
    settings.connect(`changed::${modeKey}`, sync);

    const choose = new Gtk.Button({label: 'Choose…', valign: Gtk.Align.CENTER});
    choose.connect('clicked', () => {
        const filter = new Gtk.FileFilter({name: 'Images'});
        filter.add_pixbuf_formats();
        const filters = new Gio.ListStore({item_type: Gtk.FileFilter});
        filters.append(filter);
        const dialog = new Gtk.FileDialog({title: 'Background image', modal: true, filters});
        const current = settings.get_string(key);
        if (current)
            dialog.initial_file = Gio.File.new_for_path(current);
        dialog.open(window, null, (_dialog, result) => {
            try {
                const file = dialog.open_finish(result);
                if (file?.get_path())
                    settings.set_string(key, file.get_path());
            } catch {
                // dismissed
            }
        });
    });
    row.add_suffix(choose);
    return row;
}
