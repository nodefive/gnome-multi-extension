// SPDX-License-Identifier: GPL-3.0-only
// Random wallpaper button and timer (replaces wallpaper-launcher).

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Module} from '../lib/module.js';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const BACKGROUND_SCHEMA = 'org.gnome.desktop.background';
const ENUMERATE_ATTRIBUTES = 'standard::name,standard::type,standard::is-hidden';

Gio._promisify(Gio.File.prototype, 'enumerate_children_async');
Gio._promisify(Gio.FileEnumerator.prototype, 'next_files_async');

function wallpaperFolder(settings) {
    const configured = settings.get_string('wallpaper-folder');
    if (configured)
        return configured.replace(/^~(?=\/|$)/, GLib.get_home_dir());
    return GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) ?? GLib.get_home_dir();
}

async function collectImages(folder, cancellable) {
    const images = [];
    const pending = [folder];
    while (pending.length) {
        const dir = pending.pop();
        let enumerator;
        try {
            enumerator = await dir.enumerate_children_async(ENUMERATE_ATTRIBUTES,
                Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_LOW, cancellable);
        } catch (e) {
            if (dir === folder)
                throw e;
            continue;
        }
        for (;;) {
            const infos = await enumerator.next_files_async(100, GLib.PRIORITY_LOW, cancellable);
            if (!infos.length)
                break;
            for (const info of infos) {
                if (info.get_is_hidden())
                    continue;
                const child = dir.get_child(info.get_name());
                if (info.get_file_type() === Gio.FileType.DIRECTORY) {
                    pending.push(child);
                    continue;
                }
                const ext = info.get_name().split('.').pop().toLowerCase();
                if (IMAGE_EXTENSIONS.has(ext))
                    images.push(child);
            }
        }
        enumerator.close(null);
    }
    return images;
}

function notify(message) {
    Main.osdWindowManager.showAll(new Gio.ThemedIcon({name: 'image-missing-symbolic'}), message, null, 1);
}

export class WallpaperModule extends Module {
    static get key() {
        return 'module-wallpaper';
    }

    onEnable(lc) {
        this._background = new Gio.Settings({schema_id: BACKGROUND_SCHEMA});
        this._cancellable = new Gio.Cancellable();
        this._busy = false;
        lc.defer(() => {
            this._cancellable.cancel();
            this._cancellable = null;
            this._background = null;
        });
    }

    async changeWallpaper() {
        if (this._busy || !this._cancellable)
            return;
        this._busy = true;
        const cancellable = this._cancellable;
        const path = wallpaperFolder(this.settings);
        try {
            const folder = Gio.File.new_for_path(path);
            let images;
            try {
                images = await collectImages(folder, cancellable);
            } catch (e) {
                if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    notify(`Wallpaper folder not available: ${path}`);
                return;
            }
            if (cancellable.is_cancelled())
                return;
            if (!images.length) {
                notify(`No images in ${path}`);
                return;
            }

            const current = this._background.get_string('picture-uri');
            let candidates = images;
            if (this.settings.get_boolean('wallpaper-avoid-repeat') && images.length > 1)
                candidates = images.filter(file => file.get_uri() !== current);
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            const uri = pick.get_uri();
            this._background.set_string('picture-uri', uri);
            this._background.set_string('picture-uri-dark', uri);
        } finally {
            this._busy = false;
        }
    }

    features() {
        const module = this;
        return [
            {
                name: 'wallpaper-button',
                keys: [],
                apply(lc) {
                    const button = new St.Button({
                        style_class: 'panel-button',
                        reactive: true,
                        can_focus: true,
                        track_hover: true,
                        accessible_name: 'Random wallpaper',
                        child: new St.Icon({
                            icon_name: 'video-display-symbolic',
                            style_class: 'system-status-icon',
                        }),
                    });
                    button.connect('clicked', () => module.changeWallpaper().catch(logError));
                    Main.panel._rightBox.insert_child_at_index(button, 0);
                    lc.defer(() => button.destroy());
                },
            },
            {
                name: 'wallpaper-timer',
                keys: ['wallpaper-auto-change', 'wallpaper-interval'],
                apply(lc, s) {
                    if (!s.get_boolean('wallpaper-auto-change'))
                        return;
                    const minutes = Math.max(1, s.get_int('wallpaper-interval'));
                    lc.timeoutSeconds(minutes * 60, () => {
                        module.changeWallpaper().catch(logError);
                        return GLib.SOURCE_CONTINUE;
                    });
                },
            },
        ];
    }
}
