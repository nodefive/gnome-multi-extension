// SPDX-License-Identifier: GPL-3.0-only
//
// Stable loader. GNOME Shell caches extension modules by URL for the whole
// session, so disable/enable alone reruns old code. tools/reload.sh copies
// the code to versions/<stamp>/ and writes that stamp to reload-version;
// the next enable imports core.js from there, a new URL, so the new code
// runs without logging out. Without reload-version the bundled core.js is
// used and enable is synchronous. At login (Shell starting up) the bundled
// code is always used: reload.sh keeps it current, and startup features
// need the synchronous enable.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import ShellTweaksCore from './core.js';

export default class ShellTweaksExtension extends Extension {
    enable() {
        const reloadDir = Main.layoutManager._startingUp ? null : this._reloadDir();
        if (!reloadDir) {
            this._core = new ShellTweaksCore(this);
            this._core.enable();
            return;
        }

        const token = {};
        this._loading = token;
        import(`${reloadDir.get_uri()}/core.js`)
            .then(module => {
                if (this._loading !== token)
                    return;
                this._loading = null;
                this._core = new module.default(this);
                this._core.enable();
                console.log(`shell-tweaks: running reloaded code ${reloadDir.get_basename()}`);
            })
            .catch(e => {
                logError(e, 'shell-tweaks: reloaded code failed, using the bundled code');
                if (this._loading !== token)
                    return;
                this._loading = null;
                this._core = new ShellTweaksCore(this);
                this._core.enable();
            });
    }

    disable() {
        this._loading = null;
        this._core?.disable();
        this._core = null;
    }

    _reloadDir() {
        const pointer = this.dir.get_child('reload-version');
        let stamp;
        try {
            const [, bytes] = pointer.load_contents(null);
            stamp = new TextDecoder().decode(bytes).trim();
        } catch {
            return null;
        }
        if (!/^[0-9A-Za-z_-]+$/.test(stamp))
            return null;
        const dir = this.dir.get_child('versions').get_child(stamp);
        return dir.get_child('core.js').query_exists(null) ? dir : null;
    }
}
