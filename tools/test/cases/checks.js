// Checks for the migrated configuration with Shell Tweaks enabled.
(async () => {
    const m = async path => import(`resource:///org/gnome/shell/${path}`);
    const St = (await import('gi://St')).default;
    const WorkspaceSwitcherPopup = await m('ui/workspaceSwitcherPopup.js');
    const SwitcherPopup = await m('ui/switcherPopup.js');
    const Workspace = await m('ui/workspace.js');

    const lm = Main.layoutManager;
    const ui = lm.uiGroup;
    const controls = Main.overview._overview._controls;
    const qs = Main.panel.statusArea.quickSettings;
    const dateMenu = Main.panel.statusArea.dateMenu;
    const grid = controls._appDisplay._grid;
    const ext = Main.extensionManager.lookup('shell-tweaks@unl0cker');
    const wm = new Gio.Settings({schema_id: 'org.gnome.desktop.wm.keybindings'});
    const first = Main.panel._rightBox.get_child_at_index(0);

    const results = [
        ['extension enabled without error', ext?.state === 1 && !ext?.error, `${ext?.state} ${ext?.error ?? ''}`],
        ['activities button hidden', Main.panel.statusArea.activities.container.visible === false],
        ['notification dot class', ui.has_style_class_name('shell-tweaks-no-panel-notification-icon')],
        ['dark style toggle hidden', qs._darkMode?.quickSettingsItems[0].visible === false],
        ['night light toggle hidden', qs._nightLight?.quickSettingsItems[0].visible === false],
        ['airplane toggle hidden', qs._rfkill?._rfkillToggle.visible === false],
        ['dnd toggle untouched', qs._doNotDisturb?.quickSettingsItems[0].visible === true],
        ['animation factor 0.8', Math.abs(St.Settings.get().slow_down_factor - 0.8) < 1e-6,
            St.Settings.get().slow_down_factor],
        ['workspace thumbnails hidden', controls._thumbnailsBox._shouldShow === false],
        ['message list hidden', dateMenu._messageList.visible === false],
        ['calendar still shown', dateMenu._calendar.visible === true],
        ['four hot corners', lm.hotCorners.length === 4 && lm.hotCorners.every(c => c?.constructor?.name === 'Corner'),
            lm.hotCorners.map(c => c?.constructor?.name)],
        ['app grid 8x5', grid.layout_manager.rowsPerPage === 5 && grid.layout_manager.columnsPerPage === 8,
            `${grid.layout_manager.columnsPerPage}x${grid.layout_manager.rowsPerPage}`],
        ['app grid label style class', grid.has_style_class_name('shell-tweaks-label-style')],
        ['overview gradient', (Main.overview._overview.style ?? '').includes('background-gradient-start: #0f172a'),
            Main.overview._overview.style],
        ['wallpaper button first in right box', first instanceof St.Button &&
            first.child?.icon_name === 'video-display-symbolic'],
        ['panel reactive for scroll', Main.panel.reactive === true],
        ['workspace popup suppressed', WorkspaceSwitcherPopup.WorkspaceSwitcherPopup.prototype.display
            .toString().includes('this.destroy()')],
        ['switcher delay removed', SwitcherPopup.SwitcherPopup.prototype.show.toString().includes('_showImmediately')],
        ['firefox pip filter', Workspace.Workspace.prototype._isOverviewWindow.toString().includes('FIREFOX_PIP_TITLES')],
        ['click-to-close gesture', lm.overviewGroup.get_actions().length >= 1],
        ['alt+f5 on unmaximize', wm.get_strv('unmaximize').includes('<Alt>F5'), wm.get_strv('unmaximize')],
    ];

    return results.map(([name, ok, detail]) => ({name, ok: !!ok, detail: detail ?? null}));
})();
