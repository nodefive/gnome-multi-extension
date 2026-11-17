// SPDX-License-Identifier: GPL-3.0-only
// Hot corner actions. Ported from Custom Hot Corners - Extended
// (GPL-3.0, GdH) for the kept subset of actions.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import * as WorkspaceSwitcherPopup from 'resource:///org/gnome/shell/ui/workspaceSwitcherPopup.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

import {ACTIONS, actionById} from '../../lib/actionList.js';

const BRIGHTNESS_EFFECT = 'shell-tweaks-brightness';

function focusedWindow() {
    const win = global.display.get_focus_window();
    if (!win || win.get_workspace() !== global.workspace_manager.get_active_workspace())
        return null;
    return win;
}

function shiftPressed() {
    const [, , mods] = global.get_pointer();
    return (mods & Clutter.ModifierType.SHIFT_MASK) !== 0;
}

function horizontalWorkspaces() {
    return global.workspace_manager.layout_rows !== -1;
}

function showWorkspacePopup(index) {
    if (Main.overview.visible)
        return;
    if (!Main.wm._workspaceSwitcherPopup) {
        Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
        Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
            Main.wm._workspaceSwitcherPopup = null;
        });
    }
    Main.wm._workspaceSwitcherPopup.display(index);
}

function showOsd(iconName, label, level, maxLevel) {
    const gicon = new Gio.ThemedIcon({name: iconName});
    Main.osdWindowManager.showAll(gicon, label, level, maxLevel);
}

class CustomMenu extends PopupMenu.PopupMenu {
    constructor() {
        super(Main.layoutManager.dummyCursor, 0, St.Side.TOP);
        this.actor.add_style_class_name('background-menu');
        this._owner = new Clutter.Actor({reactive: true});
        this._manager = new PopupMenu.PopupMenuManager(this._owner);
        this._manager.addMenu(this);
        Main.layoutManager.uiGroup.add_child(this.actor);
        this.actor.hide();
    }

    build(actionIds, run) {
        this.removeAll();
        const wanted = new Set(actionIds);
        const chosen = ACTIONS.filter(a => wanted.has(a.id) && a.id !== 'disabled');

        if (chosen.some(a => a.needsWindow)) {
            let title = focusedWindow()?.get_title() ?? 'No window has focus';
            if (title.length > 40)
                title = `${title.slice(0, 40)}...`;
            const header = new PopupMenu.PopupMenuItem(title);
            header.sensitive = false;
            this.addMenuItem(header);
        }

        let group = null;
        for (const action of chosen) {
            if (action.group !== group) {
                if (group !== null)
                    this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                group = action.group;
            }
            this.addAction(` ${action.name}`, () => {
                // the open menu holds focus; close it before acting on the focused window
                this.close();
                run(action.id);
            }, action.icon);
        }
    }

    destroy() {
        this._manager.removeMenu(this);
        this._owner.destroy();
        super.destroy();
    }
}

export class Actions {
    constructor(settings) {
        this._settings = settings;
        this._minimized = [];
        this._dimmers = [];
        this._menus = [];
        this._soundSettings = null;
    }

    clean() {
        for (const actor of this._dimmers)
            actor.destroy();
        this._dimmers = [];

        for (const menu of this._menus)
            menu?.destroy();
        this._menus = [];

        if (Main.uiGroup.get_effect(BRIGHTNESS_EFFECT))
            Main.uiGroup.remove_effect_by_name(BRIGHTNESS_EFFECT);

        this._minimized = [];
        this._soundSettings = null;
    }

    /**
     * @param {string} id action id
     * @param {object} params
     * @param {string} params.command command for run-command
     * @returns {boolean} whether an action ran
     */
    run(id, {command = ''} = {}) {
        const handler = this._handlers()[id];
        if (!handler)
            return false;
        try {
            handler(command);
        } catch (e) {
            logError(e, `shell-tweaks: action ${id} failed`);
        }
        return true;
    }

