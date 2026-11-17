// Folder popup geometry: reports, per folder, the grid mode and dialog size
// for the current settings (run after setting PROFILE limits from inside.sh).
(async () => {
    await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
    const appDisplay = Main.overview._overview._controls._appDisplay;
    const folders = appDisplay._folderIcons ?? [];
    return folders.map(icon => {
        const grid = icon.view._grid;
        const style = icon._dialog?.child?.style ?? '';
        const px = name => Number(style.match(new RegExp(`(?:^|[ ;])${name}: (\\d+)px`))?.[1] ?? NaN);
        const mode = grid._gridModes?.[0] ?? {};
        const apps = icon.getAppIds().length;
        return {
            folder: icon.name,
            apps,
            rows: mode.rows,
            columns: mode.columns,
            perPage: mode.rows * mode.columns,
            pages: Math.ceil(apps / (mode.rows * mode.columns)),
            width: px('width'),
            height: px('height'),
        };
    });
})();
