// TEST ONLY: enables org.gnome.Shell.Eval inside the isolated headless test Shell.
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class TestHelper extends Extension {
    enable() {
        this._previous = global.context.unsafe_mode;
        global.context.unsafe_mode = true;
    }

    disable() {
        global.context.unsafe_mode = this._previous;
    }
}
