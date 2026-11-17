// SPDX-License-Identifier: GPL-3.0-only
// App icon menu items and app hiding. Ported from app-hider (hide from the
// grid and from search) and Edit Desktop Files (GPL-2.0-or-later, Dannflower).

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import {AppMenu} from 'resource:///org/gnome/shell/ui/appMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Module} from '../lib/module.js';
import {queueAppGridRedisplay} from '../lib/shell.js';

const USER_APPLICATIONS = GLib.build_filenamev([GLib.get_user_data_dir(), 'applications']);

function appendUnique(settings, key, value) {
    const list = settings.get_strv(key);
    if (!list.includes(value))
        settings.set_strv(key, [...list, value]);
}

function removeValue(settings, key, value) {
    settings.set_strv(key, settings.get_strv(key).filter(v => v !== value));
}

/**
 * For entries outside the user's applications directory, copy the file there
 * first: a user copy with the same desktop ID overrides the system one, and
 * is the only one the user can save.
 */
function editablePath(appId, filename, makeLocalCopy) {
    if (!makeLocalCopy || filename.startsWith(`${USER_APPLICATIONS}/`))
        return filename;

    const target = GLib.build_filenamev([USER_APPLICATIONS, appId]);
    const targetFile = Gio.File.new_for_path(target);
    if (!targetFile.query_exists(null)) {
        GLib.mkdir_with_parents(USER_APPLICATIONS, 0o755);
        Gio.File.new_for_path(filename).copy(targetFile, Gio.FileCopyFlags.NONE, null, null);
    }
    return target;
}

function openForEditing(settings, path) {
    if (settings.get_boolean('app-menu-use-custom-edit-command')) {
        const command = settings.get_string('app-menu-custom-edit-command');
        try {
            const [, argv] = GLib.shell_parse_argv(command);
            if (argv.includes('%U')) {
                GLib.spawn_async(null, argv.map(arg => (arg === '%U' ? path : arg)), null,
                    GLib.SpawnFlags.SEARCH_PATH, null);
                return;
            }
            console.warn(`shell-tweaks: custom edit command has no %U, using the default application`);
        } catch (e) {
            logError(e, 'shell-tweaks: custom edit command');
        }
    }
    const uri = Gio.File.new_for_path(path).get_uri();
    Gio.AppInfo.launch_default_for_uri_async(uri, null, null, null);
}

function openLocation(path) {
    const file = Gio.File.new_for_path(path);
    const fileManager = Gio.AppInfo.get_default_for_type('inode/directory', false);
    if (fileManager?.get_executable() === 'nautilus') {
        GLib.spawn_async(null, ['nautilus', '--select', file.get_path()], null,
            GLib.SpawnFlags.SEARCH_PATH, null);
        return;
    }
    Gio.AppInfo.launch_default_for_uri_async(file.get_parent().get_uri(), null, null, null);
}

export class AppMenuModule extends Module {
    static get key() {
        return 'module-app-menu';
    }

    onEnable(lc) {
        // App grid and folder icons, recorded while they load; only these
        // get the Hide items, like app-hider.
        this._gridIcons = new WeakSet();
        lc.defer(() => {
            this._gridIcons = null;
        });
    }

