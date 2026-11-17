// SPDX-License-Identifier: GPL-3.0-only

import GLib from 'gi://GLib';

import {Lifecycle} from './lifecycle.js';

// Settings changes are applied once the key has been still this long, so
// clicking a spin button ten times rebuilds the feature once, not ten times.
const APPLY_DELAY_MS = 300;

/**
 * A module groups features. Each feature owns a Lifecycle and is rebuilt
 * when one of its keys changes, so one setting never disturbs another.
 *
 * Subclasses implement `features()` returning
 *   [{name, keys: [...], apply(lc, settings)}, ...]
 * and may override `onEnable(lc)` for module-wide state.
 */
export class Module {
    constructor(extension, settings) {
        this.extension = extension;
        this.settings = settings;
        this._features = [];
        this._moduleLc = null;
        this._changedId = 0;
        this.enabled = false;
    }

    /** Settings key that switches the whole module. */
    static get key() {
        throw new Error('Module subclass must define a key');
    }

    features() {
        return [];
    }

    onEnable(_lc) {
    }

    enable() {
        if (this.enabled)
            return;
        this.enabled = true;

        this._moduleLc = new Lifecycle();
        try {
            this.onEnable(this._moduleLc);
        } catch (e) {
            logError(e, `shell-tweaks: ${this.constructor.name} enable failed`);
        }

        this._features = this.features().map(f => ({...f, lc: null, pendingId: 0}));
        const byKey = new Map();
        for (const feature of this._features) {
            for (const key of feature.keys)
                byKey.set(key, [...byKey.get(key) ?? [], feature]);
            this._apply(feature);
        }

        this._changedId = this.settings.connect('changed', (_s, key) => {
            for (const feature of byKey.get(key) ?? [])
                this._schedule(feature);
        });
    }

    disable() {
        if (!this.enabled)
            return;
        this.enabled = false;

        if (this._changedId) {
            this.settings.disconnect(this._changedId);
            this._changedId = 0;
        }

        for (const feature of [...this._features].reverse()) {
            if (feature.pendingId) {
                GLib.source_remove(feature.pendingId);
                feature.pendingId = 0;
            }
            feature.lc?.revert();
            feature.lc = null;
        }
        this._features = [];

        this._moduleLc?.revert();
        this._moduleLc = null;
    }

    _schedule(feature) {
        if (feature.pendingId)
            GLib.source_remove(feature.pendingId);
        feature.pendingId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, APPLY_DELAY_MS, () => {
            feature.pendingId = 0;
            if (this.enabled)
                this._apply(feature);
            return GLib.SOURCE_REMOVE;
        });
    }

    _apply(feature) {
        feature.lc?.revert();
        feature.lc = new Lifecycle();
        try {
            feature.apply(feature.lc, this.settings);
        } catch (e) {
            logError(e, `shell-tweaks: feature ${feature.name} failed`);
            try {
                feature.lc.revert();
            } catch {
                // nothing more to undo
            }
            feature.lc = new Lifecycle();
        }
    }
}
