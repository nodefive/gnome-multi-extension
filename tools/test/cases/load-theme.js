// Load a shell theme stylesheet (path in THEME) like a user theme would.
(() => {
    Main.setThemeStylesheet('%THEME%');
    Main.loadTheme();
    return true;
})();
