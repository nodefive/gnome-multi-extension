// Hover tile: compares an app icon's computed background without and with
// the :hover pseudo class, for the theme alone and with the hover tile on.
(async () => {
    const wait = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
    const settings = Main.extensionManager.lookup('shell-tweaks@unl0cker').stateObj.getSettings();
    Main.overview.showApps();
    await wait(1500);

    const color = actor => {
        const c = actor.get_theme_node().get_background_color();
        return [c.red, c.green, c.blue, c.alpha];
    };
    const sample = async () => {
        const grid = Main.overview._overview._controls._appDisplay._grid;
        const icon = grid.get_children().find(c => c.constructor.name === 'AppIcon' && c.mapped);
        const normal = color(icon);
        icon.add_style_pseudo_class('hover');
        await wait(300);
        const hovered = color(icon);
        icon.remove_style_pseudo_class('hover');
        return {normal, hovered, gridHasClass: grid.has_style_class_name('shell-tweaks-app-hover')};
    };

    const out = {};
    settings.set_boolean('app-grid-hover-tile-enabled', false);
    await wait(800);
    out.themeOnly = await sample();
    settings.set_string('app-grid-hover-tile-background-color', '#ff0000');
    settings.set_double('app-grid-hover-tile-background-opacity', 0.8);
    settings.set_boolean('app-grid-hover-tile-enabled', true);
    await wait(1000);
    out.hoverTile = await sample();
    Main.overview.hide();
    return out;
})();
