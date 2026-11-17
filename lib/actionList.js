// SPDX-License-Identifier: GPL-3.0-only
// Hot corner action catalogue (the subset kept from Custom Hot Corners -
// Extended). Pure data: shared by the extension and the preferences window.

export const ACTIONS = [
    {id: 'disabled', name: 'Disabled', icon: '', group: ''},

    {id: 'toggle-overview', name: 'Toggle Overview (window picker)', icon: 'view-grid-symbolic', group: 'Overview'},
    {id: 'show-overview', name: 'Show Overview (window picker)', icon: 'view-grid-symbolic', group: 'Overview'},
    {id: 'toggle-overview-app', name: 'Toggle Overview (current app windows)', icon: 'focus-windows-symbolic', group: 'Overview', needsWindow: true},
    {id: 'toggle-applications', name: 'Toggle App Grid', icon: 'view-app-grid-symbolic', group: 'Overview'},
    {id: 'show-applications', name: 'Show App Grid', icon: 'view-app-grid-symbolic', group: 'Overview'},

    {id: 'run-command', name: 'Run Command or Activate App', icon: 'utilities-terminal-symbolic', group: 'General', needsCommand: true},
    {id: 'show-desktop-mon', name: 'Show Desktop', icon: 'preferences-desktop-wallpaper-symbolic', group: 'General'},
    {id: 'show-screenshot-ui', name: 'Screenshot Tool', icon: 'media-record-symbolic', group: 'General'},
    {id: 'black-screen-mon', name: 'Black Screen', icon: 'video-display-symbolic', group: 'General'},

    {id: 'prev-workspace', name: 'Previous Workspace', icon: 'go-previous-symbolic', group: 'Workspaces'},
    {id: 'next-workspace', name: 'Next Workspace', icon: 'go-next-symbolic', group: 'Workspaces'},
    {id: 'reorder-ws-prev', name: 'Move Workspace Left', icon: 'go-previous-symbolic', group: 'Workspaces'},
    {id: 'reorder-ws-next', name: 'Move Workspace Right', icon: 'go-next-symbolic', group: 'Workspaces'},

    {id: 'minimize-win', name: 'Minimize Window', icon: 'window-minimize-symbolic', group: 'Window', needsWindow: true},
    {id: 'maximize-win', name: 'Maximize Window (toggle)', icon: 'window-maximize-symbolic', group: 'Window', needsWindow: true},
    {id: 'close-win', name: 'Close Window', icon: 'window-close-symbolic', group: 'Window', needsWindow: true},
    {id: 'fullscreen-win', name: 'Fullscreen Window (toggle)', icon: 'view-fullscreen-symbolic', group: 'Window', needsWindow: true},
    {id: 'fullscreen-on-empty-ws', name: 'Fullscreen Window on New Workspace (toggle)', icon: 'view-fullscreen-symbolic', group: 'Window', needsWindow: true},

    {id: 'bright-up-all', name: 'Software Brightness Up', icon: 'display-brightness-symbolic', group: 'Display'},
    {id: 'bright-down-all', name: 'Software Brightness Down', icon: 'display-brightness-symbolic', group: 'Display'},
    {id: 'display-brightness-up', name: 'Display Brightness Up (backlight)', icon: 'display-brightness-symbolic', group: 'Display'},
    {id: 'display-brightness-down', name: 'Display Brightness Down (backlight)', icon: 'display-brightness-symbolic', group: 'Display'},

    {id: 'lock-screen', name: 'Lock Screen', icon: 'changes-prevent-symbolic', group: 'System'},
    {id: 'screensaver', name: 'Activate Screensaver', icon: 'preferences-desktop-screensaver-symbolic', group: 'System'},
    {id: 'suspend', name: 'Suspend', icon: 'weather-clear-night-symbolic', group: 'System'},
    {id: 'power-off', name: 'Power Off Dialog', icon: 'system-shutdown-symbolic', group: 'System'},
    {id: 'log-out', name: 'Log Out Dialog', icon: 'system-log-out-symbolic', group: 'System'},

    {id: 'volume-up', name: 'Volume Up', icon: 'audio-volume-high-symbolic', group: 'Sound'},
    {id: 'volume-down', name: 'Volume Down', icon: 'audio-volume-low-symbolic', group: 'Sound'},
    {id: 'mute-sound', name: 'Mute (toggle)', icon: 'audio-volume-muted-symbolic', group: 'Sound'},

    {id: 'show-custom-menu-1', name: 'Custom Menu 1', icon: 'open-menu-symbolic', group: 'Menus'},
    {id: 'show-custom-menu-2', name: 'Custom Menu 2', icon: 'open-menu-symbolic', group: 'Menus'},
    {id: 'show-custom-menu-3', name: 'Custom Menu 3', icon: 'open-menu-symbolic', group: 'Menus'},
    {id: 'show-custom-menu-4', name: 'Custom Menu 4', icon: 'open-menu-symbolic', group: 'Menus'},

    {id: 'looking-glass', name: 'Looking Glass', icon: 'edit-find-symbolic', group: 'Debug'},
    {id: 'run-prompt', name: 'Run Command Prompt', icon: 'utilities-terminal-symbolic', group: 'Debug'},
];

export const ACTION_IDS = new Set(ACTIONS.map(a => a.id));

export const CORNERS = [
    {id: 'top-left', name: 'Top Left', top: true, left: true},
    {id: 'top-right', name: 'Top Right', top: true, left: false},
    {id: 'bottom-left', name: 'Bottom Left', top: false, left: true},
    {id: 'bottom-right', name: 'Bottom Right', top: false, left: false},
];

export function actionById(id) {
    return ACTIONS.find(a => a.id === id) ?? ACTIONS[0];
}
