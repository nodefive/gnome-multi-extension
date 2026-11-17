// SPDX-License-Identifier: GPL-3.0-only

import {cancelAppGridRedisplay} from './lib/shell.js';
import {PanelModule} from './modules/panel.js';
import {DateMenuModule} from './modules/dateMenu.js';
import {OverviewModule} from './modules/overview.js';
import {AppGridModule} from './modules/appGrid.js';
import {AppMenuModule} from './modules/appMenu.js';
import {HotCornersModule} from './modules/hotCorners/index.js';
import {WorkspacesModule} from './modules/workspaces.js';
import {WindowsModule} from './modules/windows.js';
import {ShellModule} from './modules/shell.js';
import {WallpaperModule} from './modules/wallpaper.js';

// Enable order; disable runs in reverse.
const MODULES = [
    ShellModule,
    PanelModule,
    DateMenuModule,
    OverviewModule,
    AppGridModule,
    AppMenuModule,
    WorkspacesModule,
    WindowsModule,
    HotCornersModule,
    WallpaperModule,
];

/**
 * The extension proper. extension.js only loads it, so a reload can run a
 * fresh copy of this code (see extension.js).
 */
export default class ShellTweaksCore {
    constructor(extension) {
        this._extension = extension;
    }

    enable() {
        this._settings = this._extension.getSettings();
        this._modules = MODULES.map(ModuleClass => ({
            key: ModuleClass.key,
            instance: new ModuleClass(this._extension, this._settings),
        }));

        for (const module of this._modules)
            this._syncModule(module);

        this._changedId = this._settings.connect('changed', (_settings, key) => {
            const module = this._modules.find(m => m.key === key);
            if (module)
                this._syncModule(module);
        });
    }

    disable() {
        this._settings.disconnect(this._changedId);
        this._changedId = 0;

        for (const module of [...this._modules].reverse()) {
            try {
                module.instance.disable();
            } catch (e) {
                logError(e, `shell-tweaks: disabling ${module.key} failed`);
            }
        }
        this._modules = null;
        cancelAppGridRedisplay();
        this._settings = null;
    }

    _syncModule(module) {
        try {
            if (this._settings.get_boolean(module.key))
                module.instance.enable();
            else
                module.instance.disable();
        } catch (e) {
            logError(e, `shell-tweaks: ${module.key} failed`);
        }
    }
}
