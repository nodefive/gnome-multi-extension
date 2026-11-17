// Snapshot of everything Shell Tweaks may change. With LABEL=base the
// patchable functions are recorded; other labels report which differ.
(async () => {
    const m = async path => import(`resource:///org/gnome/shell/${path}`);
    const AppDisplay = await m('ui/appDisplay.js');
    const {AppMenu} = await m('ui/appMenu.js');
    const AltTab = await m('ui/altTab.js');
    const BackgroundMenu = await m('ui/backgroundMenu.js');
    const OsdWindow = await m('ui/osdWindow.js');
    const PanelMenu = await m('ui/panelMenu.js');
    const Search = await m('ui/search.js');
    const SwitcherPopup = await m('ui/switcherPopup.js');
    const WindowMenu = await m('ui/windowMenu.js');
    const WindowPreview = await m('ui/windowPreview.js');
    const Workspace = await m('ui/workspace.js');
    const WorkspacesView = await m('ui/workspacesView.js');
    const WorkspaceSwitcherPopup = await m('ui/workspaceSwitcherPopup.js');
    const WorkspaceThumbnail = await m('ui/workspaceThumbnail.js');
    const St = (await import('gi://St')).default;

    const lm = Main.layoutManager;
    const controls = Main.overview._overview._controls;
    const appDisplay = controls._appDisplay;
    const qs = Main.panel.statusArea.quickSettings;
    const dateMenu = Main.panel.statusArea.dateMenu;

    const functions = {
        'AppDisplay._loadApps': AppDisplay.AppDisplay.prototype._loadApps,
        'FolderView._loadApps': AppDisplay.FolderView.prototype._loadApps,
        'AppSearchProvider.getInitialResultSet': AppDisplay.AppSearchProvider.prototype.getInitialResultSet,
        'AppMenu.open': AppMenu.prototype.open,
        'AltTab.WindowIcon._init': AltTab.WindowIcon.prototype._init,
        'BackgroundMenu.open': BackgroundMenu.BackgroundMenu.prototype.open,
        'OsdWindow.show': OsdWindow.OsdWindow.prototype.show,
        'PanelMenu.Button.setMenu': PanelMenu.Button.prototype.setMenu,
        'ListSearchResults._getMaxDisplayedResults': Search.ListSearchResults.prototype._getMaxDisplayedResults,
        'SwitcherPopup.show': SwitcherPopup.SwitcherPopup.prototype.show,
        'WindowMenuManager.showWindowMenuForWindow': WindowMenu.WindowMenuManager.prototype.showWindowMenuForWindow,
        'WindowMenu._buildMenu': WindowMenu.WindowMenu.prototype._buildMenu,
        'WindowPreview.overlapHeights': WindowPreview.WindowPreview.prototype.overlapHeights,
        'WindowPreview._getCaption': WindowPreview.WindowPreview.prototype._getCaption,
        'Workspace._isOverviewWindow': Workspace.Workspace.prototype._isOverviewWindow,
        'WorkspaceBackground._updateBorderRadius': Workspace.WorkspaceBackground.prototype._updateBorderRadius,
        'WorkspacesView._getSpacing': WorkspacesView.WorkspacesView.prototype._getSpacing,
        'WorkspaceSwitcherPopup.display': WorkspaceSwitcherPopup.WorkspaceSwitcherPopup.prototype.display,
        'ThumbnailsBox._updateShouldShow': WorkspaceThumbnail.ThumbnailsBox.prototype._updateShouldShow,
        'ThumbnailsBox._init': WorkspaceThumbnail.ThumbnailsBox.prototype._init,
        'WorkspaceThumbnail.activate': WorkspaceThumbnail.WorkspaceThumbnail.prototype.activate,
        'Meta.Workspace.get_neighbor': Meta.Workspace.prototype.get_neighbor,
        'layoutManager._updateHotCorners': lm._updateHotCorners,
        'controlsLayout._computeWorkspacesBoxForState': controls.layout_manager._computeWorkspacesBoxForState,
        'appDisplay.adaptToSize': appDisplay.adaptToSize,
        'messageTray._hideNotification': Main.messageTray._hideNotification,
        'osdWindowManager.show': Main.osdWindowManager.show,
        'osdWindowManager.showAll': Main.osdWindowManager.showAll,
        'clocksItem._sync': dateMenu._clocksItem._sync,
    };

    const label = '%LABEL%';
    if (label === 'base')
        globalThis.__shellTweaksBase = functions;
    const base = globalThis.__shellTweaksBase ?? {};
    const changedFunctions = Object.keys(functions).filter(k => base[k] !== functions[k]).sort();

    const own = (obj, name) => Object.prototype.hasOwnProperty.call(obj, name);
    const wm = new Gio.Settings({schema_id: 'org.gnome.desktop.wm.keybindings'});
    const iface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
    const grid = appDisplay._grid;

    return {
        changedFunctions,
        ownOverrides: {
            updateHotCorners: own(lm, '_updateHotCorners'),
            adaptToSize: own(appDisplay, 'adaptToSize'),
            hideNotification: own(Main.messageTray, '_hideNotification'),
            osdShow: own(Main.osdWindowManager, 'show'),
            clocksSync: own(dateMenu._clocksItem, '_sync'),
            computeBox: own(controls.layout_manager, '_computeWorkspacesBoxForState'),
        },
        uiClasses: (lm.uiGroup.get_style_class_name() ?? '').split(/\s+/).filter(c => c.startsWith('shell-tweaks')).sort(),
        containers: Object.fromEntries(['activities', 'dateMenu', 'keyboard', 'a11y', 'quickSettings']
            .map(name => [name, Main.panel.statusArea[name]?.container.visible ?? null])),
        quickToggles: {
            darkMode: qs._darkMode?.quickSettingsItems[0].visible ?? null,
            nightLight: qs._nightLight?.quickSettingsItems[0].visible ?? null,
            dnd: qs._doNotDisturb?.quickSettingsItems[0].visible ?? null,
            backlight: qs._backlight?.quickSettingsItems[0].visible ?? null,
            rfkill: qs._rfkill?._rfkillToggle.visible ?? null,
        },
        dateMenu: {
            messageList: dateMenu._messageList.visible,
            calendar: dateMenu._calendar.visible,
            clocks: dateMenu._clocksItem.visible,
        },
        slowDownFactor: St.Settings.get().slow_down_factor,
        thumbnails: {
            shouldShow: controls._thumbnailsBox._shouldShow,
            maxScale: controls._thumbnailsBox._maxThumbnailScale,
        },
        appGrid: {
            rows: grid.layout_manager.rowsPerPage,
            columns: grid.layout_manager.columnsPerPage,
            iconSize: grid.layout_manager.fixedIconSize,
            style: grid.style ?? null,
            classes: grid.get_style_class_name() ?? null,
            gridModes: JSON.stringify(grid._gridModes ?? null),
            overviewStyle: Main.overview._overview.style ?? null,
        },
        hotCorners: lm.hotCorners.map(c => c?.constructor?.name ?? null),
        rightBoxChildren: Main.panel._rightBox.get_n_children(),
        panel: {
            reactive: Main.panel.reactive,
            height: Main.panel.height,
            boxParent: lm.panelBox.get_parent() === lm.uiGroup ? 'uiGroup' : 'other',
        },
        overviewGroupActions: lm.overviewGroup.get_actions().length,
        searchEntryParentHeight: Main.overview.searchEntry.get_parent().height,
        unmaximize: wm.get_strv('unmaximize'),
        enableAnimations: iface.get_boolean('enable-animations'),
        uiGroupEffects: Main.uiGroup.get_effects().map(e => e.get_name()),
    };
})();
