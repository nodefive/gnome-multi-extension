// SPDX-License-Identifier: GPL-3.0-only
// Preference rows built from the schema: type, range, summary and
// description come from the gschema, so labels live in one place.

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

// Integer keys that are really enumerations: index -> label.
export const INT_LABELS = {
    'panel-position': ['Top', 'Bottom'],
    'panel-clock-menu-position': ['Center', 'Right', 'Left'],
    'overview-startup-status': ['Desktop', 'Overview'],
    'shell-animation': ['Off', 'Default', 'Almost none', 'Fastest', 'Faster', 'Fast', 'Slow', 'Slower', 'Slowest'],
    'shell-osd-position': [
        'Default', 'Top start', 'Top center', 'Top end', 'Bottom start', 'Bottom center',
        'Bottom end', 'Middle start', 'Middle center', 'Middle end',
    ],
    'shell-notification-banner-position': [
        'Top start', 'Top center', 'Top end', 'Bottom start', 'Bottom center', 'Bottom end',
    ],
};

// String choice keys: value -> label.
export const STRING_LABELS = {
    'date-menu-hide-scope': {'whole-list': 'Whole list', 'notifications-only': 'Notifications only (keep media controls)'},
    'app-grid-label-style': {
        '': 'Theme default',
        'font-weight: normal;': 'Normal',
        'font-weight: normal; text-shadow: 2px 3px 3px #000000;': 'Normal with shadow',
        'font-weight: bold;': 'Bold',
        'font-weight: bold; text-shadow: 2px 3px 3px #000000;': 'Bold with shadow',
    },
    'app-grid-background-mode': {
        'system': 'Theme', 'solid-color': 'Solid colour', 'gradient': 'Gradient',
        'image': 'Image', 'wallpaper': 'Current wallpaper',
    },
    'app-grid-gradient-type': {'linear-vertical': 'Vertical', 'linear-horizontal': 'Horizontal'},
};

function schemaKey(settings, key) {
    return settings.settings_schema.get_key(key);
}

function rangeOf(schemaKeyObj) {
    const range = schemaKeyObj.get_range().recursiveUnpack();
    return range;
}

function applySubtitle(row, schemaKeyObj) {
    const description = schemaKeyObj.get_description();
    if (description)
        row.subtitle = GLib.markup_escape_text(description, -1);
}

function comboRow(settings, key, labels, values, read, write) {
    const k = schemaKey(settings, key);
    const row = new Adw.ComboRow({
        title: k.get_summary(),
        model: Gtk.StringList.new(labels),
    });
    applySubtitle(row, k);
    const sync = () => {
        const index = values.indexOf(read());
        if (index >= 0 && row.selected !== index)
            row.selected = index;
    };
    sync();
    row.connect('notify::selected', () => {
        const value = values[row.selected];
        if (value !== undefined && value !== read())
            write(value);
    });
    const id = settings.connect(`changed::${key}`, sync);
    row.connect('destroy', () => settings.disconnect(id));
    return row;
}

function hexToRgba(hex) {
    const rgba = new Gdk.RGBA();
    rgba.parse(hex);
    return rgba;
}

