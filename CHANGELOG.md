# Changelog

All notable changes are listed here. Versions follow
[Semantic Versioning](https://semver.org/).

## 0.2.0 - 2026-11-17

First public release.

### Added

- Ten modules, each with a master switch: Panel, Date menu, Overview, App
  grid, Apps, Hot corners, Workspaces, Windows, Shell, Wallpaper. There are
  183 settings in one GSettings schema.
- Features ported from Just Perfection, gnome-ui-tune,
  start-overlay-in-application-view, click-to-close-overview, Custom Hot
  Corners - Extended, scroll-workspaces, calendar-only, app-grid-tuner,
  app-hider, Edit Desktop Files and wallpaper-launcher, with the conflicts
  between them resolved.
- Lifecycle layer that records every Shell change (injections, properties,
  signals, timeouts, style classes, core GSettings writes) and reverts it on
  disable.
- Adwaita preferences window built from the schema, with per-key and
  per-page reset and search.
- App grid background options: whole overview or app grid only, solid,
  gradient, image or current wallpaper, with tint.
- Hide from Search item and hidden-search list for the app icon menu.
- Fixed-size folder popups.
- Keep Alt+F5 on unmaximize when Tiling Shell clears it.
- Loader that reloads the code in a running session (`tools/reload.sh`).
- Headless test suite in an isolated GNOME Shell (`tools/test/run-headless.sh`).

### Fixed (compared with the original extensions)

- Type to search off works on GNOME 51.
- Alt+Tab icon and preview sizes take effect.
- Panel icon size and quick settings toggles are reverted correctly on
  disable.
- Folder popups stay on the primary monitor, keep room for the page dots
  and keep their style during the open animation.
