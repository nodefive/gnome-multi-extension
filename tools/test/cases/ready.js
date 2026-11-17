// true once the Shell finished starting and the test helper is active
(() => !Main.layoutManager._startingUp &&
    Main.extensionManager.lookup('st-test-helper@local')?.state === 1)();
