// Opens every folder popup the way GNOME does (FolderIcon.open) and measures
// what is really allocated; then adds a new folder and measures its popup.
(async () => {
    const wait = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
    const appDisplay = Main.overview._overview._controls._appDisplay;
    Main.overview.showApps();
    await wait(1500);

    const measure = async (icon, tag) => {
        icon.open();
        await wait(900);
        const dialog = icon._dialog;
        const size = actor => {
            const box = actor.get_allocation_box();
            return `${Math.round(box.get_width())}x${Math.round(box.get_height())}`;
        };
        const grid = icon.view._grid;
        const layout = grid.layout_manager;
        const mode = grid._gridModes?.[0] ?? {};
        const cell = Math.max(...grid.get_children().filter(c => c.visible)
            .map(c => Math.max(c.get_preferred_width(-1)[0], c.get_preferred_height(-1)[0])), 0);
        const usedHeight = mode.rows * cell + (mode.rows - 1) * layout.rowSpacing;
        const result = {
            tag,
            folder: icon.name,
            apps: icon.getAppIds().length,
            mode: `${mode.columns}x${mode.rows}`,
            pages: grid.nPages,
            visiblePopup: size(dialog._viewBox),
            popupStyle: dialog._viewBox.style,
            gridArea: size(grid),
            cell,
            rowsFit: usedHeight <= grid.get_allocation_box().get_height(),
        };
        dialog.popdown();
        await wait(700);
        return result;
    };

    const out = [];
    for (const icon of appDisplay._folderIcons ?? [])
        out.push(await measure(icon, 'open'));

    // a folder created now gets a new FolderIcon whose popup GNOME builds on
    // first open, after Shell Tweaks applied its settings
    const folders = new Gio.Settings({schema_id: 'org.gnome.desktop.app-folders'});
    const appIds = (appDisplay._folderIcons?.[0]?.getAppIds() ?? []).slice(0, 7);
    const path = '/org/gnome/desktop/app-folders/folders/ShellTweaksTest/';
    const folder = new Gio.Settings({schema_id: 'org.gnome.desktop.app-folders.folder', path});
    folder.set_string('name', 'ShellTweaksTest');
    folder.set_strv('apps', appIds);
    folders.set_strv('folder-children', [...folders.get_strv('folder-children'), 'ShellTweaksTest']);
    await wait(500);
    appDisplay._redisplay();
    await wait(1500);
    const created = (appDisplay._folderIcons ?? []).find(i => i.id === 'ShellTweaksTest');
    out.push(created ? {hadDialogBeforeOpen: !!created._dialog} : {error: 'new folder not shown'});
    if (created)
        out.push(await measure(created, 'new folder'));

    Main.overview.hide();
    return out;
})();
