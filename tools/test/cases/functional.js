// Drives the Super key, hot corners and click-to-close; reports what happened.
(async () => {
    const wait = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
    const overview = Main.overview;
    const showApps = () => overview.dash.showAppsButton.checked;
    const settle = async () => {
        for (let i = 0; i < 50 && overview.animationInProgress; i++)
            await wait(100);
        await wait(200);
    };
    const results = [];
    const record = (name, ok, detail = null) => results.push({name, ok: !!ok, detail});

    // start from a closed overview (a fresh Shell starts in it)
    overview.hide();
    await settle();
    record('overview closed before tests', !overview.visible);

    // Super key: opens the app grid, second press closes
    global.display.emit('overlay-key');
    await settle();
    record('super opens app grid', overview.visible && showApps(), {visible: overview.visible, apps: showApps()});
    global.display.emit('overlay-key');
    await settle();
    record('super again closes', !overview.visible);

    // toggle() from other callers keeps the window picker
    overview.toggle();
    await settle();
    record('toggle() opens window picker', overview.visible && !showApps());
    overview.hide();
    await settle();

    // hot corners, triggered directly through their pressure barrier
    const corners = Object.fromEntries(Main.layoutManager.hotCorners.map(c => [c.spec.id, c]));
    corners['top-left']._pressure.emit('trigger');
    await settle();
    record('top-left opens app grid', overview.visible && showApps());
    corners['top-left']._pressure.emit('trigger');
    await settle();
    record('top-left again closes', !overview.visible);

    await wait(250); // action delay
    corners['top-right']._pressure.emit('trigger');
    await settle();
    record('top-right opens window picker', overview.visible && !showApps());

    // click on empty overview space closes
    const gesture = Main.layoutManager.overviewGroup.get_actions()
        .find(a => a.constructor.name.includes('ClickGesture'));
    record('click gesture installed', !!gesture);
    overview.hide();
    await settle();

    // bottom-left show desktop with no windows is a no-op; must not throw
    await wait(250);
    corners['bottom-left']._pressure.emit('trigger');
    record('bottom-left runs', true);

    // app icon menu items on an app grid icon
    const appDisplay = Main.overview._overview._controls._appDisplay;
    const loaded = appDisplay._loadApps();
    const icon = loaded.find(i => i.constructor.name === 'AppIcon');
    if (icon) {
        icon.popupMenu();
        const labels = icon._menu._getMenuItems().map(i => i.label?.text).filter(Boolean);
        icon._menu.close(false);
        for (const label of ['Hide', 'Hide from Search', 'Edit Entry', 'Open Entry Location'])
            record(`app menu has "${label}"`, labels.includes(label), labels);
    } else {
        record('app grid has an app icon', false);
    }

    // hidden apps are filtered from the grid (only checkable if installed)
    const appSys = Shell.AppSystem.get_default();
    for (const id of ['jshell-java-openjdk.desktop', 'jconsole-java-openjdk.desktop']) {
        if (appSys.lookup_app(id))
            record(`${id} hidden from grid`, !loaded.some(i => i.id === id));
        else
            record(`${id} not installed in test`, true);
    }

    return results;
})();
