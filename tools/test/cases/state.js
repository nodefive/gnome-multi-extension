// Overview state after a cold start, once any closing animation finished.
(async () => {
    await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
    return {
        overviewShown: Main.overview._shown,
        overviewVisible: Main.overview.visible,
        hasOverview: Main.sessionMode.hasOverview,
        ok: !Main.overview._shown && !Main.overview.visible && Main.sessionMode.hasOverview,
    };
})();
