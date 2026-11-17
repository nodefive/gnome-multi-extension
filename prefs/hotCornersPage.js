// SPDX-License-Identifier: GPL-3.0-only

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ACTIONS, CORNERS, actionById} from '../lib/actionList.js';
import {keyedGroup, modulePage, rowFor} from './widgets.js';

const SELECTABLE = ACTIONS;
const MENU_ACTIONS = ACTIONS.filter(a => a.id !== 'disabled' && !a.id.startsWith('show-custom-menu'));

function actionCombo(settings, key, title) {
    const row = new Adw.ComboRow({
        title,
        model: Gtk.StringList.new(SELECTABLE.map(a => (a.group ? `${a.group}: ${a.name}` : a.name))),
        enable_search: true,
    });
    const sync = () => {
        const index = SELECTABLE.findIndex(a => a.id === settings.get_string(key));
        row.selected = index < 0 ? 0 : index;
    };
    sync();
    row.connect('notify::selected', () => {
        const id = SELECTABLE[row.selected]?.id;
        if (id && id !== settings.get_string(key))
            settings.set_string(key, id);
    });
    const handler = settings.connect(`changed::${key}`, sync);
    row.connect('destroy', () => settings.disconnect(handler));
    return row;
}

function cornerGroup(settings, corner) {
    const g = new Adw.PreferencesGroup({title: corner.name});
    const keys = [];
    for (const [prefix, label] of [['', ''], ['ctrl-', 'With Ctrl: ']]) {
        const base = `hot-corners-${corner.id}-${prefix}`;
        keys.push(`${base}action`, `${base}command`, `${base}fullscreen`);

        g.add(actionCombo(settings, `${base}action`, `${label}Action`));

        const command = rowFor(settings, `${base}command`);
        command.title = `${label}Command or app ID (.desktop) for "Run Command"`;
        g.add(command);

        const fullscreen = rowFor(settings, `${base}fullscreen`);
        fullscreen.title = `${label}Active in fullscreen apps`;
        g.add(fullscreen);

        const syncCommand = () => {
            command.visible = actionById(settings.get_string(`${base}action`)).needsCommand === true;
        };
        syncCommand();
        settings.connect(`changed::${base}action`, syncCommand);
    }
    return {widget: g, keys};
}

function shortcutsGroup(settings) {
    const key = 'hot-corners-keyboard-shortcuts';
    const g = new Adw.PreferencesGroup({
        title: 'Keyboard Shortcuts',
        description: 'Accelerators use GTK syntax, for example &lt;Super&gt;&lt;Alt&gt;l',
    });
    const rows = [];

    const addRow = new Adw.ActionRow({title: 'Add shortcut'});
    const actionDrop = new Gtk.DropDown({
        model: Gtk.StringList.new(MENU_ACTIONS.map(a => a.name)),
        valign: Gtk.Align.CENTER,
        enable_search: true,
    });
    const accelEntry = new Gtk.Entry({placeholder_text: '<Super><Alt>l', valign: Gtk.Align.CENTER, width_chars: 16});
    const addButton = new Gtk.Button({icon_name: 'list-add-symbolic', valign: Gtk.Align.CENTER});
    addRow.add_suffix(actionDrop);
    addRow.add_suffix(accelEntry);
    addRow.add_suffix(addButton);
    g.add(addRow);

    const rebuild = () => {
        for (const row of rows)
            g.remove(row);
        rows.length = 0;
        for (const entry of settings.get_strv(key)) {
            const [action, accelerator] = entry.split(' ');
            const row = new Adw.ActionRow({title: actionById(action).name, subtitle: accelerator ?? ''});
            const remove = new Gtk.Button({icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER, css_classes: ['flat']});
            remove.connect('clicked', () => settings.set_strv(key, settings.get_strv(key).filter(e => e !== entry)));
            row.add_suffix(remove);
            g.add(row);
            rows.push(row);
        }
    };

    addButton.connect('clicked', () => {
        const accelerator = accelEntry.text.trim();
        const [ok] = Gtk.accelerator_parse(accelerator);
        if (!ok || !accelerator) {
            accelEntry.add_css_class('error');
            return;
        }
        accelEntry.remove_css_class('error');
        const action = MENU_ACTIONS[actionDrop.selected].id;
        settings.set_strv(key, [...settings.get_strv(key), `${action} ${accelerator}`]);
        accelEntry.text = '';
    });

    settings.connect(`changed::${key}`, rebuild);
    rebuild();
    return {widget: g, keys: [key]};
}

function customMenusGroup(settings) {
    const g = new Adw.PreferencesGroup({
        title: 'Custom Menus',
        description: 'Assign "Custom Menu 1-4" to a corner or shortcut to open these menus',
    });
    const keys = [];
    for (let i = 1; i <= 4; i++) {
        const key = `hot-corners-custom-menu-${i}`;
        keys.push(key);
        const expander = new Adw.ExpanderRow({title: `Custom menu ${i}`});
        const rows = new Map();
        const sync = () => {
            const list = settings.get_strv(key);
            expander.subtitle = `${list.length} actions`;
            for (const [id, row] of rows) {
                if (row.active !== list.includes(id))
                    row.active = list.includes(id);
            }
        };
        for (const action of MENU_ACTIONS) {
            const row = new Adw.SwitchRow({title: action.name, subtitle: action.group});
            row.active = settings.get_strv(key).includes(action.id);
            row.connect('notify::active', () => {
                const list = settings.get_strv(key);
                if (row.active === list.includes(action.id))
                    return;
                settings.set_strv(key, row.active
                    ? [...list, action.id]
                    : list.filter(id => id !== action.id));
            });
            rows.set(action.id, row);
            expander.add_row(row);
        }
        settings.connect(`changed::${key}`, sync);
        sync();
        g.add(expander);
    }
    return {widget: g, keys};
}

export function hotCornersPage(settings) {
    return modulePage({
        title: 'Hot Corners',
        icon: 'input-mouse-symbolic',
        settings,
        moduleKey: 'module-hot-corners',
        groups: [
            keyedGroup('General', settings, [
                'hot-corners-enabled', 'hot-corners-require-shift', 'hot-corners-ripple', 'hot-corners-panel-menu',
            ], 'Corners are on the primary monitor'),
            ...CORNERS.map(corner => cornerGroup(settings, corner)),
            keyedGroup('Trigger', settings, [
                'hot-corners-barrier-size-h', 'hot-corners-barrier-size-v',
                'hot-corners-pressure-threshold', 'hot-corners-action-delay',
            ]),
            shortcutsGroup(settings),
            customMenusGroup(settings),
            keyedGroup('Debug', settings, ['hot-corners-corners-visible', 'hot-corners-barrier-fallback']),
        ],
    });
}
