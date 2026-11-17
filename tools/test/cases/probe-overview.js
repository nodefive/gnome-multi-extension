// Probe: can the overview be opened from Eval right now? Reports internal state.
(async () => {
    const wait = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
    const o = Main.overview;
    const state = tag => ({tag, shown: o._shown, visible: o._visible, apps: o.dash.showAppsButton.checked,
        modalCount: Main.modalCount});
    const out = [state('start')];
    const steps = '%STEPS%'.split(',');
    for (const step of steps) {
        if (step === 'toggle')
            o.toggle();
        else if (step === 'super')
            global.display.emit('overlay-key');
        else if (step === 'hide')
            o.hide();
        await wait(1200);
        out.push(state(step));
    }
    return out;
})();
