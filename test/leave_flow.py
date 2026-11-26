"""Check explicit exit, freed seats and teacher return in a real classroom."""
import argparse
import os
from contextlib import ExitStack
from playwright.sync_api import sync_playwright
from websockets.sync.client import connect
from browser_flow import send, receive_until


def run(url):
    with ExitStack() as stack:
        pw = stack.enter_context(sync_playwright())
        browser = pw.chromium.launch(executable_path=os.getenv("PIZZA_BROWSER"), args=[
            "--no-zygote", "--in-process-gpu", "--use-gl=angle", "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader", "--disable-dev-shm-usage",
        ])
        stack.callback(browser.close)
        teacher = browser.new_page(viewport={"width": 1060,"height": 760})
        chef = browser.new_page(viewport={"width": 390,"height": 844})
        errors=[]
        for page in (teacher,chef):
            page.on("pageerror",lambda e: errors.append(str(e)))
            page.add_init_script("localStorage.setItem('pizza-low','1')")
            page.set_default_timeout(55000)
            page.goto(url)
        teacher.locator("#teacher").click()
        teacher.locator('[data-cmd="create"]').click()
        teacher.locator("#roomcode").wait_for()
        code=teacher.locator("#roomcode").inner_text()
        chef.locator("#student").click()
        chef.locator("#joincode").fill(code)
        chef.locator("#nickname").fill("餅皮學徒")
        chef.get_by_role("button",name="進入廚房").click()
        chef.locator("#ready").wait_for()
        chef.locator("#exitgame").click()
        chef.locator("#exitcancel").click()
        chef.locator("#ready").click()

        def join(name):
            sock=stack.enter_context(connect(url.replace("http","ws",1)+"/play",ping_interval=None,max_queue=None))
            send(sock,"join",code=code,name=name,skin=2)
            return sock,receive_until(sock,lambda m:m["type"]=="session")["id"]
        crew=[join("同學"+str(i)) for i in range(3)]
        teacher.locator('[data-cmd="start"]').click()
        chef.locator("#mission",has_text="拿取麵粉").wait_for()
        assert chef.locator("#go").inner_text().endswith("乾貨架")
        assert chef.evaluate("document.documentElement.scrollWidth <= innerWidth + 1 && scrollY===0")
        teacher.locator("#teacherpanel").click()
        teacher.locator("#exitmodal").click()
        teacher.locator("#exitconfirm").click()
        teacher.locator("#returnhost").wait_for()
        chef.locator("#go").click()
        chef.locator('[data-cmd="flour"]').wait_for()
        chef.locator("#exitmodal").click()
        chef.locator("#exitconfirm").click()
        chef.locator("#student").wait_for()
        assert chef.evaluate("sessionStorage.getItem('golden-room')") is None
        watcher=crew[0][0]
        receive_until(watcher,lambda m:m["type"]=="state" and m["state"]["status"]=="playing" and
            len(m["state"]["players"])==3 and all(p["name"]!="餅皮學徒" for p in m["state"]["players"]))
        sub,pid=join("替補廚師")
        full=receive_until(sub,lambda m:m["type"]=="state" and len(m["state"]["players"])==4)["state"]
        assert len({p["lane"] for p in full["players"]})==4
        assert "formerPlayers" not in full
        teacher.locator("#returnhost").click()
        teacher.locator("#teacherpanel").click()
        teacher.locator('[data-cmd="endconfirm"]').click()
        teacher.locator('[data-cmd="end"]').click()
        teacher.get_by_role('heading',name="本店營業成果").wait_for()
        assert "餅皮學徒" in teacher.locator("#modal").inner_text()
        assert not errors,errors
        print("Passed teacher exit and same-room return, student cancel/exit, four-seat replacement, report and mobile guidance.")


if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--url",default="http://127.0.0.1:3000")
    run(ap.parse_args().url.rstrip("/"))
