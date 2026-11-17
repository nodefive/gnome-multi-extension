// SPDX-License-Identifier: GPL-3.0-only

import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

/**
 * Records every change a feature makes to the Shell so it can be reverted
 * in one call. Undo steps run in reverse order, then method injections are
 * restored.
 */
export class Lifecycle {
    constructor() {
        this._injections = new InjectionManager();
        this._undo = [];
        this._sources = new Set();
    }

    /**
     * Wrap a method. `factory` receives the original and returns the replacement.
     */
    override(object, name, factory) {
        this._injections.overrideMethod(object, name, factory);
    }

    /**
     * Assign a property and restore the previous value (or own-property absence) on revert.
     */
    set(object, name, value) {
        const hadOwn = Object.prototype.hasOwnProperty.call(object, name);
        const previous = object[name];
        object[name] = value;
        this._undo.push(() => {
            if (hadOwn)
                object[name] = previous;
            else
                delete object[name];
        });
    }

    connect(object, signal, callback) {
        const id = object.connect(signal, callback);
        this._undo.push(() => {
            try {
                object.disconnect(id);
            } catch {
                // object already finalized
            }
        });
        return id;
    }

    connectAfter(object, signal, callback) {
        const id = object.connect_after(signal, callback);
        this._undo.push(() => {
            try {
                object.disconnect(id);
            } catch {
                // object already finalized
            }
        });
        return id;
    }

    addStyleClass(actor, className) {
        if (actor.has_style_class_name(className))
            return;
        actor.add_style_class_name(className);
        this._undo.push(() => actor.remove_style_class_name(className));
    }

    /**
     * Add a class to the UI group, the anchor for most stylesheet rules.
     */
    addUiClass(className) {
        this.addStyleClass(Main.layoutManager.uiGroup, className);
    }

    timeout(ms, callback) {
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
            const again = callback();
            if (again !== GLib.SOURCE_CONTINUE)
                this._sources.delete(id);
            return again ?? GLib.SOURCE_REMOVE;
        });
        this._sources.add(id);
        return id;
    }

    timeoutSeconds(seconds, callback) {
        const id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, seconds, () => {
            const again = callback();
            if (again !== GLib.SOURCE_CONTINUE)
                this._sources.delete(id);
            return again ?? GLib.SOURCE_REMOVE;
        });
        this._sources.add(id);
        return id;
    }

    idle(callback) {
        const id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._sources.delete(id);
            callback();
            return GLib.SOURCE_REMOVE;
        });
        this._sources.add(id);
        return id;
    }

    removeSource(id) {
        if (id && this._sources.delete(id))
            GLib.source_remove(id);
    }

    /**
     * Register an arbitrary undo step.
     */
    defer(callback) {
        this._undo.push(callback);
    }

    revert() {
        for (const id of this._sources)
            GLib.source_remove(id);
        this._sources.clear();

        while (this._undo.length) {
            const step = this._undo.pop();
            try {
                step();
            } catch (e) {
                logError(e, 'shell-tweaks: revert step failed');
            }
        }

        this._injections.clear();
    }
}
