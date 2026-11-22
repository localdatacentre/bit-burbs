"""Exercise the city canvas and placement controls with real touch input."""
import re

from playwright.sync_api import expect


def check_placement(browser, base):
    context = browser.new_context(viewport={"width": 428, "height": 926},
                                  is_mobile=True, has_touch=True, service_workers="block")
    page = context.new_page()
    page.on("pageerror", lambda error: print(f"Placement page error: {error}", flush=True))
    page.set_default_timeout(10000)
    page.route("https://**/*", lambda route: route.abort())
    page.goto(base + "/?demo=full-city", wait_until="domcontentloaded")
    page.locator("body.city-ready").wait_for()
    # Start from the game's normal demo schema, clearing the map before reload.
    page.add_init_script("""(() => {
        if (window.top !== window || location.search !== '?demo=full-city') return;
        const slot = 'bit-burbs-full-test-city-v1';
        const city = JSON.parse(localStorage.getItem(slot));
        if (!city) return;
        city.tiles.fill(null);
        Object.assign(city, {cash: 20000, xp: 0, storedBuildings: [], bagPopupPending: 0});
        localStorage.setItem(slot, JSON.stringify(city));
    })()""")
    page.reload(wait_until="domcontentloaded")
    page.locator("body.city-ready").wait_for()
    page.evaluate("document.fonts.ready")
    session = context.new_cdp_session(page)

    def snapshot(fresh=False):
        if fresh:
            # The fixture has no income sources. Observe a normal autosave
            # completed after the action without changing focus or visibility.
            stamp = page.evaluate("Date.now()")
            page.wait_for_function("""stamp =>
                JSON.parse(localStorage.getItem('bit-burbs-full-test-city-v1')).saved > stamp""",
                                   arg=stamp, polling=100, timeout=20000)
        return page.evaluate("""() => {
            const city = JSON.parse(localStorage.getItem('bit-burbs-full-test-city-v1'));
            const side = Math.sqrt(city.tiles.length);
            const plots = city.tiles.flatMap((tile, n) => tile && tile.id !== '_occ'
                ? [[n % side, Math.floor(n / side), tile.id, tile.purchaseCoins]] : []);
            return {cash: city.cash, plots, mid: side / 2};
        }""")

    def purchased(plot, cash):
        page.wait_for_function("""([plot, cash]) => {
            const city = JSON.parse(localStorage.getItem('bit-burbs-full-test-city-v1'));
            const [i, j, model, price] = plot;
            const tile = city.tiles[j * Math.sqrt(city.tiles.length) + i];
            return tile?.id === model && tile.purchaseCoins === price && city.cash === cash;
        }""", arg=[plot, cash], polling=100, timeout=20000)
        return snapshot()

    # The full-city demo opens at (mid, mid+3), zoom 0.65. Aim for tile centres.
    centre = page.evaluate("""() => [
        document.querySelector('#game').getBoundingClientRect().width / 2,
        (document.querySelector('#hud').getBoundingClientRect().bottom +
         document.querySelector('#nav').getBoundingClientRect().top) / 2
    ]""")
    camera_x = camera_y = 0

    def point(i, j):
        return (centre[0] + camera_x + (i-j) * 32 * .65,
                centre[1] + camera_y + (i+j+1) * 16 * .65)

    def touch(kind, *points):
        session.send("Input.dispatchTouchEvent", {
            "type": kind, "touchPoints": [
                {"id": index, "x": p[0], "y": p[1]} for index, p in enumerate(points)
            ]})

    def tap(*position):
        # Use the same Chromium input source as dragging and pinching. A real
        # finger stays on the control across at least one displayed frame.
        touch("touchStart", position)
        page.evaluate("new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
        touch("touchEnd")

    def tap_control(locator):
        locator.tap(trial=True)
        bounds = locator.bounding_box()
        tap(bounds["x"] + bounds["width"]/2, bounds["y"] + bounds["height"]/2)

    def drag(start, end):
        touch("touchStart", start)
        touch("touchMove", end)
        touch("touchEnd")

    def choose(model):
        button = page.locator(f'#sheetBody [data-act="choose"][data-id="{model}"]')
        price = int(re.sub(r"[^0-9]", "", button.locator(".price").inner_text()))
        tap_control(button)
        return price

    def card(action):
        return page.locator(f'#card [data-act="{action}"]')

    def confirm(action, finished, repeat_at=None):
        page.evaluate("""() => {
            window.placementEvents = [];
            let pressed;
            const label = el => el?.closest('[data-act]')?.dataset.act || el?.id || el?.tagName;
            for (const name of ['pointerdown', 'touchstart', 'pointerup', 'pointercancel',
                                'touchend', 'touchcancel', 'mousedown', 'mouseup', 'click']) {
                document.addEventListener(name, e => {
                    if (name === 'pointerdown') pressed = e.target;
                    const touch = e.changedTouches?.[0] || e;
                    const hit = document.elementFromPoint(touch.clientX, touch.clientY);
                    const info = {name, target: label(e.target), hit: label(hit), same: e.target === pressed,
                                  x: touch.clientX, y: touch.clientY, cancelable: e.cancelable};
                    window.placementEvents.push(info);
                    setTimeout(() => Object.assign(info, {
                        prevented: e.defaultPrevented, connected: e.target.isConnected
                    }), 0);
                }, {once: true, capture: true});
            }
        }""")
        tap_control(card(action))
        try:
            finished()
        except AssertionError:
            print("Placement confirmation:", page.evaluate("""() => ({
                events: window.placementEvents, hudCoins: document.querySelector('#cash').textContent,
                card: document.querySelector('#card').innerText, toast: document.querySelector('#toast').innerText,
                overlays: [...document.querySelectorAll('#modal.show,dialog[open],#sheet.open,#mg.show')]
                    .map(el => [el.id, el.innerText.slice(0, 150)])
            })"""), "save:", snapshot(), flush=True)
            raise
        if repeat_at:
            tap(*repeat_at)

    original = snapshot()
    mid = original["mid"]
    assert original["plots"] == [], original
    anchor, moved = point(-4, -4), point(-2, -4)
    tap(*anchor)
    tap_control(card("buildHere"))
    house_cost = choose("house")
    expect(card("confirmPlace")).to_be_enabled()
    assert snapshot() == original, "Choosing a building on a selected plot spent coins"
    tap_control(card("cancelPlace"))
    assert snapshot(fresh=True) == original

    if card("closeCard").is_visible():
        tap_control(card("closeCard"))
    tap_control(page.get_by_role("button", name="Build", exact=True))
    choose("house")
    expect(card("confirmPlace")).to_be_disabled()
    tap(*anchor)
    expect(card("confirmPlace")).to_be_enabled()
    drag(anchor, moved)
    assert snapshot() == original
    confirm("confirmPlace", lambda: expect(page.locator("#card h2")).to_have_text("Modern House"))
    house = [mid-2, mid+3-4, "house", house_cost]
    after_house = purchased(house, original["cash"] - house_cost)
    assert after_house["plots"] == [house], after_house
    assert after_house["cash"] == original["cash"] - house_cost, after_house
    # A newly built home shows its name before the simulation fills in the
    # property details. That layout moves the Close button up on the screen.
    expect(card("manageProperty")).to_be_visible()
    confirm("closeCard", lambda: expect(page.locator("#nav [data-open=build]")).to_be_visible())

    tap_control(page.get_by_role("button", name="Build", exact=True))
    tap_control(page.locator('#sheetBody [data-tab="city"]'))
    road_cost = choose("road")
    build = card("confirmRoad")
    expect(build).to_be_disabled()

    # Pan the empty preview, then tap the house at its new on-screen position.
    start = point(-4, 0)
    drag(start, (start[0]+42, start[1]+21))
    camera_x, camera_y = 42, 21
    expect(build).to_be_disabled()
    tap(*point(-2, -4))
    expect(build).to_be_disabled()
    assert snapshot() == after_house

    road_point = point(-4, 0)
    tap(*road_point)
    expect(build).to_be_enabled()
    # A drag that starts on the road preview must only move the camera.
    drag(road_point, (road_point[0]+45, road_point[1]-18))
    camera_x += 45
    camera_y -= 18
    expect(build).to_be_enabled()
    assert snapshot() == after_house
    bounds = build.bounding_box()
    button_centre = (bounds["x"] + bounds["width"]/2, bounds["y"] + bounds["height"]/2)
    drag(button_centre, (button_centre[0], bounds["y"] - 48))
    touch("touchStart", button_centre)
    touch("touchCancel")
    expect(build).to_be_enabled()
    assert snapshot() == after_house, "Swiping away or cancelling committed the road"
    confirm("confirmRoad", lambda: expect(build).to_be_disabled(), repeat_at=button_centre)
    road = [mid-4, mid+3, "road", road_cost]
    after_road = purchased(road, after_house["cash"] - road_cost)
    assert after_road["plots"] == [house, road], after_road
    assert after_road["cash"] == after_house["cash"] - road_cost, after_road
    expect(build).to_be_disabled()
    tap(*point(-4, 0))
    expect(build).to_be_disabled()

    # A cancelled touch must not replace the blocked selection.
    a, b = point(-6, -1), point(-2, -1)
    touch("touchStart", a)
    touch("touchCancel")
    expect(build).to_be_disabled()
    # Some swipes deliver their full displacement only in the final pointerup.
    session.send("Input.dispatchMouseEvent", {"type": "mousePressed", "button": "left",
                 "buttons": 1, "clickCount": 1, "x": a[0], "y": a[1]})
    session.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "button": "left",
                 "buttons": 0, "clickCount": 1, "x": a[0]-32, "y": a[1]+16})
    camera_x -= 32
    camera_y += 16
    expect(build).to_be_disabled()
    a, b = point(-6, -1), point(-2, -1)
    tap(*a)
    expect(build).to_be_enabled()
    # Zooming preserves the proposed tile. Done discards it without charging.
    touch("touchStart", a, b)
    touch("touchMove", (a[0]-12, a[1]), (b[0]+12, b[1]))
    touch("touchEnd")
    expect(build).to_be_enabled()
    tap_control(card("donePlace"))
    assert snapshot(fresh=True) == after_road
    context.close()
    print("Passed mobile building placement and tap-only road placement", flush=True)
