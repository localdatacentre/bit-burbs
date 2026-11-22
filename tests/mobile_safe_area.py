"""Check live game menus with simulated mobile cutouts and device time zones."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from itertools import combinations
from math import isqrt
from pathlib import Path
from shutil import which
from threading import Thread

from playwright.sync_api import sync_playwright
from mobile_placement import check_placement


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def check_home_menu(page, visible):
    dock = page.locator("#nav")
    assert dock.locator("> button[data-open]:visible").count() == (6 if visible else 0)
    assert dock.get_by_role("button").count() == (6 if visible else 0)


def check_shop_offers(room):
    cards = room.locator(".shop-menu .shop-offer")
    cards.first.wait_for()
    content_width = room.locator("#screen").evaluate("""el => {
        const style = getComputedStyle(el);
        return el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    }""")
    expected_width = min(0.86 * content_width, 280)
    previous_bottom = None
    for card in cards.all():
        box = card.bounding_box()
        bottom = box["y"] + box["height"]
        assert abs(box["width"] - expected_width) <= 1, (box, expected_width)
        assert abs(box["height"] - box["width"]) <= 1, box
        assert previous_bottom is None or box["y"] >= previous_bottom, box
        previous_bottom = bottom
        button = card.locator("[data-offer]").bounding_box()
        assert button["height"] >= 44 and button["y"] + button["height"] <= bottom + 1, button
        for reward in card.locator(".offer-rewards li").all():
            item = reward.bounding_box()
            assert item["y"] >= box["y"] and item["y"] + item["height"] <= button["y"] + 1, item
            assert reward.evaluate("(el) => el.scrollWidth <= el.clientWidth + 1")


def check_layout(page, base, viewport, insets):
    width, height = viewport
    top, side, bottom = insets

    def check(selector, check_bottom=False):
        element = page.locator(selector).first
        element.wait_for(state="visible")
        rect = element.bounding_box()
        assert rect["y"] >= top - 0.5, (selector, rect, insets)
        assert rect["x"] >= side - 0.5, (selector, rect, insets)
        assert rect["x"] + rect["width"] <= width - side + 0.5, (selector, rect, insets)
        if check_bottom:
            assert rect["y"] + rect["height"] <= height - bottom + 0.5, (selector, rect, insets)

        return rect

    def header_controls(*selectors):
        boxes = [check(selector, True) for selector in selectors]
        for a, b in combinations(boxes, 2):
            overlap_x = min(a["x"] + a["width"], b["x"] + b["width"]) - max(a["x"], b["x"])
            overlap_y = min(a["y"] + a["height"], b["y"] + b["height"]) - max(a["y"], b["y"])
            assert min(overlap_x, overlap_y) <= 1, (selectors, a, b)

    def background(selector):
        return page.locator(selector).evaluate("(el) => getComputedStyle(el).backgroundColor")

    def check_pinned(scroller, *selectors):
        def y(selector):
            return page.locator(selector).evaluate("(el) => el.getBoundingClientRect().y")

        positions = [y(selector) for selector in selectors]
        page.locator(scroller).evaluate("(el) => { el.scrollTop = el.scrollHeight }")
        for selector, before in zip(selectors, positions):
            after = y(selector)
            assert abs(before - after) <= 1, (selector, before, after)

    def check_toast(header, selector="#toast"):
        toast = page.locator(selector)
        page.wait_for_function("""selector => {
            const el = document.querySelector(selector);
            return el.textContent.trim() && el.getClientRects().length && getComputedStyle(el).opacity >= 0.95;
        }""", arg=selector)
        rect = check(selector, True)
        assert rect["width"] > 0 and rect["height"] > 0
        header_rect = page.locator(header).bounding_box()
        assert rect["y"] >= header_rect["y"] + header_rect["height"] - 1, (header, rect, header_rect)
        assert toast.evaluate("(el) => el.scrollWidth <= el.clientWidth + 1")
        assert toast.evaluate("(el) => getComputedStyle(el).pointerEvents") == "none"
        # Temporarily include the toast in hit testing to detect an opaque sheet
        # or minigame painted over it, even if the CSS box is marked visible.
        assert toast.evaluate("""el => {
            const rect = el.getBoundingClientRect();
            const oldStyle = el.style.pointerEvents;
            el.style.setProperty('pointer-events', 'auto', 'important');
            const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            el.style.pointerEvents = oldStyle;
            return el.contains(hit);
        }""")
        return rect

    page.goto(base + "/", wait_until="domcontentloaded")
    check(".beta-brand img", True)
    check_home_menu(page, False)
    check_pinned(".beta-scroll", ".beta-brand")
    check(".beta-actions button:last-child", True)

    for room in ["shop", "vault", "storage", "opening"]:
        page.goto(f"{base}/banksia-exchange.html?page={room}", wait_until="domcontentloaded")
        page.locator(f'body[data-screen="{room}"]').wait_for(state="attached")
        header_controls(".exchange header h1", "#wallet", ".exchange .city-close")
        expected_icon, expected_balance = (
            ("dosh", "12,345,678 Dosh") if room == "shop" else ("crateVoucher", "10 crate vouchers")
        )
        chip = page.locator("#wallet .currency")
        chip.locator(f'[data-icon="{expected_icon}"]').wait_for(state="visible")
        assert chip.get_attribute("aria-label") == expected_balance, room
        assert chip.inner_text().strip(), room
        if room != "shop":
            check("#pageNav button", True)
            assert background(".exchange header") == background("#pageNav"), room
            for button in page.locator("#pageNav button").all():
                assert button.is_visible()
                box = button.bounding_box()
                assert box["y"] + box["height"] <= height - bottom + 1, box
            check_pinned("#screen", ".exchange header", "#pageNav")
        if room == "shop":
            offers = page.locator("[data-offer]")
            check_shop_offers(page)
            assert page.locator("#screen").evaluate("(el) => el.scrollHeight > el.clientHeight")
            # Resize the already-open shop, including a height below the offers.
            for current_height in (height, max(300, height // 2), height):
                page.set_viewport_size({"width": width, "height": current_height})
                frame = page.locator(".exchange")
                rect = frame.bounding_box()
                assert abs(rect["y"] + rect["height"] - current_height) <= 1, rect
                assert frame.evaluate("(el) => getComputedStyle(el).borderBottomWidth") == "4px"
                page.locator("#screen").evaluate("(el) => { el.scrollTop = el.scrollHeight }")
                last = offers.last.bounding_box()
                assert last["y"] + last["height"] <= current_height - bottom + 1, last
                check(".exchange header h1")
            scroller = page.locator("#screen")
            before = scroller.evaluate("el => el.scrollTop")
            assert before > 0
            offers.last.tap()
            page.locator("#roomNotice").filter(has_text="Rewards added to your city.").wait_for()
            assert offers.last.is_disabled()
            notice = check_toast(".exchange > header", "#roomNotice")
            head = page.locator(".exchange > header").bounding_box()
            assert notice["y"] <= head["y"] + head["height"] + 16, (head, notice)
            assert abs(scroller.evaluate("el => el.scrollTop") - before) <= 1
        if room == "opening":
            page.get_by_role("button", name="Drop odds").tap()
            check("#modalRoot .dialog", True)
        assert page.locator('script[src*="building-renderer"]').count() == 0, room

    page.goto(base + "/?demo=full-city", wait_until="domcontentloaded")
    page.locator("body.city-ready").wait_for(state="attached")
    if page.evaluate("JSON.parse(localStorage.getItem('bit-burbs-full-test-city-v1'))?.bagPopupPending"):
        later = page.locator("#modal.show #bagLater")
        later.wait_for()
        check_home_menu(page, False)
        later.tap()
    check("#hud .cname")
    check("#hud #cpmLbl")
    assert page.locator("#hud #popLbl, #hud #jobsLbl").count() == 0
    check_home_menu(page, True)
    page.locator("#clock").tap()
    notice = check_toast("#hud")
    assert "Daylight" in page.locator("#toast").inner_text()
    advisor = check("#advisor", True)
    map_tools = check("#mapctl")
    assert 0 <= notice["x"] - (advisor["x"] + advisor["width"]) <= 24, (advisor, notice)
    assert notice["y"] < advisor["y"] + advisor["height"] and notice["y"] + notice["height"] > advisor["y"], (advisor, notice)
    assert notice["x"] + notice["width"] <= map_tools["x"] + 1, (map_tools, notice)
    wallets = {
        "Build": ["cash", "deed"],
        "Tasks": ["crateVoucher", "dosh"],
        "Item bag": [],
        "Settings": ["cash", "dosh"],
        "Delivery depot": ["cash", "dosh", "voucher"],
    }
    for menu in [*wallets, "Wheel"]:
        if menu == "Delivery depot":
            # Open via the same depot control when the fixture has empty shelves.
            if not page.locator("#rsAll").is_enabled():
                continue
            page.locator("#rsAll").tap()
        else:
            page.get_by_role("button", name=menu, exact=True).tap()
        check_home_menu(page, False)
        if menu == "Wheel":
            header_controls("#mgPanel .mgtitle", "#mgPanel .mg-wallet", "#mgPanel .mgx")
            assert page.locator("#mgPanel .mg-wallet [data-icon=ticket]").count() == 1
            assert page.locator("#tixN").inner_text().strip()
            check_pinned("#mgPanel .wheel-content", "#mgPanel .mg-screen-head", "#mgPanel .mg-page-foot")
            page.locator("#mgPanel .mgx").tap()
        else:
            close = '#sheet [data-act="closeSheet"]'
            if wallets[menu]:
                header_controls("#sheetTitle", "#sheetWallet", close)
            else:
                header_controls("#sheetTitle", close)
                assert page.locator("#sheetWallet").is_hidden()
                assert page.locator("#sheetWallet > *").count() == 0
            icons = page.locator("#sheetWallet [data-icon]").evaluate_all("(els) => els.map(el => el.dataset.icon)")
            assert icons == wallets[menu], (menu, icons)
            for chip in page.locator("#sheetWallet .page-balance").all():
                assert int(chip.get_attribute("data-amount")) >= 0 and chip.inner_text().strip()
            if menu == "Build":
                tabs = page.locator('#sheet [data-act="tab"]')
                for tab in tabs.all():
                    tab.tap()
                    assert tab.get_attribute("aria-pressed") == "true"
                    check_home_menu(page, False)
            if menu == "Tasks":
                page.get_by_role("button", name="Claim login reward").tap()
                check_toast("#sheet .shead")
                assert "voucher" in page.locator("#toast").inner_text().lower()
                schedule = page.locator('#sheet details[data-login-schedule]')
                schedule.locator("summary").tap()
                assert schedule.evaluate("(el) => el.open")
                check_home_menu(page, False)
            sheet = check("#sheet")
            assert abs(sheet["y"] + sheet["height"] - height) <= 1, (menu, sheet)
            check_pinned("#sheetBody", "#sheet .shead")
            last = page.locator("#sheetBody > :visible").last.bounding_box()
            assert last["y"] + last["height"] <= height - bottom + 1, (menu, last)
            if menu == "Item bag":
                cards = page.locator(".bag-supplies > .bag-card")
                assert cards.count() == 2
                city = page.evaluate("JSON.parse(localStorage.getItem('bit-burbs-full-test-city-v1'))")
                expected = [("boost", city.get("coinBoostTokens", {}).get("10", 0)),
                            ("voucher", city.get("restockVouchers", 0))]
                for card, (icon, count) in zip(cards.all(), expected):
                    assert card.locator(f'canvas[data-icon="{icon}"]').is_visible()
                    assert card.locator("small").inner_text() == f"Owned · {count}"
                boost, voucher = [card.bounding_box() for card in cards.all()]
                assert abs(boost["width"] - voucher["width"]) <= 1
                assert abs(boost["height"] - voucher["height"]) <= 1
                assert boost["y"] == voucher["y"] and boost["x"] < voucher["x"]
                assert cards.first.evaluate("(el) => getComputedStyle(el).backgroundColor") == "rgb(169, 220, 255)"
                assert page.locator("#sheetBody h3").all_text_contents() == ["Stored buildings"]
            page.locator('#sheet [data-act="closeSheet"]').tap()
        check_home_menu(page, True)

    for menu in ["Crates", "Dosh Shop"]:
        page.get_by_role("button", name=menu, exact=True).tap()
        check_home_menu(page, False)
        if menu == "Dosh Shop":
            page.locator('#mgPanel [data-act="buyDaily"][data-id="wheel"]').tap()
            check_toast("#mgPanel .mg-screen-head")
            assert "wheel spin" in page.locator("#toast").inner_text().lower()
        page.locator("#mgPanel .mgx").tap()
        check_home_menu(page, True)


def check_single_taps(page, session, base):
    # Reuse the CI city's snapshot in the normal sign-in and city routes. Every
    # account response below is intercepted locally, including the save on exit.
    city = page.evaluate("JSON.parse(localStorage.getItem('bit-burbs-full-test-city-v1'))")
    assert city and city['v'] == 2
    city.update(stars=600, crateVouchers=10, crates={}, crateConversion={'version': 1})
    # Give the existing bakery a known City Advisor entry, regardless of stock.
    tiles = city['tiles']
    side = isqrt(len(tiles))
    bakery = next(i for i, tile in enumerate(tiles) if tile and tile['id'] == 'bakery')
    col, row = bakery % side, bakery // side
    for y in range(max(0, row - 3), min(side, row + 5)):
        for x in range(max(0, col - 3), min(side, col + 5)):
            i = y * side + x
            if tiles[i] and tiles[i]['id'] == 'road':
                tiles[i] = None
    requests = []

    def account(route):
        if route.request.method == 'OPTIONS':
            route.fulfill(status=204, headers={
                'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST',
                'access-control-allow-headers': 'Content-Type',
            })
            return
        action = route.request.post_data_json['action']
        requests.append(action)
        data = {'name': 'fixture', 'progress': 'fixture', 'revision': '1'}
        if action == 'username':
            data.update(city=city, code='fixture-code', crateExchange={
                'stock': [3, 0, 0, 0, 0], 'revision': 2, 'opening': None,
            })
        route.fulfill(json=data, headers={'access-control-allow-origin': '*'})

    page.route('**/api/live-city', account)
    # A migrated, signed-in city can show its building-storage or welcome
    # notice at startup. Acknowledge the same buttons a player would tap.
    def acknowledge(notice_button):
        print('Acknowledged city notice:', page.locator('#modalBox h2').inner_text(), flush=True)
        check_home_menu(page, False)
        notice_button.tap()

    page.add_locator_handler(page.locator('#modal.show #bagLater'), acknowledge)
    page.add_locator_handler(page.locator('#modal.show #modalOk'), acknowledge)
    page.goto(base + '/', wait_until='domcontentloaded')
    page.locator('#betaUsername').fill('fixture')
    page.get_by_role('button', name='Log in', exact=True).tap()
    has_city = "level => document.querySelector('#lvlNum')?.textContent === String(level)"
    page.wait_for_function(has_city, arg=city['level'])
    assert requests.count('username') == 1, requests

    # Count final composites on the actual city canvas. This measures render
    # work independently of the runner's frame rate or screenshot timing.
    page.evaluate('''() => {
        const ctx = document.querySelector('#game').getContext('2d');
        const draw = ctx.drawImage;
        window.cityPaints = 0;
        ctx.drawImage = function (...args) { ++window.cityPaints; return draw.apply(this, args); };
    }''')
    page.wait_for_function('window.cityPaints > 0')

    def check_city_covered():
        draws = page.evaluate('''async () => {
            const before = window.cityPaints;
            for (let frame = 0; frame < 6; frame++) await new Promise(requestAnimationFrame);
            return window.cityPaints - before;
        }''')
        assert draws == 0, f'{draws} city composites behind an opaque menu'

    page.get_by_role('button', name='Settings', exact=True).tap()
    toggle = page.get_by_role('button', name='Game sounds', exact=True)
    before = toggle.get_attribute('aria-pressed')
    assert before in ('true', 'false')
    toggle.tap()
    assert toggle.get_attribute('aria-pressed') == ('false' if before == 'true' else 'true')
    check_city_covered()
    page.get_by_role('button', name='Change username', exact=True).tap()
    page.locator('dialog[open] [name="nextName"]').wait_for()
    check_home_menu(page, False)
    page.locator('dialog[open] [data-cancel]').tap()
    check_home_menu(page, False)
    page.locator('#sheet [data-act="closeSheet"]').tap()
    check_home_menu(page, True)
    page.get_by_role('button', name='Wheel', exact=True).tap()
    page.locator('#mgPanel .wodds summary').tap()
    assert page.locator('#mgPanel .wodds').evaluate('(el) => el.open')
    check_city_covered()
    count = page.evaluate('window.cityPaints')
    page.locator('#mgPanel .mgx').tap()
    page.wait_for_function('(n) => window.cityPaints > n', arg=count)

    page.locator('#advisor').tap()
    assert page.locator('#card .city-overview dt').all_text_contents() == [
        'Residents', 'Working', 'Unemployed', 'Open jobs', 'Free home spaces'
    ]
    check_home_menu(page, False)
    page.locator(f'#card button[data-i="{col}"][data-j="{row}"]').tap()
    manage = page.locator('#card [data-act="manageProperty"]')
    manage.scroll_into_view_if_needed()
    box = manage.bounding_box()
    point = {'x': box['x'] + box['width'] / 2, 'y': box['y'] + box['height'] / 2}
    session.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [point]})
    # Holding across a business timer update used to replace the pressed node.
    page.wait_for_timeout(1300)
    session.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    page.locator('#card [data-act="manageBack"]').wait_for(state='visible')
    check_home_menu(page, False)
    page.locator('#card [data-act="closeCard"]').tap()
    check_home_menu(page, True)
    page.get_by_role('button', name='Build', exact=True).tap()
    page.locator('#sheetBody [data-act="choose"][data-id="house"]').tap()
    page.locator('#card [data-act="cancelPlace"]').wait_for()
    check_home_menu(page, False)
    page.locator('#card [data-act="cancelPlace"]').tap()
    check_home_menu(page, True)

    # The renderer swap must keep the original map alive. Both the first tap
    # and a reopen must work without downloading another page or reading an account.
    page.evaluate("window.preExchangeCanvas = document.querySelector('#game')")
    room_downloads = []

    def record_request(request):
        if request.url.startswith(('http:', 'https:')) and (
            request.resource_type == 'document' or request.frame.parent_frame
        ):
            room_downloads.append(request.url)

    page.on('request', record_request)
    for attempt in range(2):
        for dock, room in [('Crates', 'vault'), ('Dosh Shop', 'shop')]:
            page.get_by_role('button', name=dock, exact=True).tap()
            # Each dock button must work with a single real touch.
            panel = page.frame_locator('.city-exchange-room[open] iframe')
            panel.locator(f'body[data-screen="{room}"] #wallet .currency').wait_for(state='visible')
            check_home_menu(page, False)
            if room == 'vault':
                purchase = panel.locator('[data-action="buy-crate"]')
                assert purchase.is_enabled()
                panel.locator('#pageNav [data-page="storage"]').tap()
                silver = panel.get_by_role('button', name='Select Silver crate, 3 stored')
                assert silver.is_enabled()
                check_home_menu(page, False)
                silver.tap()
                panel.get_by_role('button', name='Drop odds').tap()
                odds = panel.locator('#modalRoot [role="dialog"]')
                odds.wait_for()
                check_home_menu(page, False)
                odds.get_by_role('button', name='Close', exact=True).tap()
            else:
                assert panel.locator('[data-offer]').count() == 4
                assert panel.locator('[data-offer]').first.is_enabled()
                check_shop_offers(panel)
            check_city_covered()
            if attempt == 1 and room == 'shop':
                page.evaluate('history.back()')
            else:
                panel.locator('.city-close').tap()
            page.locator('.city-exchange-room[open]').wait_for(state='hidden')
            page.wait_for_function('!history.state?.bitBurbsRoom')
            check_home_menu(page, True)
            assert page.evaluate("window.preExchangeCanvas === document.querySelector('#game')")
            assert page.url == base + '/'
    assert not room_downloads, room_downloads
    assert all(action not in ('releaseShop', 'releaseExchange') for action in requests), requests
    page.remove_listener('request', record_request)

    # Direct links can still lazily load a building model when storage contains one.
    page.goto(base + '/banksia-exchange.html?page=storage&city=fixture', wait_until='domcontentloaded')
    page.wait_for_function("""() => {
        const sprite = document.querySelector('canvas[data-model="statue"]');
        if (!sprite || !window.BBModels) return false;
        const rgba = sprite.getContext('2d').getImageData(0, 0, sprite.width, sprite.height).data;
        return rgba.some((v, i) => i % 4 === 3 && v > 0);
    }""")
    assert page.locator('script[src*="building-renderer"]').count() == 1
    print('Passed single-touch city, account, shop and crate interactions', flush=True)


def check_local_reset_labels(browser, base):
    # New York switches to daylight saving at 07:00 UTC on this date. Both
    # resets still fall on the previous local calendar day in Honolulu.
    for zone, login_time, shop_time in [
        ("America/New_York", "4:00 am", "4:15 am"),
        ("Pacific/Honolulu", "10:00 pm", "10:15 pm"),
    ]:
        context = browser.new_context(timezone_id=zone, locale="en-US", service_workers="block")
        page = context.new_page()
        page.set_default_timeout(10000)
        page.clock.set_fixed_time("2026-03-08T06:30:00Z")
        page.route("https://**/*", lambda route: route.abort())
        page.route("**/release-account.js*", lambda route: route.fulfill(content_type="text/javascript", body="""
            window.liveCityRelease = async () => Response.json({
                resetAt: Date.parse('2026-03-08T08:15:00Z'), dosh: 5, claims: [],
                offers: [{id: 'fixture', price: 0, rewards: {cash: 1000}}], day: 1
            });
        """))

        def check_time(selector, expected):
            label = " ".join(page.locator(selector).inner_text().lower().split())
            assert expected in label, (zone, expected, label)

        page.goto(base + "/banksia-exchange.html?page=shop", wait_until="domcontentloaded")
        page.locator("[data-offer]").wait_for()
        check_time(".shop-reset", shop_time)
        page.goto(base + "/?demo=full-city", wait_until="domcontentloaded")
        page.add_locator_handler(page.locator("#modal.show #bagLater"), lambda button: button.click())
        page.get_by_role("button", name="Tasks", exact=True).click()
        check_time("#sheet .daily-head small", "6:00 pm")
        assert page.locator("#sheet .daily-task-card").count() == 10
        page.get_by_role("button", name="Claim login reward").click()
        check_time("#sheet .sect p:last-of-type", login_time)
        context.close()


def main():
    root = Path(__file__).resolve().parents[1]
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(root))) as server, sync_playwright() as pw:
        Thread(target=server.serve_forever, daemon=True).start()
        browser = pw.chromium.launch(executable_path=which("google-chrome") or which("chromium"))
        check_placement(browser, f"http://127.0.0.1:{server.server_port}")
        context = browser.new_context(is_mobile=True, has_touch=True, service_workers="block")
        page = context.new_page()
        page.add_init_script("if (location.search === '?demo=full-city') localStorage.clear()")
        page.set_default_timeout(10000)
        page.route("https://**/*", lambda route: route.abort())
        # Stub the account adapter locally. No player credentials or network calls.
        page.route("**/release-account.js*", lambda route: route.fulfill(content_type="text/javascript", body="""
            window.liveCityRelease = async (action, payload) => Response.json(action === 'releaseShop'
              ? {day: 1, resetAt: Date.now() + 86400000, dosh: 12345678 - Number(payload?.offer || 0),
                 claims: payload ? [payload.offer] : [], offers: Array.from({length: 4}, (_, i) =>
                   ({id: String(i), price: i, rewards: i % 2 ? {cash: 3000, restockVouchers: 2} : {cash: 2000}}))}
              : {name: 'fixture', accountRef: 'fixture', wallet: {crateVouchers: 10, dosh: 50},
                 stock: [3,0,0,0,0], listings: [], sales: [], visible: [],
                 assets: new URLSearchParams(location.search).has('city')
                     ? [{id:'fixture-copy', owner:'you', model:'statue', state:'inventory'}] : []});
        """))
        session = context.new_cdp_session(page)
        for width, height, top, side, bottom in [
            (428, 926, 47, 0, 34), (393, 852, 59, 0, 34),
            (852, 393, 0, 59, 21), (390, 844, 0, 0, 0), (320, 568, 20, 0, 0)
        ]:
            page.set_viewport_size({"width": width, "height": height})
            session.send("Emulation.setSafeAreaInsetsOverride", {"insets": {
                "top": top, "left": side, "right": side, "bottom": bottom}})
            check_layout(page, f"http://127.0.0.1:{server.server_port}",
                         (width, height), (top, side, bottom))
            print(f"Passed {width} × {height} with top inset {top}", flush=True)
        page.set_viewport_size({"width": 390, "height": 844})
        check_single_taps(page, session, f"http://127.0.0.1:{server.server_port}")
        context.close()
        check_local_reset_labels(browser, f"http://127.0.0.1:{server.server_port}")
        browser.close()


if __name__ == "__main__":
    main()
