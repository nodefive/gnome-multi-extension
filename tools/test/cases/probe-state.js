// Probe: state of Shell Tweaks and the loaded extension set.
(() => {
    const ext = Main.extensionManager.lookup('shell-tweaks@unl0cker');
    return {
        known: !!ext,
        state: ext?.state ?? null,
        error: ext?.error ?? null,
        loaded: Main.extensionManager.getUuids(),
        enabled: Main.extensionManager._enabledExtensions ?? null,
    };
})();
