// SPDX-License-Identifier: GPL-3.0-only

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {keyedGroup, modulePage} from './prefs/widgets.js';
import {hotCornersPage} from './prefs/hotCornersPage.js';
import {appMenuPage, imageFileRow, wallpaperPage} from './prefs/listPages.js';

function backgroundGroup(s, window) {
    const g = keyedGroup('Background', s, [
        'app-grid-background-mode', 'app-grid-background-color',
        'app-grid-gradient-type', 'app-grid-gradient-secondary-color',
        'app-grid-background-tint-color', 'app-grid-background-tint-opacity',
    ], 'Colours apply to Solid colour and Gradient; the tint to Image and Current wallpaper, which follows the desktop wallpaper');
    g.widget.add(imageFileRow(s, 'app-grid-background-image', window, 'app-grid-background-mode', 'image'));
    g.keys.push('app-grid-background-image');
    return g;
}

export default class ShellTweaksPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const s = this.getSettings();
        window.set_default_size(720, 820);
        window.search_enabled = true;

        window.add(modulePage({
            title: 'Panel',
            icon: 'focus-top-bar-symbolic',
            settings: s,
            moduleKey: 'module-panel',
            groups: [
                keyedGroup('Panel', s, ['panel-visible', 'panel-in-overview', 'panel-position', 'panel-size']),
                keyedGroup('Items', s, [
                    'panel-activities-button', 'panel-clock-menu', 'panel-clock-menu-position',
                    'panel-clock-menu-position-offset', 'panel-keyboard-layout', 'panel-accessibility-menu',
                    'panel-quick-settings', 'panel-power-icon', 'panel-notification-icon',
                    'panel-screen-sharing-indicator', 'panel-screen-recording-indicator',
                ]),
                keyedGroup('Spacing', s, [
                    'panel-button-padding-size', 'panel-indicator-padding-size', 'panel-icon-size',
                ]),
                keyedGroup('Quick Settings Toggles', s, [
                    'qs-airplane-mode', 'qs-dark-mode', 'qs-night-light', 'qs-backlight', 'qs-do-not-disturb',
                ]),
            ],
        }));

        window.add(modulePage({
            title: 'Date Menu',
            icon: 'x-office-calendar-symbolic',
            settings: s,
            moduleKey: 'module-date-menu',
            groups: [
                keyedGroup('Message List', s, ['date-menu-hide-message-list', 'date-menu-hide-scope']),
                keyedGroup('Calendar Column', s, [
                    'date-menu-calendar', 'date-menu-events-button', 'date-menu-world-clock',
                    'date-menu-weather', 'date-menu-invert-columns',
                ]),
            ],
        }));

        window.add(modulePage({
            title: 'Overview',
            icon: 'view-grid-symbolic',
            settings: s,
            moduleKey: 'module-overview',
            groups: [
                keyedGroup('Startup and Super Key', s, [
                    'overview-startup-status', 'overview-super-key', 'overview-super-opens-app-grid',
                    'overview-double-super-to-app-grid',
                ]),
                keyedGroup('Closing', s, ['overview-click-empty-to-close', 'overview-click-clears-search-first']),
                keyedGroup('Search', s, [
                    'overview-search', 'overview-hide-search-until-typing', 'overview-type-to-search',
                    'overview-max-search-results',
                ]),
                keyedGroup('Dash', s, ['overview-dash', 'overview-dash-app-running', 'overview-show-apps-button'],
                    'dash-to-dock replaces this dash while it runs'),
                keyedGroup('Workspaces', s, [
                    'overview-workspace-switcher', 'overview-workspace-switcher-should-show',
                    'overview-workspace-switcher-size', 'overview-workspace-peek',
                    'overview-workspace-thumbnail-to-main-view', 'overview-workspaces-in-app-grid',
                    'overview-workspace-background-corner-size', 'overview-controls-spacing-size',
                ]),
                keyedGroup('Window Previews', s, [
                    'overview-window-picker-icon', 'overview-window-preview-caption',
                    'overview-window-preview-close-button', 'overview-firefox-pip',
                ]),
            ],
        }));

        window.add(modulePage({
            title: 'App Grid',
            icon: 'view-app-grid-symbolic',
            settings: s,
            moduleKey: 'module-app-grid',
            groups: [
                keyedGroup('Grid', s, [
                    'app-grid-max-columns', 'app-grid-max-rows', 'app-grid-icon-size', 'app-grid-side-padding',
                ]),
                keyedGroup('Labels', s, [
                    'app-grid-icon-font-size', 'app-grid-label-style', 'app-grid-label-color',
                    'app-grid-label-shadow-color',
                ]),
                backgroundGroup(s, window),
                keyedGroup('Hover Tile', s, [
                    'app-grid-hover-tile-enabled', 'app-grid-hover-tile-background-color',
                    'app-grid-hover-tile-background-opacity', 'app-grid-hover-tile-border-color',
                ], 'Corner radius follows the theme'),
                keyedGroup('Folders', s, [
                    'app-grid-folder-tile-background-color', 'app-grid-folder-tile-background-opacity',
                    'app-grid-folder-tile-border-color', 'app-grid-folder-tile-border-radius',
                    'app-grid-folder-max-columns', 'app-grid-folder-max-rows', 'app-grid-folder-icon-size',
                    'app-grid-folder-icon-font-size', 'app-grid-folder-item-spacing',
                    'app-grid-folder-item-height-offset', 'app-grid-folder-side-padding',
                    'app-grid-hide-folder-title',
                ]),
                keyedGroup('Folder Popup', s, [
                    'app-grid-folder-popup-fixed-size', 'app-grid-folder-popup-fixed-width',
                    'app-grid-folder-popup-fixed-height', 'app-grid-folder-popup-width',
                    'app-grid-folder-popup-height-offset',
                    'app-grid-folder-popup-background-color', 'app-grid-folder-popup-background-opacity',
                    'app-grid-folder-popup-border-color', 'app-grid-folder-popup-border-radius',
                ]),
                keyedGroup('Animation', s, ['app-grid-open-animation-time', 'app-grid-page-switch-animation-time'],
                    'Scaled by the Shell animation speed'),
            ],
        }));

        window.add(appMenuPage(s));
        window.add(hotCornersPage(s));

        window.add(modulePage({
            title: 'Workspaces',
            icon: 'view-dual-symbolic',
            settings: s,
            moduleKey: 'module-workspaces',
            groups: [
                keyedGroup('Switching', s, [
                    'workspaces-panel-scroll', 'workspaces-scroll-delay', 'workspaces-ignore-last',
                    'workspaces-wrap-around', 'workspaces-popup',
                ]),
            ],
        }));

        window.add(modulePage({
            title: 'Windows',
            icon: 'focus-windows-symbolic',
            settings: s,
            moduleKey: 'module-windows',
            groups: [
                keyedGroup('Switcher', s, [
                    'windows-switcher-popup-delay', 'windows-alt-tab-icon-size',
                    'windows-alt-tab-small-icon-size', 'windows-alt-tab-window-preview-size',
                ]),
                keyedGroup('Window Menu', s, ['windows-menu', 'windows-menu-screenshot-item']),
                keyedGroup('Behaviour', s, [
                    'windows-demands-attention-focus', 'windows-maximized-on-create', 'windows-restore-alt-f5',
                ]),
            ],
        }));

        window.add(modulePage({
            title: 'Shell',
            icon: 'preferences-system-symbolic',
            settings: s,
            moduleKey: 'module-shell',
            groups: [
                keyedGroup('Animation', s, ['shell-animation']),
                keyedGroup('On-screen Displays and Notifications', s, [
                    'shell-osd', 'shell-osd-position', 'shell-notification-banner-position',
                ]),
                keyedGroup('Appearance', s, ['shell-theme', 'shell-accent-color-icon', 'shell-background-menu']),
                keyedGroup('Looking Glass', s, ['shell-looking-glass-width', 'shell-looking-glass-height']),
                keyedGroup('Diagnostics', s, ['debug']),
            ],
        }));

        window.add(wallpaperPage(s, window));
    }
}
