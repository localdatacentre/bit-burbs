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

    for room in ["shop", "vault", "storage", "opening"]:
        page.goto(f"{base}/banksia-exchange.html?page={room}", wait_until="domcontentloaded")
        page.locator(f'body[data-screen="{room}"]').wait_for(state="attached")
        check(".exchange header h1")
        check(".exchange .city-close", True)
        check("#wallet", True)
        if room == "shop":
            offers = page.locator("[data-offer]")
            offers.first.wait_for()
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
    for menu in ["Build", "Tasks", "Item bag", "Settings", "Wheel"]:
        page.get_by_role("button", name=menu, exact=True).click()
        if menu == "Wheel":
            check("#mgPanel .mg-screen-head")
            check("#mgPanel .mgx", True)
            page.locator("#mgPanel").evaluate("(el) => { el.scrollTop = el.scrollHeight }")
            check("#mgPanel")
        else:
            check("#sheet .shead")
            check('#sheet [data-act="closeSheet"]', True)
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
              ? {day: 1, resetAt: Date.now() + 86400000, dosh: 50, claims: [], offers: Array.from({length: 4}, (_, i) =>
                   ({id: String(i), price: i, rewards: {cash: 10}}))}
              : {name: 'fixture', accountRef: 'fixture', wallet: {crateVouchers: 10, dosh: 50},
                 stock: [3,0,0,0,0], assets: [], listings: [], sales: [], visible: []});
        """))
        session = context.new_cdp_session(page)
        for width, height, top, side, bottom in [
            (428, 926, 47, 0, 34), (393, 852, 59, 0, 34),
            (852, 393, 0, 59, 21), (390, 844, 0, 0, 0)
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
