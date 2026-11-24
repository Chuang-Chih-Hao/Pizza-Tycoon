"""Verify live coaching with two browsers and three additional independent classmates."""
import argparse
import math
import os
import time
from contextlib import ExitStack
from pathlib import Path
from playwright.sync_api import sync_playwright
from websockets.sync.client import connect
from browser_flow import send, receive_until


def run(url, output):
    with ExitStack() as stack:
        pw = stack.enter_context(sync_playwright())
        browser = pw.chromium.launch(executable_path=os.environ.get("PIZZA_BROWSER"),
            args=["--no-zygote", "--in-process-gpu", "--enable-unsafe-swiftshader",
                  "--use-gl=angle", "--use-angle=swiftshader", "--disable-dev-shm-usage",
                  "--disable-renderer-backgrounding", "--disable-background-timer-throttling"])
        stack.callback(browser.close)
        teacher = browser.new_page(viewport={"width": 1090,"height": 810})
        student = browser.new_page(viewport={"width": 1080,"height": 760})
        errors = []
        for page in [teacher,student]:
            page.set_default_timeout(65000)
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.add_init_script("localStorage.setItem('pizza-low','1')")
            page.goto(url)
        teacher.locator("#teacher").click()
        teacher.locator('[data-cmd="create"]').click()
        teacher.locator("#roomcode").wait_for()
        code = teacher.locator("#roomcode").inner_text()
        socket_url = url.replace("https://", "wss://").replace("http://", "ws://") + "/play"
        crew = []
        for i in range(3):
            socket = stack.enter_context(connect(socket_url, max_queue=None, ping_interval=None))
            send(socket, "join", code=code, skin=i, name=f"搭檔{i+1}")
            auth = receive_until(socket, lambda m: m["type"] == "session")
            crew.append((socket,auth["id"]))
        student.locator("#student").click()
        student.locator("#joincode").fill(code)
        student.locator("#nickname").fill("刀工學徒")
        student.get_by_role("button", name="進入廚房").click()
        student.locator("#ready").click()
        teacher.locator('[data-cmd="start"]').click()
        student.locator("#go").click()
        student.locator('[data-cmd="ans:圓心"]').wait_for()
        teacher.locator("#teacherpanel").click()
        teacher.locator("#watchchef").select_option(label="刀工學徒")
        teacher.locator("#classlive").get_by_text("在圖上點選披薩的圓心。", exact=True).wait_for()
        student.locator('[data-cmd="ans:弧"]').click()
        student.locator("#feedback").get_by_text("找出每條半徑共同的起點。").wait_for()
        teacher.wait_for_function("""() => document.querySelector('#classlive')?.innerText.includes('找出每條半徑共同的起點')""")
        teacher.locator("#coachtext").fill("沿兩條半徑找交點。")
        teacher.locator('[data-cmd="coach"]').click()
        student.get_by_text("老師：沿兩條半徑找交點。", exact=True).wait_for()
        if output:
            output.mkdir(parents=True, exist_ok=True)
            teacher.screenshot(path=str(output/"teacher-live.webp"),type="webp",quality=84)

        # Three chefs walk and work on the same ticket while the fourth still has its question open.
        state = receive_until(crew[0][0],lambda m:m["type"]=="state" and m["state"]["status"]=="playing")["state"]
        order = state["orders"][0]["id"]
        jobs = [("flour","pantry"), ("kit","fridge"), ("preheat","oven")]
        stations = student.evaluate("async () => (await import('/world.js')).stations")
        for (socket, _), (_, key) in zip(crew, jobs):
            station = stations[key]
            send(socket, "walk", x=station["x"], z=station["z"])
        for (socket, player), (op, key) in zip(crew, jobs):
            station = stations[key]
            deadline = time.monotonic() + 40
            def arrived(m):
                assert time.monotonic() < deadline, f"Chef did not reach {key}"
                if m["type"] != "state":
                    return False
                actor = next(p for p in m["state"]["players"] if p["id"] == player)
                dx = max(0, abs(actor["x"] - station["x"]) - station["w"] / 2)
                dz = max(0, abs(actor["z"] - station["z"]) - station["d"] / 2)
                return math.hypot(dx, dz) < 0.88
            receive_until(socket, arrived)
            trace = student.evaluate("async key => (await import('/gestures.js')).gesturePath(key)", op)
            send(socket, op, order=order, trace=trace)
            receive_until(socket, lambda m: m["type"] == "ack" and m["op"] == op)
        student.locator('[data-cmd="ans:圓心"]').click()
        student.locator('#close').click()
        teacher.locator('[data-cmd="pause"]').click()
        student.locator('#banner').get_by_text("暫停營業").wait_for()
        teacher.locator('[data-cmd="resume"]').click()
        teacher.locator('[data-cmd="endconfirm"]').click()
        teacher.locator('[data-cmd="end"]').click()
        student.locator('#results').wait_for()
        assert not errors,errors
        print("Passed: 4 concurrent workstations, teacher live question, wrong answer and private coaching, pause and settlement.")


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url",default="http://127.0.0.1:3000")
    parser.add_argument("--screenshots",type=Path)
    opts=parser.parse_args()
    run(opts.url.rstrip("/"),opts.screenshots)
