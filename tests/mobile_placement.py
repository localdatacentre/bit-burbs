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
    page.clock.set_fixed_time("2026-03-08T06:30:00Z")
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

    def snapshot():
        # The visibility handler flushes the actual city save synchronously.
        return page.evaluate("""() => {
            document.dispatchEvent(new Event('visibilitychange'));
            const city = JSON.parse(localStorage.getItem('bit-burbs-full-test-city-v1'));
            const side = Math.sqrt(city.tiles.length);
            const plots = city.tiles.flatMap((tile, n) => tile && tile.id !== '_occ'
                ? [[n % side, Math.floor(n / side), tile.id, tile.purchaseCoins]] : []);
            return {cash: city.cash, plots, mid: side / 2};
        }""")

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
                {"id": index, "x": p[0], "y": p[1]} for index, p in enumerate(points, 1)
            ]})

    def drag(start, end):
        touch("touchStart", start)
        touch("touchMove", end)
        touch("touchEnd")

    def choose(model):
        button = page.locator(f'#sheetBody [data-act="choose"][data-id="{model}"]')
        price = int(re.sub(r"[^0-9]", "", button.locator(".price").inner_text()))
        button.tap()
        return price

    def card(action):
        return page.locator(f'#card [data-act="{action}"]')

    def confirm(action, finished):
        page.evaluate("""() => {
            window.placementEvents = [];
            for (const name of ['pointerdown', 'pointerup', 'click']) {
                document.addEventListener(name, e => {
                    const node = e.target.closest('[data-act]');
                    window.placementEvents.push([name, node?.dataset.act || e.target.id]);
                }, {once: true, capture: true});
            }
        }""")
        card(action).tap()
        try:
            finished()
        except AssertionError:
            print("Placement confirmation:", page.evaluate("""() => ({
                events: window.placementEvents, hudCoins: document.querySelector('#cash').textContent,
                card: document.querySelector('#card').innerText, toast: document.querySelector('#toast').innerText
            })"""), "save:", snapshot(), flush=True)
            raise

    original = snapshot()
    mid = original["mid"]
    assert original["plots"] == [], original
    anchor, moved = point(-4, -4), point(-2, -4)
    page.touchscreen.tap(*anchor)
    card("buildHere").tap()
    house_cost = choose("house")
    expect(card("confirmPlace")).to_be_enabled()
    assert snapshot() == original, "Choosing a building on a selected plot spent coins"
    card("cancelPlace").tap()
    assert snapshot() == original

    if card("closeCard").is_visible():
        card("closeCard").tap()
    page.get_by_role("button", name="Build", exact=True).tap()
    choose("house")
    expect(card("confirmPlace")).to_be_disabled()
    page.touchscreen.tap(*anchor)
    expect(card("confirmPlace")).to_be_enabled()
    drag(anchor, moved)
    assert snapshot() == original
    confirm("confirmPlace", lambda: expect(page.locator("#card h2")).to_have_text("Modern House"))
    after_house = snapshot()
    house = [mid-2, mid+3-4, "house", house_cost]
    assert after_house["plots"] == [house], after_house
    assert after_house["cash"] == original["cash"] - house_cost, after_house
    card("closeCard").tap()

    page.get_by_role("button", name="Build", exact=True).tap()
    page.locator('#sheetBody [data-tab="city"]').tap()
    road_cost = choose("road")
    build = card("confirmRoad")
    expect(build).to_be_disabled()

    # Pan the empty preview, then tap the house at its new on-screen position.
    start = point(-4, 0)
    drag(start, (start[0]+42, start[1]+21))
    camera_x, camera_y = 42, 21
    expect(build).to_be_disabled()
    page.touchscreen.tap(*point(-2, -4))
    expect(build).to_be_disabled()
    assert snapshot() == after_house

    road_point = point(-4, 0)
    page.touchscreen.tap(*road_point)
    expect(build).to_be_enabled()
    # A drag that starts on the road preview must only move the camera.
    drag(road_point, (road_point[0]+45, road_point[1]-18))
    camera_x += 45
    camera_y -= 18
    expect(build).to_be_enabled()
    assert snapshot() == after_house
    confirm("confirmRoad", lambda: expect(build).to_be_disabled())
    after_road = snapshot()
    road = [mid-4, mid+3, "road", road_cost]
    assert after_road["plots"] == [house, road], after_road
    assert after_road["cash"] == after_house["cash"] - road_cost, after_road
    expect(build).to_be_disabled()
    page.touchscreen.tap(*point(-4, 0))
    expect(build).to_be_disabled()

    # A cancelled touch must not replace the blocked selection.
    a, b = point(-6, -1), point(-2, -1)
    touch("touchStart", a)
    touch("touchCancel")
    expect(build).to_be_disabled()
    page.touchscreen.tap(*a)
    expect(build).to_be_enabled()
    # Zooming preserves the proposed tile. Done discards it without charging.
    touch("touchStart", a, b)
    touch("touchMove", (a[0]-12, a[1]), (b[0]+12, b[1]))
    touch("touchEnd")
    expect(build).to_be_enabled()
    card("donePlace").tap()
    assert snapshot() == after_road
    context.close()
    print("Passed mobile building placement and tap-only road placement", flush=True)