    _handlers() {
        return {
            'toggle-overview': () => this._toggleOverview(true),
            'show-overview': () => this._toggleOverview(false),
            'toggle-overview-app': () => this._toggleOverviewAppWindows(),
            'toggle-applications': () => this._showApplications(true),
            'show-applications': () => this._showApplications(false),
            'run-command': command => this._runCommand(command),
            'show-desktop-mon': () => this._toggleShowDesktop(global.display.get_current_monitor()),
            'show-screenshot-ui': () => Screenshot.showScreenshotUI(),
            'black-screen-mon': () => this._toggleBlackScreen(global.display.get_current_monitor()),
            'prev-workspace': () => this._switchWorkspace(-1),
            'next-workspace': () => this._switchWorkspace(1),
            'reorder-ws-prev': () => this._reorderWorkspace(-1),
            'reorder-ws-next': () => this._reorderWorkspace(1),
            'minimize-win': () => focusedWindow()?.minimize(),
            'maximize-win': () => this._toggleMaximize(),
            'close-win': () => focusedWindow()?.delete(global.get_current_time()),
            'fullscreen-win': () => this._toggleFullscreen(),
            'fullscreen-on-empty-ws': () => this._fullscreenOnEmptyWorkspace(),
            'bright-up-all': () => this._adjustSoftwareBrightness(0.025),
            'bright-down-all': () => this._adjustSoftwareBrightness(-0.025),
            'display-brightness-up': () => Main.brightnessManager?._screenBrightnessUp(),
            'display-brightness-down': () => Main.brightnessManager?._screenBrightnessDown(),
            'lock-screen': () => SystemActions.getDefault().activateLockScreen(),
            'screensaver': () => this._screensaver(),
            'suspend': () => SystemActions.getDefault().activateSuspend(),
            'power-off': () => SystemActions.getDefault().activatePowerOff(),
            'log-out': () => SystemActions.getDefault().activateLogout(),
            'volume-up': () => this._adjustVolume(1),
            'volume-down': () => this._adjustVolume(-1),
            'mute-sound': () => this._adjustVolume(0),
            'show-custom-menu-1': () => this._showCustomMenu(1),
            'show-custom-menu-2': () => this._showCustomMenu(2),
            'show-custom-menu-3': () => this._showCustomMenu(3),
            'show-custom-menu-4': () => this._showCustomMenu(4),
            'looking-glass': () => {
                Main.createLookingGlass();
                Main.lookingGlass?.toggle();
            },
            'run-prompt': () => Main.openRunDialog(),
        };
    }

    _toggleOverview(leave) {
        const showApps = Main.overview.dash.showAppsButton;
        if (Main.overview._shown && (leave || !showApps.checked))
            Main.overview.hide();
        else if (showApps.checked)
            showApps.checked = false;
        else
            Main.overview.show();
    }

    _showApplications(leave) {
        const showApps = Main.overview.dash.showAppsButton;
        if ((leave && Main.overview._shown) || showApps.checked)
            Main.overview.hide();
        else if (Main.overview._shown)
            showApps.checked = true;
        else
            Main.overview.showApps();
    }

    _toggleOverviewAppWindows() {
        const proto = Workspace.Workspace.prototype;
        const original = proto._isOverviewWindow;
        const active = global.display.focus_window;
        proto._isOverviewWindow = win => (active ? active.wm_class === win.wm_class : original(win));
        try {
            Main.overview.toggle();
        } finally {
            proto._isOverviewWindow = original;
        }
    }

    _runCommand(command) {
        if (!command)
            return;
        if (command.endsWith('.desktop')) {
            const app = Shell.AppSystem.get_default().lookup_app(command);
            if (app)
                app.activate();
            else
                Main.notify('Shell Tweaks', `Application not found: ${command}`);
            return;
        }
        Util.spawnCommandLine(command);
    }

    _toggleShowDesktop(monitorIndex) {
        if (Main.overview.visible)
            return;
        const focus = global.display.get_focus_window();
        const windows = global.workspace_manager.get_active_workspace().list_windows().filter(win =>
            win.get_monitor() === monitorIndex &&
            !win.minimized &&
            win.window_type !== Meta.WindowType.DESKTOP &&
            win.window_type !== Meta.WindowType.DOCK &&
            !win.skip_taskbar);

        if (windows.length) {
            this._minimized = windows.map(win => ({win, focused: win === focus}));
            windows.forEach(win => win.minimize());
            return;
        }

        for (const {win, focused} of this._minimized) {
            win.unminimize();
            if (focused)
                win.activate(global.get_current_time());
        }
        this._minimized = [];
    }

    _toggleBlackScreen(monitorIndex) {
        const existing = this._dimmers.find(actor => actor.name === `${monitorIndex}`);
        if (existing) {
            this._dimmers = this._dimmers.filter(actor => actor !== existing);
            existing.destroy();
            return;
        }
        const geometry = global.display.get_monitor_geometry(monitorIndex);
        const actor = new St.Label({
            name: `${monitorIndex}`,
            text: 'Shell Tweaks',
            x: geometry.x,
            y: geometry.y,
            width: geometry.width,
            height: geometry.height,
            style: 'background-color: #000000; color: #444444; font-size: 1em;',
            reactive: true,
        });
        actor.connect('button-press-event', () => {
            this._toggleBlackScreen(monitorIndex);
            return Clutter.EVENT_STOP;
        });
        global.stage.add_child(actor);
        this._dimmers.push(actor);
    }

    _switchWorkspace(step) {
        let direction;
        if (horizontalWorkspaces())
            direction = step < 0 ? Meta.MotionDirection.LEFT : Meta.MotionDirection.RIGHT;
        else
            direction = step < 0 ? Meta.MotionDirection.UP : Meta.MotionDirection.DOWN;
        const target = global.workspace_manager.get_active_workspace().get_neighbor(direction);
        Main.wm.actionMoveWorkspace(target);
        showWorkspacePopup(target.index());
    }

