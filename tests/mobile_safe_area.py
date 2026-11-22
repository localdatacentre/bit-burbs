"""Check live game page geometry with a simulated status bar and cutouts."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from shutil import which
from threading import Thread

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


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

    def header_controls(title, wallet, close):
        title_box, wallet_box, close_box = [check(selector, True) for selector in (title, wallet, close)]
        for a, b in [(title_box, wallet_box), (title_box, close_box), (wallet_box, close_box)]:
            overlap_x = min(a["x"] + a["width"], b["x"] + b["width"]) - max(a["x"], b["x"])
            overlap_y = min(a["y"] + a["height"], b["y"] + b["height"]) - max(a["y"], b["y"])
            assert min(overlap_x, overlap_y) <= 1, (title, wallet, close, a, b)

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

    page.goto(base + "/", wait_until="domcontentloaded")
    check(".beta-brand img", True)
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
            offers.first.wait_for()
            cards = page.locator(".shop-menu article")
            first, second = [cards.nth(i).bounding_box() for i in range(2)]
            assert first["width"] >= 280 and abs(first["width"] - first["height"]) <= 1, first
            assert second["y"] >= first["y"] + first["height"], second
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
        if room == "opening":
            page.get_by_role("button", name="Drop odds").click()
            check("#modalRoot .dialog", True)

    page.goto(base + "/?demo=full-city", wait_until="domcontentloaded")
    check("#hud .cname")
    wallets = {
        "Build": ["cash", "deed"],
        "Tasks": ["crateVoucher", "dosh"],
        "Item bag": ["boost", "voucher"],
        "Settings": ["cash", "dosh"],
        "Delivery depot": ["cash", "dosh", "voucher"],
    }
    for menu in [*wallets, "Wheel"]:
        if menu == "Delivery depot":
            # Open via the same depot control when the fixture has empty shelves.
            if not page.locator("#rsAll").is_enabled():
                continue
            page.locator("#rsAll").click()
        else:
            page.get_by_role("button", name=menu, exact=True).click()
        if menu == "Wheel":
            header_controls("#mgPanel .mgtitle", "#mgPanel .mg-wallet", "#mgPanel .mgx")
            assert page.locator("#mgPanel .mg-wallet [data-icon=ticket]").count() == 1
            assert page.locator("#tixN").inner_text().strip()
            check_pinned("#mgPanel .wheel-content", "#mgPanel .mg-screen-head", "#mgPanel .mg-page-foot")
        else:
            header_controls("#sheetTitle", "#sheetWallet", '#sheet [data-act="closeSheet"]')
            icons = page.locator("#sheetWallet [data-icon]").evaluate_all("(els) => els.map(el => el.dataset.icon)")
            assert icons == wallets[menu], (menu, icons)
            for chip in page.locator("#sheetWallet .page-balance").all():
                assert int(chip.get_attribute("data-amount")) >= 0 and chip.inner_text().strip()
            assert background("#sheet .shead") == background("#nav"), menu
            check_pinned("#sheetBody", "#sheet .shead", "#nav")
            if menu == "Item bag":
                cards = page.locator(".bag-supplies > .bag-card")
                assert cards.count() == 2
                boost, voucher = [card.bounding_box() for card in cards.all()]
                assert abs(boost["width"] - voucher["width"]) <= 1
                assert abs(boost["height"] - voucher["height"]) <= 1
                assert boost["y"] == voucher["y"] and boost["x"] < voucher["x"]
                assert cards.first.evaluate("(el) => getComputedStyle(el).backgroundColor") == "rgb(169, 220, 255)"
                assert page.locator("#sheetBody h3").all_text_contents() == ["Stored buildings"]
            page.locator('#sheet [data-act="closeSheet"]').click()


def main():
    root = Path(__file__).resolve().parents[1]
    with ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(root))) as server, sync_playwright() as pw:
        Thread(target=server.serve_forever, daemon=True).start()
        browser = pw.chromium.launch(executable_path=which("google-chrome") or which("chromium"))
        context = browser.new_context(is_mobile=True, has_touch=True, service_workers="block")
        page = context.new_page()
        page.add_init_script("if (location.search === '?demo=full-city') localStorage.clear()")
        page.set_default_timeout(10000)
        page.route("https://**/*", lambda route: route.abort())
        # Stub the account adapter locally. No player credentials or network calls.
        page.route("**/release-account.js*", lambda route: route.fulfill(content_type="text/javascript", body="""
            window.liveCityRelease = async action => Response.json(action === 'releaseShop'
              ? {day: 1, resetAt: Date.now() + 86400000, dosh: 12345678, claims: [], offers: Array.from({length: 4}, (_, i) =>
                   ({id: String(i), price: i, rewards: i % 2 ? {cash: 3000, restockVouchers: 2} : {cash: 2000}}))}
              : {name: 'fixture', accountRef: 'fixture', wallet: {crateVouchers: 10, dosh: 50},
                 stock: [3,0,0,0,0], assets: [], listings: [], sales: [], visible: []});
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
        browser.close()


if __name__ == "__main__":
    main()
