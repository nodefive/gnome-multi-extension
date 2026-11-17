// Usage: gjs -m eval.js FILE [KEY=VALUE...]
// Runs FILE through org.gnome.Shell.Eval on the session bus; %KEY% in the
// file is replaced by VALUE. Prints the JSON result, exits 1 on failure.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import System from 'system';

const [file, ...pairs] = ARGV;
let [, bytes] = GLib.file_get_contents(file);
let code = new TextDecoder().decode(bytes);
for (const pair of pairs) {
    const at = pair.indexOf('=');
    code = code.replaceAll(`%${pair.slice(0, at)}%`, pair.slice(at + 1));
}

const reply = Gio.DBus.session.call_sync(
    'org.gnome.Shell', '/org/gnome/Shell', 'org.gnome.Shell', 'Eval',
    new GLib.Variant('(s)', [code]), new GLib.VariantType('(bs)'),
    Gio.DBusCallFlags.NONE, 60000, null);
const [success, result] = reply.deepUnpack();
print(result);
System.exit(success ? 0 : 1);
