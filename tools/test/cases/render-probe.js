// Renders the app grid and compares real pixels: theme vs image background,
// and an app icon with and without the pointer over it (hover tile).
(async () => {
    const GdkPixbuf = (await import('gi://GdkPixbuf')).default;
    const Clutter = (await import('gi://Clutter')).default;
    const wait = ms => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
    Gio._promisify(Shell.Screenshot.prototype, 'screenshot');

    const shot = async () => {
        const stream = Gio.MemoryOutputStream.new_resizable();
        await new Shell.Screenshot().screenshot(false, stream);
        stream.close(null);
        const input = Gio.MemoryInputStream.new_from_bytes(stream.steal_as_bytes());
        return GdkPixbuf.Pixbuf.new_from_stream(input, null);
    };
    const pixel = (pb, x, y) => {
        const p = pb.get_pixels();
        const i = Math.round(y) * pb.get_rowstride() + Math.round(x) * pb.get_n_channels();
        return [p[i], p[i + 1], p[i + 2]];
    };
    const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

    const settings = Main.extensionManager.lookup('shell-tweaks@unl0cker').stateObj.getSettings();
    const out = {};

    Main.overview.showApps();
    await wait(2000);

    // background: sample a spot of the overview away from icons
    const [sx, sy] = [12, Math.round(global.stage.height / 2)];
    settings.set_string('app-grid-background-mode', 'system');
    await wait(800);
    const themePixel = pixel(await shot(), sx, sy);
    settings.set_string('app-grid-background-image', '%IMAGE%');
    settings.set_string('app-grid-background-mode', 'image');
    await wait(1200);
    const imagePixel = pixel(await shot(), sx, sy);
    out.background = {themePixel, imagePixel, rendered: diff(themePixel, imagePixel) > 30};
    settings.set_string('app-grid-background-mode', 'system');
    await wait(800);

    // hover: put a virtual pointer on the first app icon
    settings.set_boolean('app-grid-hover-tile-enabled', true);
    settings.set_string('app-grid-hover-tile-background-color', '#ff0000');
    settings.set_double('app-grid-hover-tile-background-opacity', 0.8);
    await wait(1000);
    const appDisplay = Main.overview._overview._controls._appDisplay;
    const icon = appDisplay._grid.get_children().find(c => c.constructor.name === 'AppIcon' && c.mapped);
    const [ix, iy] = icon.get_transformed_position();
    const [iw] = icon.get_transformed_size();
    const probe = [ix + iw / 2, iy + 4];

    const seat = global.stage.context.get_backend().get_default_seat();
    const pointer = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
    pointer.notify_absolute_motion(GLib.get_monotonic_time(), 5, 5);
    await wait(600);
    const before = pixel(await shot(), ...probe);
    pointer.notify_absolute_motion(GLib.get_monotonic_time(), ix + iw / 2, iy + iw / 2);
    await wait(800);
    const during = pixel(await shot(), ...probe);
    out.hover = {before, during, hoverState: icon.hover, rendered: diff(before, during) > 30};

    pointer.notify_absolute_motion(GLib.get_monotonic_time(), 5, 5);
    Main.overview.hide();
    return out;
})();