    _reorderWorkspace(step) {
        const manager = global.workspace_manager;
        const active = manager.get_active_workspace();
        const target = active.index() + step;
        if (target < 0 || target >= manager.get_n_workspaces())
            return;
        manager.reorder_workspace(active, target);
        showWorkspacePopup(target);
    }

    _toggleMaximize() {
        const win = focusedWindow();
        if (!win)
            return;
        if (win.maximized_horizontally && win.maximized_vertically)
            win.unmaximize();
        else
            win.maximize();
    }

    _toggleFullscreen() {
        const win = focusedWindow();
        if (!win)
            return;
        if (win.fullscreen)
            win.unmake_fullscreen();
        else
            win.make_fullscreen();
    }

    _fullscreenOnEmptyWorkspace() {
        const win = focusedWindow();
        if (!win)
            return;
        const manager = global.workspace_manager;

        if (win.fullscreen) {
            win.unmake_fullscreen();
            const original = win._shellTweaksOriginalWs;
            if (original && manager.get_workspaces().includes(original)) {
                win.change_workspace(original);
                Main.wm.actionMoveWorkspace(original);
                showWorkspacePopup(original.index());
            }
            win._shellTweaksOriginalWs = null;
            return;
        }

        const ws = win.get_workspace();
        const others = ws.list_windows().filter(w => !w.is_on_all_workspaces());
        win.make_fullscreen();

        // a new workspace can only be inserted with dynamic workspaces
        if (others.length > 1 && Meta.prefs_get_dynamic_workspaces()) {
            const index = ws.index() + 1;
            Main.wm.insertWorkspace(index);
            const target = manager.get_workspace_by_index(index);
            if (!target)
                return;
            win.change_workspace(target);
            if (!shiftPressed()) {
                win.activate(global.get_current_time());
                showWorkspacePopup(index);
            }
            win._shellTweaksOriginalWs = ws;
        }
    }

    _adjustSoftwareBrightness(step) {
        let effect = Main.uiGroup.get_effect(BRIGHTNESS_EFFECT);
        if (!effect) {
            effect = new Clutter.BrightnessContrastEffect();
            Main.uiGroup.add_effect_with_name(BRIGHTNESS_EFFECT, effect);
        }
        let value = Math.round(effect.get_brightness()[0] * 1000 + step * 1000);
        value = Math.max(-750, Math.min(0, value)) / 1000;
        effect.set_brightness(value);
        effect.set_enabled(value !== 0);

        showOsd('display-brightness-symbolic', 'Brightness (software)', value + 1, 1);
    }

    _screensaver() {
        Gio.DBus.session.call(
            'org.gnome.Shell.ScreenShield', '/org/gnome/ScreenSaver', 'org.gnome.ScreenSaver',
            'SetActive', new GLib.Variant('(b)', [true]),
            null, Gio.DBusCallFlags.NONE, -1, null, null);
    }

    _adjustVolume(direction) {
        const mixer = Volume.getMixerControl();
        const sink = mixer.get_default_sink();
        if (!sink)
            return;

        if (direction === 0) {
            sink.change_is_muted(!sink.is_muted);
            return;
        }

        this._soundSettings ??= new Gio.Settings({schema_id: 'org.gnome.desktop.sound'});
        const amplify = this._soundSettings.get_boolean('allow-volume-above-100-percent');
        const maxNorm = mixer.get_vol_max_norm();
        const max = amplify ? mixer.get_vol_max_amplified() : maxNorm;

        const volume = Math.max(0, Math.min(max, sink.volume + direction * 2048));
        sink.volume = volume;
        sink.push_volume();

        const icons = ['audio-volume-muted-symbolic', 'audio-volume-low-symbolic',
            'audio-volume-medium-symbolic', 'audio-volume-high-symbolic',
            'audio-volume-overamplified-symbolic'];
        let n = 0;
        if (!sink.is_muted && volume > 0) {
            n = Math.ceil(3 * volume / maxNorm);
            n = n < 1 ? 1 : n > 3 ? 4 : n;
        }
        const scale = max / maxNorm;
        showOsd(icons[n], sink.get_port()?.human_port ?? '', volume / max * scale, scale);
    }

    _showCustomMenu(index) {
        const items = this._settings.get_strv(`hot-corners-custom-menu-${index}`);
        if (!items.length)
            return;
        this._menus[index] ??= new CustomMenu();
        const menu = this._menus[index];
        menu.build(items, id => this.run(id));

        const [x, y] = global.get_pointer();
        Main.layoutManager.setDummyCursorGeometry(x, y, 0, 0);
        menu.open(BoxPointer.PopupAnimation.FULL);
        const first = menu._getMenuItems().find(item => item.sensitive !== false && item.reactive);
        if (first)
            first.active = true;
    }
}

export function actionName(id) {
    return actionById(id).name;
}
