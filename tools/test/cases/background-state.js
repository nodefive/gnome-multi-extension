// Overview background style and the hover rule in the generated stylesheet.
(async () => {
    await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
    const css = GLib.build_filenamev([GLib.get_user_cache_dir(), 'shell-tweaks', 'app-grid.css']);
    let hoverRule = null;
    try {
        const [, bytes] = GLib.file_get_contents(css);
        hoverRule = new TextDecoder().decode(bytes).split('\n').find(l => l.includes(':hover')) ?? null;
    } catch {
        hoverRule = null;
    }
    const grid = Main.overview._overview._controls._appDisplay._grid;
    const folder = Main.overview._overview._controls._appDisplay._folderIcons?.[0];
    const tile = folder?.get_theme_node().get_background_color();
    return {
        folderTile: tile ? [tile.red, tile.green, tile.blue, tile.alpha] : null,
        controlsStyle: Main.overview._overview._controls.style,
        overviewStyle: Main.overview._overview.style,
        appDisplayStyle: Main.overview._overview._controls._appDisplay.style,
        hoverClass: grid.has_style_class_name('shell-tweaks-app-hover'),
        hoverRule,
    };
})();
