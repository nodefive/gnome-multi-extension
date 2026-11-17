// SPDX-License-Identifier: GPL-3.0-only
// Workspace switching. Panel scrolling ported from scroll-workspaces; wrap
// around and switcher popup ported from Just Perfection (GPL-3.0-only).

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as WorkspaceSwitcherPopup from 'resource:///org/gnome/shell/ui/workspaceSwitcherPopup.js';

import {Module} from '../lib/module.js';

const SMOOTH_SCROLL_MIN_DELAY = 150;

function scrollDirection(event) {
    let direction = event.get_scroll_direction();
    const smooth = direction === Clutter.ScrollDirection.SMOOTH;
    if (smooth) {
        const [dx, dy] = event.get_scroll_delta();
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0)
                direction = Clutter.ScrollDirection.LEFT;
            else if (dx > 0)
                direction = Clutter.ScrollDirection.RIGHT;
        } else if (dy < 0) {
            direction = Clutter.ScrollDirection.UP;
        } else if (dy > 0) {
            direction = Clutter.ScrollDirection.DOWN;
        }
    }
    return [direction, smooth];
}

export class WorkspacesModule extends Module {
    static get key() {
        return 'module-workspaces';
    }

    features() {
        return [
            {
                name: 'workspaces-panel-scroll',
                keys: [
                    'workspaces-panel-scroll', 'workspaces-scroll-delay',
                    'workspaces-ignore-last', 'workspaces-wrap-around',
                ],
                apply(lc, s) {
                    if (!s.get_boolean('workspaces-panel-scroll'))
                        return;
                    const delay = s.get_int('workspaces-scroll-delay');
                    const ignoreLast = s.get_boolean('workspaces-ignore-last');
                    const wrap = s.get_boolean('workspaces-wrap-around');
                    let lastScroll = 0;

                    lc.set(Main.panel, 'reactive', true);
                    lc.connect(Main.panel, 'scroll-event', (_actor, event) => {
                        let [direction, smooth] = scrollDirection(event);
                        if (direction === Clutter.ScrollDirection.SMOOTH)
                            return Clutter.EVENT_PROPAGATE;

                        const manager = global.workspace_manager;
                        const vertical = manager.layout_rows === -1;
                        const rtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;
                        if (!vertical) {
                            if (direction === Clutter.ScrollDirection.UP)
                                direction = rtl ? Clutter.ScrollDirection.RIGHT : Clutter.ScrollDirection.LEFT;
                            else if (direction === Clutter.ScrollDirection.DOWN)
                                direction = rtl ? Clutter.ScrollDirection.LEFT : Clutter.ScrollDirection.RIGHT;
                        }

                        const motion = {
                            [Clutter.ScrollDirection.UP]: Meta.MotionDirection.UP,
                            [Clutter.ScrollDirection.DOWN]: Meta.MotionDirection.DOWN,
                            [Clutter.ScrollDirection.LEFT]: Meta.MotionDirection.LEFT,
                            [Clutter.ScrollDirection.RIGHT]: Meta.MotionDirection.RIGHT,
                        }[direction];
                        if (motion === undefined)
                            return Clutter.EVENT_PROPAGATE;

                        const now = Date.now();
                        const effectiveDelay = Math.max(delay, smooth ? SMOOTH_SCROLL_MIN_DELAY : 0);
                        if (now < lastScroll)
                            lastScroll = 0;
                        else if (now < lastScroll + effectiveDelay)
                            return Clutter.EVENT_STOP;

                        const active = manager.get_active_workspace();
                        const tail = !Main.overview.visible && ignoreLast ? 1 : 0;
                        const count = manager.n_workspaces - tail;
                        let target = active.get_neighbor(motion);

                        if (wrap && (target === active || target.index() >= count)) {
                            target = target.index() === 0 || motion === Meta.MotionDirection.UP ||
                                motion === Meta.MotionDirection.LEFT
                                ? manager.get_workspace_by_index(Math.max(0, count - 1))
                                : manager.get_workspace_by_index(0);
                        }
                        if (!target || target.index() >= count)
                            return Clutter.EVENT_STOP;

                        Main.wm.actionMoveWorkspace(target);
                        lastScroll = now;
                        return Clutter.EVENT_STOP;
                    });
                },
            },
            {
                name: 'workspaces-wrap-around',
                keys: ['workspaces-wrap-around'],
                apply(lc, s) {
                    if (!s.get_boolean('workspaces-wrap-around'))
                        return;
                    lc.override(Meta.Workspace.prototype, 'get_neighbor', () => function (direction) {
                        const index = this.index();
                        const last = global.workspace_manager.n_workspaces - 1;
                        const previous = direction === Meta.MotionDirection.UP ||
                            direction === Meta.MotionDirection.LEFT;
                        let neighbor;
                        if (previous)
                            neighbor = index > 0 ? index - 1 : last;
                        else
                            neighbor = index < last ? index + 1 : 0;
                        return global.workspace_manager.get_workspace_by_index(neighbor);
                    });
                },
            },
            {
                name: 'workspaces-popup',
                keys: ['workspaces-popup'],
                apply(lc, s) {
                    if (s.get_boolean('workspaces-popup'))
                        return;
                    lc.override(WorkspaceSwitcherPopup.WorkspaceSwitcherPopup.prototype, 'display', () =>
                        function () {
                            this.destroy();
                        });
                },
            },
        ];
    }
}
