// Folder icon square in the grid: computed background after choosing a colour.
(async () => {
    const wait = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
    const settings = Main.extensionManager.lookup('shell-tweaks@unl0cker').stateObj.getSettings();
    const tile = () => {
        const icon = Main.overview._overview._controls._appDisplay._folderIcons?.[0];
        const c = icon.get_theme_node().get_background_color();
        return {folder: icon.name, rgba: [c.red, c.green, c.blue, c.alpha]};
    };
    Main.overview.showApps();
    await wait(1500);
    const out = {theme: tile()};
    settings.set_string('app-grid-folder-tile-background-color', '#2060c0');
    settings.set_double('app-grid-folder-tile-background-opacity', 0.6);
    await wait(1200);
    out.chosen = tile();
    Main.overview.hide();
    return out;
})();