function rgbaToHex(rgba) {
    const channel = v => Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${channel(rgba.red)}${channel(rgba.green)}${channel(rgba.blue)}`;
}

/**
 * Colour picker for a "#rrggbb" string key. An empty value means the theme
 * colour; the reset button returns to the key's default.
 */
function colorRow(settings, key, title, schemaKeyObj) {
    const row = new Adw.ActionRow({title});
    applySubtitle(row, schemaKeyObj);

    const themeLabel = new Gtk.Label({label: 'Theme', valign: Gtk.Align.CENTER, css_classes: ['dim-label']});
    const button = new Gtk.ColorDialogButton({
        dialog: new Gtk.ColorDialog({with_alpha: false, title}),
        valign: Gtk.Align.CENTER,
    });
    const reset = new Gtk.Button({
        icon_name: 'edit-undo-symbolic',
        tooltip_text: 'Reset to default',
        valign: Gtk.Align.CENTER,
        css_classes: ['flat'],
    });
    row.add_suffix(themeLabel);
    row.add_suffix(button);
    row.add_suffix(reset);

    let syncing = false;
    const sync = () => {
        const value = settings.get_string(key);
        const isColor = /^#[0-9a-fA-F]{6}$/.test(value);
        themeLabel.visible = !isColor;
        syncing = true;
        button.rgba = hexToRgba(isColor ? value : '#808080');
        syncing = false;
    };
    sync();
    button.connect('notify::rgba', () => {
        if (syncing)
            return;
        const hex = rgbaToHex(button.rgba);
        if (hex !== settings.get_string(key))
            settings.set_string(key, hex);
    });
    reset.connect('clicked', () => settings.reset(key));
    const id = settings.connect(`changed::${key}`, sync);
    row.connect('destroy', () => settings.disconnect(id));
    return row;
}

/**
 * Create a row for any scalar key of the schema.
 */
export function rowFor(settings, key) {
    const k = schemaKey(settings, key);
    const type = k.get_value_type().dup_string();
    const title = k.get_summary() ?? key;

    if (type === 'b') {
        const row = new Adw.SwitchRow({title});
        applySubtitle(row, k);
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    if (type === 'i' && INT_LABELS[key]) {
        const labels = INT_LABELS[key];
        return comboRow(settings, key, labels, labels.map((_, i) => i),
            () => settings.get_int(key), v => settings.set_int(key, v));
    }

    if (type === 'i' || type === 'd') {
        const [kind, bounds] = rangeOf(k);
        const [min, max] = kind === 'range' ? bounds : [type === 'i' ? -10000 : 0, 10000];
        const row = Adw.SpinRow.new_with_range(min, max, type === 'd' ? 0.01 : 1);
        row.title = title;
        row.digits = type === 'd' ? 2 : 0;
        applySubtitle(row, k);
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    if (type === 's') {
        const [kind, choices] = rangeOf(k);
        if (kind === 'enum') {
            const labels = STRING_LABELS[key] ?? {};
            return comboRow(settings, key, choices.map(c => labels[c] ?? c), choices,
                () => settings.get_string(key), v => settings.set_string(key, v));
        }
        if (key.endsWith('-color'))
            return colorRow(settings, key, title, k);
        const row = new Adw.EntryRow({title, show_apply_button: true});
        row.text = settings.get_string(key);
        row.connect('apply', () => settings.set_string(key, row.text));
        const id = settings.connect(`changed::${key}`, () => {
            if (row.text !== settings.get_string(key))
                row.text = settings.get_string(key);
        });
        row.connect('destroy', () => settings.disconnect(id));
        return row;
    }

    throw new Error(`No row type for ${key} (${type})`);
}

export function group(title, settings, keys, description = null) {
    const g = new Adw.PreferencesGroup({title});
    if (description)
        g.description = description;
    for (const key of keys)
        g.add(rowFor(settings, key));
    return g;
}

/**
 * A page with the module switch on top and a "reset" button that resets
 * every key shown on the page.
 */
export function modulePage({title, icon, settings, moduleKey, groups, extraKeys = []}) {
    const page = new Adw.PreferencesPage({title, icon_name: icon});
    const head = new Adw.PreferencesGroup();
    if (moduleKey) {
        const row = rowFor(settings, moduleKey);
        row.title = `Enable ${title}`;
        head.add(row);
    }

    const resetRow = new Adw.ActionRow({title: 'Reset this page to defaults'});
    const resetButton = new Gtk.Button({label: 'Reset', valign: Gtk.Align.CENTER, css_classes: ['destructive-action']});
    resetRow.add_suffix(resetButton);
    head.add(resetRow);
    page.add(head);

    const keys = [...extraKeys];
    for (const g of groups) {
        page.add(g.widget ?? g);
        keys.push(...(g.keys ?? []));
    }
    resetButton.connect('clicked', () => {
        for (const key of keys)
            settings.reset(key);
    });
    return page;
}

export function keyedGroup(title, settings, keys, description = null) {
    return {widget: group(title, settings, keys, description), keys};
}
