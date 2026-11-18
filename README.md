# Gnome Multi Extension

**Shell Tweaks** (`shell-tweaks@unl0cker`) is a GNOME Shell extension that
combines the panel, overview, app grid, app menu, hot corner, workspace,
window and wallpaper tweaks of eleven separate extensions into one. The
features no longer fight each other, and every module and feature can be
switched on and off on its own.

- Version: 0.2.0 (see [CHANGELOG.md](CHANGELOG.md))
- GNOME Shell: 51 (tested), 50 (declared, untested)
- Session: Wayland (GNOME 50 and later have no X11 session)
- Monitors: single monitor. Everything acts on the primary monitor.
- License: GPL-3.0-only

## Contents

- [Why](#why)
- [Replaced extensions](#replaced-extensions)
- [Design principles](#design-principles)
- [Modules and features](#modules-and-features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Updating and uninstalling](#updating-and-uninstalling)
- [Compatibility with other extensions](#compatibility-with-other-extensions)
- [Development](#development)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Credits and license](#credits-and-license)

## Why

Running many small UI extensions together causes problems that none of them
has on its own:

- Two extensions patch the same Shell method, and the outcome depends on
  which one loads first.
- Disabling one extension restores an "original" that another extension had
  already replaced.
- Overlapping settings, such as two wrap-around options or two ripple
  animations, contradict each other.
- Each extension adds its own startup cost and its own breakage when GNOME is
  updated.

Shell Tweaks gives each Shell object exactly one owner. It resolves the
conflicts once, in code, and it reverts everything it changed when it is
disabled.

## Replaced extensions

| Original | What was kept | License |
|---|---|---|
| [Just Perfection](https://gitlab.gnome.org/jrahmatzadeh/just-perfection) | panel items, sizes and position, quick settings toggles, date menu column, overview elements, Alt+Tab sizes, window menu, animation speed, OSD, notification banner, Looking Glass size, compact theme | GPL-3.0-only |
| [gnome-ui-tune](https://github.com/axxapy/gnome-ui-tune) | hide the search entry until typing, show Firefox picture-in-picture in the overview | GPL-3.0 |
| [start-overlay-in-application-view](https://github.com/Hexcz/Start-Overlay-in-Application-View-for-Gnome-40-) | the Super key opens the app grid | none stated |
| [click-to-close-overview](https://github.com/l3nn4rt/click-to-close-overview) | click empty overview space to close it | GPL-2.0-or-later |
| [Custom Hot Corners - Extended](https://github.com/G-dH/custom-hot-corners-extended) | four corners, pressure and Ctrl+pressure triggers, 36 actions, shortcuts, custom menus, panel menu | GPL-3.0 |
| [scroll-workspaces](https://github.com/timbertson/gnome-shell-scroll-workspaces) | scroll on the panel to switch workspaces | none stated |
| calendar-only | hide the message list in the date menu | own work, GPL-3.0-only here |
| [app-grid-tuner](https://codeberg.org/m-lab/app-grid-tuner) | app grid and folder geometry, labels, background, hover tile, animation times | MIT |
| [app-hider](https://github.com/LynithDev/gnome-app-hider) | Hide and Hide from Search items, hidden app lists | GPL-2.0 |
| [Edit Desktop Files](https://github.com/Dannflower/edit-desktop-files) | Edit Entry and Open Entry Location items | GPL-2.0-or-later |
| wallpaper-launcher | random wallpaper panel button and timer | own work, GPL-3.0-only here |

Licenses as stated in each upstream repository (license file, source
headers or README) on 2026-11-18. "none stated" means the repository has no
license file or notice.

Disable the originals before you enable Shell Tweaks. Running both patches
the same objects twice.

Tiling Shell is not merged. It is large, has no conflicts left after the
merge, and is better kept upstream. Shell Tweaks only restores the Alt+F5
binding that Tiling Shell clears (see [Windows](#windows)).

## Design principles

1. **Inert at defaults.** A feature installs its patch only while its value
   differs from GNOME's own behaviour. A key left at its default costs
   nothing and touches nothing. Modules that always change something when on
   (App grid, Hot corners, Wallpaper) are off by default.
2. **One owner per Shell object.** Every prototype, signal handler and actor
   is patched by exactly one module. Features that touched the same target in
   the original extensions are merged into that module.
3. **Full reversibility.** Every change goes through `lib/lifecycle.js`:
   method overrides (`InjectionManager`), property assignments, signal
   connections, timeouts, style classes and writes to core GSettings keys are
   recorded and reverted in reverse order on disable. The headless test checks
   that the Shell state after three enable/disable cycles is identical to the
   state before the first enable.
4. **Live settings.** Every key applies as soon as it changes, without a
   reload or re-login. Quick changes are debounced, so clicking a spin button
   ten times rebuilds a feature once.

## Modules and features

Each module has a master switch (`module-*`) at the top of its preferences
page. Each feature has its own key. The schema has 183 keys in total.

### Panel

`module-panel`, on by default.

- Show or hide the top panel, show the hidden panel in the overview, put the
  panel at the top or bottom, set its height.
- Show or hide panel items: Activities button, clock menu, keyboard layout,
  accessibility menu, quick settings menu, power icon, the notification dot
  next to the clock, screen sharing and screen recording indicators.
- Move the clock menu: box (center, right, left) and position within the box.
- Spacing: panel button padding, indicator spacing, icon size.
- Quick settings toggles: airplane mode, dark style, night light, keyboard
  backlight, do not disturb. A hidden toggle is restored from GNOME's own
  state when shown again.

### Date menu

`module-date-menu`, on by default.

- Show or hide the calendar, events, world clocks and weather; invert the
  column order.
- Hide the message list, either the whole list or the notifications only.
  Notifications only keeps the media controls.

### Overview

`module-overview`, on by default.

- After login, show the desktop or the overview.
- Super key: enable or disable it, have it open the app grid instead of the
  window picker, double Super opens the app grid. Other callers of
  `Main.overview.toggle()` (hot corners, gestures) still get the window picker.
- Click on empty overview space to close it, with an option to clear an
  active search on the first click.
- Search: show or hide the search entry, hide it until typing starts, type
  to search, maximum results per provider.
- Dash: show or hide the dash, the running-app dot and the Show Apps button.
- Workspaces: show or hide the thumbnails, always show them, thumbnail size,
  peek at adjacent workspaces, a thumbnail click leaves the overview,
  workspaces above the app grid.
- Window previews: app icon, caption, close button.
- Controls spacing and workspace background corner radius.
- Show Firefox picture-in-picture windows in the overview, which GNOME hides
  by default.

### App grid

`module-app-grid`, off by default.

- Grid: columns, rows, icon size, side padding.
- Labels: font size, style (normal, bold, with or without shadow), colour,
  shadow colour.
- Background, applied to the whole overview or to the app grid only:
  theme, solid colour, horizontal or vertical gradient, image, or the current
  wallpaper (follows the desktop background). Image and wallpaper modes can
  take a tint colour and opacity.
- Hover tile: colour, opacity and border colour of the highlight under the
  pointer.
- Folders: columns, rows, icon size, label size, item spacing, row height
  offset, side padding, folder title on or off.
- Folder popup: minimum width or a fixed width and height, height offset,
  colour, opacity, border colour, corner radius. The popup is clamped to the
  primary monitor, and it leaves room for the page dots.
- Folder tile: background colour, opacity, border colour, corner radius.
- Animation times for opening folders and switching pages.

### Apps

`module-app-menu`, on by default (the items themselves are off by default).

- Extra items in the app icon menu:
  - **Hide**: removes the app from the app grid (app grid icons only).
  - **Hide from Search**: removes the app from search results.
  - **Edit Entry**: opens the `.desktop` file in an editor.
  - **Open Entry Location**: shows the `.desktop` file in Files (Nautilus).
- Hidden-app lists, editable in the preferences, each with an unhide button.
- Edit command: the default text editor, or a custom command where `%U` is
  replaced by the file path. The command is run as an argument vector, not
  through a shell.
- Edit a user copy of system entries: a system `.desktop` file is copied to
  `~/.local/share/applications` first, so the edit survives package updates.

### Hot corners

`module-hot-corners`, off by default.

- Four corners on the primary monitor. Each corner has an action, an
  optional command, and an "active in fullscreen" switch. Each corner also
  has a second action, command and fullscreen switch that fire when Ctrl is
  held.
- Trigger: a pressure barrier with a configurable size (percent of the screen
  width and height) and pressure threshold, or a 3 px reactive area as a
  fallback. Options: minimum time between actions, require Shift, ripple
  animation, show the barriers for debugging.
- Keyboard shortcuts for any action (`hot-corners-keyboard-shortcuts`,
  entries of the form `action accelerator`).
- Four custom menus, each a list of actions, which can be opened from a
  corner or a shortcut.
- An optional panel menu with the actions.

Available actions:

| Group | Actions |
|---|---|
| Overview | Toggle Overview, Show Overview, Toggle Overview (current app windows), Toggle App Grid, Show App Grid |
| General | Run Command or Activate App, Show Desktop, Screenshot Tool, Black Screen |
| Workspaces | Previous / Next Workspace, Move Workspace Left / Right |
| Window | Minimize, Maximize (toggle), Close, Fullscreen (toggle), Fullscreen on New Workspace (toggle) |
| Display | Software Brightness Up / Down, Display Brightness Up / Down (backlight) |
| System | Lock Screen, Activate Screensaver, Suspend, Power Off Dialog, Log Out Dialog |
| Sound | Volume Up / Down, Mute (toggle) |
| Menus | Custom Menu 1 to 4 |
| Debug | Looking Glass, Run Command Prompt |

### Workspaces

`module-workspaces`, on by default.

- Scroll on the top panel to switch workspaces, with a minimum time between
  switches and an option to never scroll into the last (empty) workspace.
- Wrap around. One setting drives both scrolling and the keyboard shortcuts.
- Show or hide the workspace switch popup.

### Windows

`module-windows`, on by default.

- Alt+Tab: remove the switcher popup delay; app icon, small icon and window
  preview sizes.
- Window menu on or off, and its Take Screenshot item.
- Focus windows that demand attention instead of showing a notification.
- Maximize new windows.
- Keep Alt+F5 on `unmaximize`. Tiling Shell clears
  `org.gnome.desktop.wm.keybindings unmaximize` when it is enabled. Shell
  Tweaks puts `<Alt>F5` back whenever the key changes and, on disable,
  reverts only its own write.

### Shell

`module-shell`, on by default.

- Animation speed: off, default, almost none, fastest, faster, fast, slow,
  slower, slowest. The speed also scales the app grid and folder animation
  times.
- On-screen displays (volume, brightness) on or off, and their position (ten
  positions).
- Notification banner position (six positions).
- Looking Glass width and height, in tenths of the screen.
- Compact shell theme, accent colour for icons, desktop background menu.
- Diagnostics: `debug` logs folder popup geometry to the journal.

### Wallpaper

`module-wallpaper`, off by default.

- A panel button (first in the right box) that sets a random image from a
  folder as the desktop background, for both light and dark styles.
- Folder: any folder, searched recursively. The default is the XDG Pictures
  folder; `~` is expanded.
- Never pick the current wallpaper again.
- Change automatically every N minutes.
- Errors (missing folder, no images) are shown as an on-screen display.
  The folder is read asynchronously, so a large folder does not block the
  Shell.

## Installation

### From a release

Download `shell-tweaks@unl0cker.shell-extension.zip` from the
[releases page](https://github.com/nodefive/gnome-multi-extension/releases):

```
gnome-extensions install --force shell-tweaks@unl0cker.shell-extension.zip
```

Log out and back in. GNOME Shell finds new extension directories only at
login, and a Wayland session cannot restart the Shell in place. Then:

```
gnome-extensions enable shell-tweaks@unl0cker
```

### From source

Requirements: `glib-compile-schemas` (glib2), `rsync`, and
`gnome-extensions` for packing.

```
git clone https://github.com/nodefive/gnome-multi-extension.git
cd gnome-multi-extension
tools/install-dev.sh            # copies to ~/.local/share/gnome-shell/extensions/shell-tweaks@unl0cker
```

`install-dev.sh` compiles the schema and copies only the runtime files. It
enables nothing. Log out and back in, then enable the extension as above.

To build the zip yourself:

```
tools/pack.sh                   # writes dist/shell-tweaks@unl0cker.shell-extension.zip
```

## Configuration

### Preferences window

```
gnome-extensions prefs shell-tweaks@unl0cker
```

The window has one page per module, each with the module switch at the top.
Rows are built from the schema, so every row shows the key's summary and
description and respects its range. Every row has a reset button, and every
page has a "Reset this page to defaults" row. Search is enabled (Ctrl+F). Hot corners have one
group per corner. The Apps page lists hidden apps with unhide buttons. The
Wallpaper page has a folder chooser.

### Command line

All settings live in `org.gnome.shell.extensions.shell-tweaks`
(dconf path `/org/gnome/shell/extensions/shell-tweaks/`). The schema is not
installed system-wide, so pass the extension's schema directory:

```
dir=~/.local/share/gnome-shell/extensions/shell-tweaks@unl0cker/schemas
gsettings --schemadir "$dir" list-recursively org.gnome.shell.extensions.shell-tweaks
gsettings --schemadir "$dir" set org.gnome.shell.extensions.shell-tweaks module-hot-corners true
gsettings --schemadir "$dir" set org.gnome.shell.extensions.shell-tweaks hot-corners-top-left-action "'toggle-applications'"
```

Key prefixes: `module-*`, `panel-*`, `qs-*`, `date-menu-*`, `overview-*`,
`app-grid-*`, `app-menu-*`, `hot-corners-*`, `workspaces-*`, `windows-*`,
`shell-*`, `wallpaper-*`, plus `debug`.

Back up and restore all settings:

```
dconf dump /org/gnome/shell/extensions/shell-tweaks/ > shell-tweaks.ini
dconf load /org/gnome/shell/extensions/shell-tweaks/ < shell-tweaks.ini
```

Reset everything to defaults:

```
dconf reset -f /org/gnome/shell/extensions/shell-tweaks/
```

## Updating and uninstalling

Update: install the new zip with `--force` (or run `tools/install-dev.sh`),
then log out and back in. Settings are kept.

Uninstall:

```
gnome-extensions disable shell-tweaks@unl0cker
gnome-extensions uninstall shell-tweaks@unl0cker
dconf reset -f /org/gnome/shell/extensions/shell-tweaks/   # optional: remove settings
```

Disabling reverts every change in the running session. Nothing is left
patched.

## Compatibility with other extensions

| Extension | Notes |
|---|---|
| The eleven replaced extensions | Disable them first. They patch the same objects. |
| Tiling Shell | Compatible. Alt+Tab and window menu changes coexist; Alt+F5 is restored by the Windows module. |
| Dash to Dock | Compatible. The overview dash settings act on GNOME's own dash, which Dash to Dock replaces while it runs. Startup to desktop behaves the same in both. |
| Desktop Icons NG (ding) | Compatible. Show Desktop skips desktop-type windows. |
| User Themes | Compatible. App grid inline styles are applied over the theme. |
| Other panel indicators | The wallpaper button stays at index 0 of the right box. |

## Development

### Layout

```
metadata.json         uuid, name, supported Shell versions
extension.js          stable loader (see "Reloading without logging out")
core.js               module list, enable order, module switches
lib/                  lifecycle (reversible changes), module base, shared helpers, hot corner action list
modules/              one file per module; hot corners in modules/hotCorners/
prefs.js, prefs/      Adwaita preferences; rows built from the schema
schemas/              the single GSettings schema
stylesheet.base.css   hand-written rules; stylesheet.css is generated from it
tools/                build, install, reload, checks, tests
```

Modules are enabled in this order and disabled in reverse: Shell, Panel,
Date menu, Overview, App grid, Apps, Workspaces, Windows, Hot corners,
Wallpaper. A module that fails is logged and skipped; the others keep
running.

### Tools

| Script | Purpose |
|---|---|
| `tools/pack.sh` | regenerate the stylesheet, compile and check the schema, run the key check, build `dist/*.zip` |
| `tools/gen-stylesheet.sh` | generate `stylesheet.css` from `stylesheet.base.css` plus the numbered size classes |
| `tools/install-dev.sh [DIR]` | copy the runtime files to an extensions directory (default `~/.local/share/gnome-shell/extensions`); enables nothing |
| `tools/reload.sh` | load the current source into the running session without logging out |
| `tools/check-keys.sh` | check that every schema key is used by the code and shown in the preferences, and that the code uses no unknown keys |
| `tools/test/run-headless.sh` | automated test in a throwaway headless Shell (see [Testing](#testing)) |

### Reloading without logging out

GNOME Shell caches extension modules by URL for the whole session, so
`gnome-extensions disable` followed by `enable` reruns the old code, and
Wayland cannot restart the Shell. `extension.js` is therefore a small loader.
`tools/reload.sh` installs the source, copies the code to `versions/<stamp>/`
inside the installed extension, writes the stamp to `reload-version`, and
disables and enables the extension. The loader then imports the fresh copy
from its new URL.

- At login the bundled code is always used (`reload.sh` keeps it current).
- Changes to `extension.js` or `metadata.json` still need a logout.
- Each reload keeps the previous code in memory until logout. The three
  newest copies stay on disk.
- Settings changes never need a reload.

### Adding a setting

1. Add the key to `schemas/org.gnome.shell.extensions.shell-tweaks.gschema.xml`
   with a summary, an optional description and a range.
2. Use it in the owning module. A module's `features()` returns
   `[{name, keys: [...], apply(lc, settings)}, ...]`; a feature is rebuilt
   when one of its keys changes, and every change it makes goes through the
   `lc` lifecycle so it is reverted on rebuild and on disable.
3. Add it to the matching group in `prefs.js`. The row type comes from the
   schema.
4. Run `tools/check-keys.sh` and `tools/test/run-headless.sh`.

## Testing

`tools/test/run-headless.sh` starts `gnome-shell --headless --virtual-monitor`
without Xwayland, inside `dbus-run-session`, with temporary XDG config, data,
cache, state and runtime directories. Your dconf database and `~/.local/share`
are never written. A test-only helper extension (`tools/test/helper`, never
installed for real) enables unsafe mode so the test can use
`org.gnome.Shell.Eval`.

```
tools/test/run-headless.sh [REPORT_DIR]      # default report dir: test-report/
MODES="live coldstart probe" tools/test/run-headless.sh
```

Modes (`MODES=...`, default `live coldstart`):

| Mode | What it does |
|---|---|
| `live` | baseline snapshot; three enable/disable cycles, each compared with the baseline; configuration checks; Super key, hot corner, click-to-close and app menu tests; every module switched off and on; feature changes at runtime; preferences window opened |
| `coldstart` | extension enabled from login (startup to desktop) |
| `probe` | overview open/close with and without the extension |
| `reload` | two `tools/reload.sh` runs; checks that the new code runs |
| `burst` | ten quick setting changes; checks the debounce |
| `folders` | folder popup geometry with minimum and fixed sizes |
| `background` | app grid background modes; needs `TEST_IMAGE=/path/to/image` |
| `measure` | folder popup measurements with seeded settings, no fixture |

Environment variables:

| Variable | Effect |
|---|---|
| `SETTINGS_SCRIPT` | script that writes settings into the test database, called with `--schemadir DIR` (default `tools/test/test-settings.sh`) |
| `SEED_DCONF` | a `dconf dump /` file loaded into the test database first, so the test Shell resembles a real session |
| `VMON` | virtual monitor size (default `1920x1080`) |
| `USER_APPS=1` | make your own `~/.local/share/applications` visible (read-only) |
| `THEME` | shell theme to load in `measure` mode |

Results are written as JSON lines to `results-<mode>.txt`, along with the
Shell log for each mode and the snapshots. As with any GNOME Shell, the
headless Shell asks logind for the user's session and registers with GDM at
startup. It watches that session for lock signals and changes nothing in it.

For a visual check, `gnome-shell --devkit` needs the `mutter-devkit` package.

## Troubleshooting

Errors and diagnostics go to the user journal:

```
journalctl --user -f -o cat | grep shell-tweaks
```

- **The extension does not appear after installing.** Log out and back in;
  new extension directories are only discovered at login.
- **A module stopped working.** Look for `shell-tweaks: <module-key> failed`
  in the journal. Switch the module off and on in the preferences to retry it.
- **Folder popups have the wrong size.** Turn on `debug` (Shell page,
  Diagnostics) and watch `shell-tweaks[folder]` lines: each open logs the
  requested geometry and what GNOME allocated.
- **Alt+F5 does nothing after enabling Tiling Shell.** Turn on
  *Keep Alt+F5 on unmaximize* in the Windows page.
- **Hot corners do not trigger.** Raise the barrier size or lower the
  pressure threshold. In a VM or with some input drivers, pressure barriers
  do not work; turn on the 3 px fallback.

## Known limitations

- Single monitor: panel, hot corners and folder popups act on the primary
  monitor only.
- GNOME 50 is declared in `metadata.json` but untested. Run
  `tools/test/run-headless.sh` on a GNOME 50 system before relying on it.
- Hot corners that are active in fullscreen keep the compositor from
  unredirecting fullscreen windows while the module is on, as in Custom Hot
  Corners - Extended.
- *Fullscreen on new workspace* moves the window only with dynamic
  workspaces. With fixed workspaces it only makes the window fullscreen.
- The overview dash settings have no effect while Dash to Dock runs.
- Fixed while porting from Just Perfection 37: "type to search" off (it
  patched a method GNOME 51 no longer has), Alt+Tab sizes (the override had
  no effect), panel icon size revert, and quick settings toggle revert
  (restored from GNOME's own state instead of always shown).

## Credits and license

GPL-3.0-only, see [LICENSE](LICENSE).

Contains logic ported from the extensions listed under
[Replaced extensions](#replaced-extensions), with their licenses:

- Just Perfection (GPL-3.0-only, Javad Rahmatzadeh)
- gnome-ui-tune (GPL-3.0, axxapy)
- Custom Hot Corners - Extended (GPL-3.0, GdH)
- click-to-close-overview (GPL-2.0-or-later, l3nn4rt)
- Edit Desktop Files (GPL-2.0-or-later, Dannflower)
- app-hider (GPL-2.0, LynithDev)
- app-grid-tuner (MIT, m-lab)
- start-overlay-in-application-view (Hexcz) and scroll-workspaces
  (timbertson), which state no license

Thanks to their authors.
