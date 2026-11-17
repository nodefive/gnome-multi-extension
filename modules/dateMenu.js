// SPDX-License-Identifier: GPL-3.0-only
// Date menu tweaks. Calendar-column logic ported from Just Perfection
// (GPL-3.0-only, Javad Rahmatzadeh); message list hiding from calendar-only.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageList from 'resource:///org/gnome/shell/ui/messageList.js';

import {Module} from '../lib/module.js';
import {CLASS_PREFIX} from '../lib/shell.js';

function dateMenu() {
    return Main.panel.statusArea.dateMenu;
}

function sessionShowsMessageList() {
    return Main.sessionMode.hasNotifications && !Main.sessionMode.isGreeter;
}

function hideWholeList(lc, menu) {
    const list = menu._messageList;
    lc.defer(() => {
        list.visible = sessionShowsMessageList();
    });
    list.hide();
    lc.connect(list, 'notify::visible', () => {
        if (list.visible)
            list.hide();
    });
    lc.connect(menu.menu, 'open-state-changed', (_menu, open) => {
        if (open)
            list.hide();
    });
}

/**
 * Keep media player controls, hide notification groups, the placeholder and
 * the Clear button. The list itself is shown only while a player exists.
 */
function hideNotificationsOnly(lc, menu) {
    const list = menu._messageList;
    const view = list._messageView;
    const placeholder = list._placeholder;
    const controls = list._clearButton.get_parent();
    const hiddenItems = new Set();

    const isMedia = message => message instanceof MessageList.MediaMessage;
    const hasMedia = () => view.messages.some(isMedia);

    lc.defer(() => {
        for (const item of hiddenItems) {
            item.height = -1;
            item.show();
        }
        hiddenItems.clear();
        controls.show();
        placeholder.visible = view.empty;
        list.visible = sessionShowsMessageList();
    });

    const hideItem = item => {
        if (!item || isMedia(item.child) || hiddenItems.has(item))
            return;
        hiddenItems.add(item);
        item.hide();
        item.height = 0;
    };

    const sync = () => {
        for (const message of view.messages)
            hideItem(message.get_parent());
        const show = hasMedia() && sessionShowsMessageList();
        if (list.visible !== show)
            list.visible = show;
    };

    controls.hide();
    placeholder.hide();
    sync();

    lc.connect(view, 'child-added', (_view, item) => {
        hideItem(item);
        sync();
    });
    lc.connect(view, 'child-removed', (_view, item) => {
        hiddenItems.delete(item);
        sync();
    });
    lc.connect(view, 'notify::empty', sync);
    lc.connect(placeholder, 'notify::visible', () => {
        if (placeholder.visible)
            placeholder.hide();
    });
    lc.connect(list, 'notify::visible', () => {
        if (list.visible !== (hasMedia() && sessionShowsMessageList()))
            sync();
    });
    lc.connect(menu.menu, 'open-state-changed', (_menu, open) => {
        if (open)
            sync();
    });
}

export class DateMenuModule extends Module {
    static get key() {
        return 'module-date-menu';
    }

    features() {
        return [
            {
                name: 'date-menu-calendar',
                keys: ['date-menu-calendar'],
                apply(lc, s) {
                    if (s.get_boolean('date-menu-calendar'))
                        return;
                    const calendar = dateMenu()._calendar;
                    calendar.hide();
                    lc.defer(() => calendar.show());
                },
            },
            {
                name: 'date-menu-events-button',
                keys: ['date-menu-events-button'],
                apply(lc, s) {
                    if (!s.get_boolean('date-menu-events-button'))
                        lc.addUiClass(`${CLASS_PREFIX}no-events-button`);
                },
            },
            {
                name: 'date-menu-weather',
                keys: ['date-menu-weather'],
                apply(lc, s) {
                    if (!s.get_boolean('date-menu-weather'))
                        lc.addUiClass(`${CLASS_PREFIX}no-weather`);
                },
            },
            {
                name: 'date-menu-world-clock',
                keys: ['date-menu-world-clock'],
                apply(lc, s) {
                    if (s.get_boolean('date-menu-world-clock'))
                        return;
                    const clocks = dateMenu()._clocksItem;
                    // runs last, after the original _sync is back
                    lc.defer(() => clocks._sync());
                    lc.set(clocks, '_sync', function () {
                        this.visible = false;
                    });
                    lc.connect(clocks, 'show', () => clocks._sync());
                    clocks._sync();
                },
            },
            {
                name: 'date-menu-invert-columns',
                keys: ['date-menu-invert-columns'],
                apply(lc, s) {
                    if (!s.get_boolean('date-menu-invert-columns'))
                        return;
                    const menu = dateMenu();
                    const {_calendar: calendar, _date: date} = menu;
                    const {_eventsItem: events, _clocksItem: clocks, _weatherItem: weather} = menu;

                    const reorder = (box, order, start) => {
                        if (!box)
                            return;
                        for (const child of order)
                            box.remove_child(child);
                        order.forEach((child, i) => box.insert_child_at_index(child, start + i));
                    };

                    const displayBox = events.get_parent();
                    const calendarBox = calendar.get_parent();
                    reorder(displayBox, [weather, clocks, events], 1);
                    reorder(calendarBox, [calendar, date], 1);

                    lc.defer(() => {
                        reorder(displayBox, [events, clocks, weather], 1);
                        reorder(calendarBox, [date, calendar], 0);
                    });
                },
            },
            {
                name: 'date-menu-hide-message-list',
                keys: ['date-menu-hide-message-list', 'date-menu-hide-scope'],
                apply(lc, s) {
                    if (!s.get_boolean('date-menu-hide-message-list'))
                        return;
                    const menu = dateMenu();
                    if (!menu?._messageList)
                        return;
                    if (s.get_string('date-menu-hide-scope') === 'notifications-only')
                        hideNotificationsOnly(lc, menu);
                    else
                        hideWholeList(lc, menu);
                },
            },
        ];
    }
}
