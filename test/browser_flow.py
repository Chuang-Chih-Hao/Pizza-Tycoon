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

        def operate(action):
            command(action).click()
            key = action.split(":")[0]
            if key in ["pickup","place","addkit","serve","drop"]:
                return
            canvas = page.locator("#gesture")
            canvas.wait_for()
            key = action.split(":")[0]
            if key in ["flour","kit"]:
                seed=(order["id"]*7+order["flavor"]*3+order["kits"]) % 997
                if key=="flour":
                    canvas.focus()
                    target=75+seed%5*10
                    page.keyboard.down("Space")
                    page.wait_for_function("n=> +document.querySelector('#gesture').dataset.reading >= n",arg=target-3,polling="raf")
                    page.keyboard.up("Space")
                else:
                    for i in [seed%3,(seed+1+(seed//3)%2)%3]:
                        canvas.press(str(i+1))
                canvas.wait_for(state="hidden")
                return
            options = {"angle": angle, "rotation": order["rotation"]}
            points = page.evaluate("""async ([key, options]) => {
                const {gesturePath} = await import('/gestures.js')
                return gesturePath(key, options)
            }""", [key, options])
            bounds = canvas.bounding_box()
            def move(point):
                page.mouse.move(bounds["x"] + bounds["width"] * point[0],
                                bounds["y"] + bounds["height"] * point[1], steps=6)
            move(points[0])
            page.mouse.down()
            for stroke,point in enumerate(points[1:],1):
                move(point)
                if key=="knead" and stroke==4:
                    page.locator("#gesturestep",has_text="4 / 9").wait_for()
                    page.mouse.up()
                    assert canvas.is_visible()
                    screenshot("kneading.webp")
                    page.mouse.down()
            page.mouse.up()
            canvas.wait_for(state="hidden")

        def work(action):
            if page.locator("#dialog").is_visible():
                page.locator("#close").click()
            page.locator("#go").click()
            operate(action)

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

        page.locator("#mission",has_text="拿取麵粉").wait_for()
        work("flour")
        work("place")
        page.locator("#radius").fill(str(order["r"]))
        operate("knead")
        work("kit")
        work("addkit")
        work("pickup")
        work("place")
        operate(f'top:{order["flavor"]}')
        work("pickup")
        work("bake")
        operate("unbake")
        work("place")
        command("ans:圓心").click()
        page.locator("#degrees").fill(str(angle-15))
        command("cut").click()
        page.locator("#cutreview",has_text="順時針轉 15°").wait_for()
        screenshot("cutting.webp")
        page.locator("#degrees").fill(str(angle+10))
        page.locator("#cutreview",has_text="逆時針轉 10°").wait_for()
        page.locator("#degrees").fill(str(angle))
        page.locator("#cutreview",has_text="刀線已對準").wait_for()
        operate("cut")
        operate("pickup")
        work("box")
        operate("pickup")
        work("serve")
        page.wait_for_function("Number(document.querySelector('#sales').textContent.slice(1)) > 0")
        page.locator('.guest-bubble[data-mood="paid"]').wait_for()

        for skin, name in enumerate(["阿栗", "小沐", "悠悠"], start=2):
            chef = connect_room()
            send(chef, "join", code=code, name=name, skin=skin)
            receive_until(chef, lambda m: m["type"] == "session")

        send(teacher, "gold")
        page.get_by_role("button", name="黃金拼盤", exact=False).first.wait_for()
        screenshot("kitchen.webp")
        for width, height in [(1366, 768), (390, 844), (844, 390)]:
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(300)
            layout = page.evaluate("""() => {
                const rect = document.querySelector('.lower').getBoundingClientRect()
                const canvas = document.querySelector('#gameScene canvas').getBoundingClientRect()
                return [scrollY, rect.bottom, innerHeight, canvas.width, canvas.height, document.documentElement.scrollWidth, innerWidth]
            }""")
            assert layout[0] == 0 and layout[1] <= layout[2] + 1, layout
            assert layout[3] > 100 and layout[4] > 80 and layout[5] <= layout[6] + 1, layout
            page.locator('#sound').click()
            page.locator('#close').click()
            assert page.evaluate("scrollY") == 0
        page.set_viewport_size({"width": 1160, "height": 790})
        send(teacher, "event", value="leak")
        page.locator('.field[data-event="leak"]').wait_for()
        page.wait_for_timeout(500)
        screenshot("rescue.webp")
        send(teacher, "end")
        page.get_by_role("heading", name="本店營業成果").wait_for()
        page.locator('#modal [data-cmd="practice"]').click()
        page.get_by_role("heading",name="打烊練刀").wait_for()
        target = page.locator('#modal p strong').inner_text().split()[0]
        a, b = map(int, target.split("/"))
        page.locator("#practiceangle").fill("1")
        page.locator("#practicecheck").click()
        assert "順時針" in page.locator("#practicefeedback").inner_text()
        page.locator("#practiceangle").fill(str(360*a//b))
        page.locator("#practicecheck").click()
        page.get_by_role("button",name="下一片").click()
        page.locator(".dialoghelp").click()
        page.get_by_role("heading",name="操作說明").wait_for()
        page.keyboard.press("Escape")
        assert page.locator("#practiceangle").is_visible()
        send(teacher, "reopen")
        page.locator("#ready").wait_for()
        assert page.locator("#roomcode").inner_text()==code
        page.locator("#lastreport").click()
        page.get_by_role("heading",name="上一輪營業成果").wait_for()
        send(teacher, "start")
        page.locator("#go").wait_for()
        assert not page.locator("#dialog").is_visible()
        page.keyboard.press("?")
        page.locator("#guideclose").click()
        send(teacher, "end")
        assert not errors, errors
        print("Passed: cooking, cutting, payment, four chefs, golden order and results.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:3000")
    parser.add_argument("--screenshots", type=Path)
    args = parser.parse_args()
    run(args.url.rstrip("/"), args.screenshots)
