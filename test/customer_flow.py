"""Observe a customer's complete wait and unpaid departure in a disposable four-chef room."""
import argparse
import os
from contextlib import ExitStack
from pathlib import Path

from playwright.sync_api import sync_playwright
from websockets.sync.client import connect
from browser_flow import send, receive_until


def run(url, screenshot):
    address = url.replace("https://", "wss://").replace("http://", "ws://") + "/play"
    with ExitStack() as stack:
        def connection():
            return stack.enter_context(connect(address, max_queue=None, ping_interval=None))

        def wait_state(socket, predicate):
            return receive_until(socket, lambda m: m["type"] == "state" and predicate(m["state"]))["state"]

        pw = stack.enter_context(sync_playwright())
        proxy = os.environ.get("PIZZA_BROWSER_PROXY")
        browser = pw.chromium.launch(
            executable_path=os.environ.get("PIZZA_BROWSER"),
            proxy={"server": proxy} if proxy else None,
            args=["--no-zygote", "--enable-unsafe-swiftshader", "--use-gl=angle",
                  "--use-angle=swiftshader", "--disable-dev-shm-usage"],
        )
        stack.callback(browser.close)
        page = browser.new_page(viewport={"width": 1024, "height": 720})
        page.set_default_timeout(65000)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.add_init_script("localStorage.setItem('pizza-low','1')")
        page.goto(url)
        host = connection()
        send(host, "create")
        code = receive_until(host, lambda m: m["type"] == "session")["code"]
        for i in range(3):
            chef = connection()
            send(chef, "join", code=code, name=f"隊友{i+1}", skin=i)
            receive_until(chef, lambda m: m["type"] == "session")

        page.locator("#student").click()
        page.locator("#joincode").fill(code)
        page.locator("#nickname").fill("櫃檯學徒")
        page.get_by_role("button", name="進入廚房").click()
        page.locator("#ready").click()
        send(host, "settings", value={"events":False})
        send(host, "start")
        try:
            initial = wait_state(host, lambda s: s["status"] == "playing")
            first, other = initial["orders"][:2]
            ticket = page.locator(f'.ticket[data-order="{first["id"]}"]')
            other_ticket = page.locator(f'.ticket[data-order="{other["id"]}"]')
            other_ticket.click()
            page.locator(f'.guest-bubble[data-order="{other["id"]}"][data-mood="eager"]').wait_for()
            ticket.click()
            bubble = page.locator(f'.guest-bubble[data-order="{first["id"]}"]')
            bubble.wait_for()
            page.set_viewport_size({"width":390,"height":844})
            page.wait_for_timeout(350)
            bounds = bubble.bounding_box()
            assert bounds["x"] >= 0 and bounds["x"]+bounds["width"] <= 391
            assert page.evaluate("scrollY") == 0
            page.set_viewport_size({"width":1024,"height":720})
            deadline = (first["patience"] + 40) * 1000
            timer = ticket.locator(".guest-clock")
            for mood in ["waiting", "lastCall"]:
                page.locator(f'[data-clock="{first["id"]}"][data-mood="{mood}"]').wait_for(timeout=deadline)
                ticket.click()
                page.locator(f'.guest-bubble[data-order="{first["id"]}"][data-mood="{mood}"]').wait_for()
                assert timer.text_content()
                if mood=="lastCall" and screenshot:
                    page.screenshot(path=str(screenshot), type="webp", quality=84)
            page.locator(f'.guest-bubble[data-order="{first["id"]}"][data-mood="left"]').wait_for(timeout=deadline)
            ticket.wait_for(state="detached")
            left = wait_state(host, lambda s: s["walkedAway"] >= 1)
            assert left["money"] == left["revenue"] == left["delivered"] == 0
            assert any(o["id"] == other["id"] for o in left["orders"])
            assert not errors, errors
            print("Passed four chefs, order selection, mobile bubble, waiting, last call, departure and zero payment.")
        finally:
            send(host,"end")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:3000")
    parser.add_argument("--screenshot", type=Path)
    args = parser.parse_args()
    run(args.url.rstrip("/"), args.screenshot)
