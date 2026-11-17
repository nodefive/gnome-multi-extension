// Probe: did the startup-status feature apply during a cold start?
(() => {
    const ext = Main.extensionManager.lookup('shell-tweaks@unl0cker');
    const modules = ext?.stateObj?._core?._modules ?? ext?.stateObj?._modules ?? [];
    const overview = modules.find(m => m.key === 'module-overview')?.instance;
    const feature = overview?._features?.find(f => f.name === 'overview-startup-status');
    return {
        extState: ext?.state,
        overviewModuleEnabled: overview?.enabled ?? null,
        featureUndoSteps: feature?.lc?._undo?.length ?? null,
        startupLog: globalThis.__shellTweaksStartupLog ?? null,
        overviewVisible: Main.overview.visible,
        startingUp: Main.layoutManager._startingUp,
    };
})();