    features() {
        const module = this;
        return [
            {
                name: 'app-menu-filter',
                keys: [
                    'app-menu-hidden-apps', 'app-menu-hidden-search-apps',
                    'app-menu-hide-item', 'app-menu-hide-from-search-item',
                ],
                apply(lc, s) {
                    const hidden = s.get_strv('app-menu-hidden-apps');
                    const hiddenSearch = s.get_strv('app-menu-hidden-search-apps');
                    const needsMarks = s.get_boolean('app-menu-hide-item') ||
                        s.get_boolean('app-menu-hide-from-search-item');
                    if (!hidden.length && !hiddenSearch.length && !needsMarks)
                        return;

                    const filterIcons = original => function () {
                        const icons = original.call(this);
                        for (const icon of icons)
                            module._gridIcons?.add(icon);
                        return hidden.length ? icons.filter(icon => !hidden.includes(icon.id)) : icons;
                    };
                    lc.override(AppDisplay.AppDisplay.prototype, '_loadApps', filterIcons);
                    lc.override(AppDisplay.FolderView.prototype, '_loadApps', filterIcons);

                    if (hiddenSearch.length) {
                        lc.override(AppDisplay.AppSearchProvider.prototype, 'getInitialResultSet', original =>
                            async function (terms, cancellable) {
                                const results = await original.call(this, terms, cancellable);
                                return results.filter(id => !hiddenSearch.includes(id));
                            });
                    }

                    queueAppGridRedisplay();
                    lc.defer(() => queueAppGridRedisplay());
                },
            },
            {
                name: 'app-menu-items',
                keys: [
                    'app-menu-hide-item', 'app-menu-hide-from-search-item',
                    'app-menu-edit-entry-item', 'app-menu-open-location-item',
                ],
                apply(lc, s) {
                    const hideItem = s.get_boolean('app-menu-hide-item');
                    const hideSearchItem = s.get_boolean('app-menu-hide-from-search-item');
                    const editItem = s.get_boolean('app-menu-edit-entry-item');
                    const locationItem = s.get_boolean('app-menu-open-location-item');
                    if (!hideItem && !hideSearchItem && !editItem && !locationItem)
                        return;

                    const created = new Set();
                    const menus = new Set();
                    lc.defer(() => {
                        for (const menu of menus)
                            delete menu._shellTweaksItems;
                        menus.clear();
                        for (const item of created) {
                            try {
                                item.destroy();
                            } catch {
                                // destroyed with its menu
                            }
                        }
                        created.clear();
                    });

                    const track = (menu, item) => {
                        created.add(item);
                        menu._shellTweaksItems.push(item);
                        item.connect('destroy', () => created.delete(item));
                    };

                    const build = menu => {
                        const app = menu._app;
                        const appInfo = app?.app_info;
                        const appId = app?.get_id();

                        if (editItem || locationItem) {
                            const filename = appInfo?.get_filename?.();
                            if (filename) {
                                let position = menu._getMenuItems().indexOf(menu._detailsItem) + 1;
                                const insert = item => {
                                    if (position > 0)
                                        menu.moveMenuItem(item, position++);
                                    track(menu, item);
                                };
                                if (editItem) {
                                    insert(menu.addAction('Edit Entry', () => {
                                        try {
                                            const local = s.get_boolean('app-menu-edit-local-copy');
                                            openForEditing(s, editablePath(appId, filename, local));
                                        } catch (e) {
                                            logError(e, 'shell-tweaks: edit entry');
                                            Main.notifyError('Edit Entry failed', e.message);
                                        }
                                        Main.overview.hide();
                                    }));
                                }
                                if (locationItem) {
                                    insert(menu.addAction('Open Entry Location', () => {
                                        openLocation(filename);
                                        Main.overview.hide();
                                    }));
                                }
                            }
                        }

                        const inGrid = module._gridIcons?.has(menu.sourceActor);
                        if (inGrid && appId && (hideItem || hideSearchItem)) {
                            const separator = new PopupMenu.PopupSeparatorMenuItem();
                            menu.addMenuItem(separator);
                            track(menu, separator);
                            if (hideItem) {
                                track(menu, menu.addAction('Hide', () => {
                                    appendUnique(s, 'app-menu-hidden-apps', appId);
                                }));
                            }
                            if (hideSearchItem) {
                                const inList = s.get_strv('app-menu-hidden-search-apps').includes(appId);
                                track(menu, menu.addAction(inList ? 'Show in Search' : 'Hide from Search', () => {
                                    if (s.get_strv('app-menu-hidden-search-apps').includes(appId))
                                        removeValue(s, 'app-menu-hidden-search-apps', appId);
                                    else
                                        appendUnique(s, 'app-menu-hidden-search-apps', appId);
                                }));
                            }
                        }
                    };

                    lc.override(AppMenu.prototype, 'open', original => function (...args) {
                        // rebuild every time: the app, the search list and
                        // the menu's owner may all have changed
                        for (const item of this._shellTweaksItems ?? []) {
                            created.delete(item);
                            item.destroy();
                        }
                        this._shellTweaksItems = [];
                        menus.add(this);
                        try {
                            build(this);
                        } catch (e) {
                            logError(e, 'shell-tweaks: app menu items');
                        }
                        return original.call(this, ...args);
                    });
                },
            },
        ];
    }
}
