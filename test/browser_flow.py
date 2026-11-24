"""Run a complete order in a disposable Golden Slice classroom."""

import argparse
import json
import os
import uuid
from contextlib import ExitStack
from pathlib import Path

from playwright.sync_api import sync_playwright
from websockets.sync.client import connect


def send(connection, operation, **data):
    connection.send(json.dumps({"op": operation, "nonce": str(uuid.uuid4()), **data}))


def receive_until(connection, predicate):
    while True:
        message = json.loads(connection.recv(timeout=45))
        if message["type"] == "error":
            raise AssertionError(message["message"])
        if predicate(message):
            return message


def run(url, output):
    socket_url = url.replace("https://", "wss://").replace("http://", "ws://") + "/play"
    if output:
        output.mkdir(parents=True, exist_ok=True)

    with ExitStack() as stack:
        def connect_room():
            return stack.enter_context(connect(socket_url, max_queue=None, ping_interval=None))

        teacher = connect_room()
        send(teacher, "create")
        code = receive_until(teacher, lambda m: m["type"] == "session")["code"]

        playwright = stack.enter_context(sync_playwright())
        browser = playwright.chromium.launch(
            executable_path=os.environ.get("PIZZA_BROWSER"),
            args=["--no-zygote", "--in-process-gpu", "--enable-unsafe-swiftshader",
                  "--use-gl=angle", "--use-angle=swiftshader", "--disable-dev-shm-usage"],
        )
        stack.callback(browser.close)
        page = browser.new_page(viewport={"width": 1160, "height": 790}, device_scale_factor=1)
        page.set_default_timeout(35000)
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))

        def screenshot(name):
            if output:
                page.screenshot(path=str(output / name), type="webp", quality=84)

        def command(name):
            return page.locator(f'[data-cmd="{name}"]')

        def work(action):
            if page.locator("#dialog").is_visible():
                page.locator("#close").click()
            page.locator("#go").click()
            command(action).click()

        page.goto(url)
        page.wait_for_selector("#heroScene canvas")
        # Measure the upward-facing triangles of the generated crust mesh itself.
        # Major sectors must retain the angular portion beyond a semicircle.
        areas = page.evaluate("""async () => {
          const {pizza} = await import('/models.js');
          const {Vector3} = await import('three');
          function crustArea(deg) {
            const pos = pizza({deg, plain: true}).children[0].geometry.getAttribute('position');
            const a = new Vector3(), b = new Vector3(), c = new Vector3();
            let total = 0;
            for (let i = 0; i < pos.count; i += 3) {
              a.fromBufferAttribute(pos, i);
              b.fromBufferAttribute(pos, i + 1).sub(a);
              c.fromBufferAttribute(pos, i + 2).sub(a);
              const normal = b.cross(c);
              if (normal.y > 0) total += normal.y / 2;
            }
            return total;
          }
          const full = crustArea(360);
          return [60, 90, 180, 240, 270].map(angle => [angle, crustArea(angle) / full]);
        }""")
        for angle_degrees, area_ratio in areas:
            assert abs(area_ratio - angle_degrees / 360) < 0.003, (angle_degrees, area_ratio)
        page.wait_for_timeout(600)
        screenshot("home.webp")
        page.locator("#student").click()
        page.locator("#joincode").fill(code)
        page.locator("#nickname").fill("小禾")
        page.locator('[data-skin="1"]').click()
        page.get_by_role("button", name="進入廚房").click()
        page.locator("#ready").click()

        send(teacher, "settings", value={"events": False, "minutes": 30})
        send(teacher, "start")
        state = receive_until(
            teacher, lambda m: m["type"] == "state" and m["state"]["status"] == "playing"
        )["state"]
        order = state["orders"][0]
        angle = 360 * order["f"][0] // order["f"][1]

        work("flour")
        work("place")
        page.locator("#radius").fill(str(order["r"]))
        for _ in range(3):
            command("knead").click()
        work("kit")
        work("addkit")
        work("pickup")
        work("place")
        command(f'top:{order["flavor"]}').click()
        work("pickup")
        work("bake")
        command("unbake").click()
        work("place")
        command("ans:圓心").click()
        page.locator("#degrees").fill(str(angle))
        screenshot("cutting.webp")
        command("cut").click()
        command("pickup").click()
        work("box")
        command("pickup").click()
        work("serve")
        page.wait_for_function("Number(document.querySelector('#sales').textContent.slice(1)) > 0")

        for skin, name in enumerate(["阿栗", "小沐", "悠悠"], start=2):
            chef = connect_room()
            send(chef, "join", code=code, name=name, skin=skin)
            receive_until(chef, lambda m: m["type"] == "session")

        send(teacher, "gold")
        page.get_by_role("button", name="黃金拼盤", exact=False).first.wait_for()
        screenshot("kitchen.webp")
        send(teacher, "end")
        page.locator("#results").click()
        page.get_by_role("heading", name="本店營業成果").wait_for()
        assert not errors, errors
        print("Passed: cooking, cutting, payment, four chefs, golden order and results.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:3000")
    parser.add_argument("--screenshots", type=Path)
    args = parser.parse_args()
    run(args.url.rstrip("/"), args.screenshots)
