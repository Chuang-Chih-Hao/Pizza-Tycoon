"""Exercise the actual doorway meshes and finish five rescue games through the normal classroom UI."""

import argparse
import math
import os
from contextlib import ExitStack
from playwright.sync_api import sync_playwright
from websockets.sync.client import connect
from browser_flow import send, receive_until


def run(url, screenshot=None):
    with ExitStack() as stack:
        pw = stack.enter_context(sync_playwright())
        proxy = os.getenv("PIZZA_BROWSER_PROXY")
        browser = pw.chromium.launch(
            executable_path=os.getenv("PIZZA_BROWSER"),
            proxy={"server": proxy} if proxy else None,
            args=[
                "--no-zygote",
                "--in-process-gpu",
                "--use-gl=angle",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--disable-dev-shm-usage",
            ],
        )
        stack.callback(browser.close)
        page = browser.new_page(viewport={"width": 1000, "height": 740})
        page.set_default_timeout(35000)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.add_init_script("localStorage.setItem('pizza-low','1')")
        page.goto(url)
        checks = page.evaluate("""async () => {
            const T=await import('three'), {shell}=await import('/models.js'),
              {Kitchen}=await import('/scene.js'), {guestDoor:d, queueX}=await import('/guests.js')
            const geometry=shell(); geometry.updateMatrixWorld(true)
            const ray=new T.Raycaster(), direction=new T.Vector3(1,0,0)
            const blocked=(z,y)=>{
                ray.set(new T.Vector3(d.wallX-.32,y,z),direction);ray.far=.64
                return ray.intersectObject(geometry,true).length>0
            }
            if(!blocked(d.nearZ-.4,.65)) throw Error('Missing adjacent solid wall')
            let samples=0
            for (const outcome of ['paid','left']) {
                const kitchen=Object.create(Kitchen.prototype)
                Object.assign(kitchen,{world:new T.Scene(), customers:new Map(),bubble:{},speak(){}})
                const orders=Array.from({length:5},(_,i)=>({id:i+1,customer:'測試',born:0,entryAt:i*.66,patience:200}))
                const s={orders,customers:[],upgrades:[],status:'playing'}
                const crossed=new Set(),exited=new Set()
                for(let frame=0;frame<=300;frame++){
                    const t=frame/20
                    if(frame===160){s.orders=[];s.customers=orders.map((o,i)=>({...o,t,position:i,outcome}))}
                    kitchen.drawCounter(false,s,t,.05,t)
                    for(const [id,actor] of kitchen.customers){
                        const p=actor.g.position
                        if(frame===159 && Math.abs(p.x-queueX(id-1))>.05) throw Error('queue outside its slot')
                        if(Math.abs(p.x-d.wallX)<.28 && actor.g.visible){
                            (frame<160 ? crossed : exited).add(id)
                            for(const dy of [.16,.65,1.16,1.43])
                              for(const dz of [-.33,0,.33]){
                                if(blocked(p.z+dz,dy))throw Error('model intersects door or wall')
                                samples++
                              }
                        }
                        if(frame===273 && p.x>d.wallX-.8)throw Error('departure stayed indoors')
                    }
                }
                if(crossed.size!==5 || exited.size!==5) throw Error('missing wall crossings')
            }
            return samples
        }""")
        print(
            "Five queue slots, paid and unpaid crossings checked against the actual wall mesh:",
            checks,
            flush=True,
        )
        addr = url.replace("https://", "wss://").replace("http://", "ws://") + "/play"
        host = stack.enter_context(
            connect(addr, open_timeout=50, close_timeout=3, max_queue=None, ping_interval=None)
        )
        send(host, "create")
        code = receive_until(host, lambda m: m["type"] == "session")["code"]
        page.locator("#student").click()
        page.locator("#joincode").fill(code)
        page.locator("#nickname").fill("救援廚師")
        page.get_by_role("button", name="進入廚房").click()
        page.locator("#ready").click()
        send(host, "settings", value={"events": False})
        send(host, "start")
        state = lambda pred: receive_until(
            host, lambda m: m["type"] == "state" and pred(m["state"])
        )["state"]
        state(lambda s: s["status"] == "playing")
        try:
            for number, kind in enumerate(["mouse", "leak", "delivery", "repair", "duel"], 1):
                send(host, "event", value=kind)
                ev = state(lambda s: s.get("event") and s["event"]["kind"] == kind)["event"]
                for turn in range(4 if kind == "delivery" else 2):
                    page.locator("#eventgo").click()
                    page.locator('[data-cmd="event:go"]').click()
                    cv = page.locator('#gesture[data-activity="' + kind + '"]')
                    cv.wait_for()
                    if screenshot and kind == "leak" and turn == 0:
                        page.screenshot(path=screenshot, type="webp", quality=84)
                    contribution = turn // 2 if kind == "delivery" else turn
                    seed = (math.floor(ev["start"] * 10 + 0.5) + contribution * 7) % 997
                    if kind == "delivery":
                        parcel = (seed + seed // 3) % 3
                        i = (parcel + (1 + seed % 2 if turn % 2 else 0)) % 3
                        cv.press(str(i + 1))
                    elif kind == "repair":
                        mask = [1, 2, 3, 4, 5, 6, 0][seed % 7]
                        for i, flip in enumerate([3, 6, 4]):
                            if not mask & (1 << i):
                                cv.press(str(i + 1))
                                mask ^= flip
                    elif kind == "leak":
                        if turn == 0:
                            b = cv.bounding_box()
                            for j in range(25):
                                a = math.pi * j / 12
                                page.mouse.move(
                                    b["x"] + b["width"] * (300 + 60 * math.cos(a)) / 600,
                                    b["y"] + b["height"] * (158 + 60 * math.sin(a)) / 300,
                                )
                                if j == 0:
                                    page.mouse.down()
                            page.mouse.up()
                        else:
                            for _ in range(8):
                                cv.press("ArrowRight")
                    elif kind == "mouse":
                        for j in range(2):
                            frame = page.wait_for_function(
                                """min=>{
                                let ms=+document.querySelector('#gesture').dataset.elapsed, cycle=Math.floor(ms/1220)
                                return cycle>=min && ms%1220>440 && ms%1220<730 ? {cycle} : false
                            }""",
                                arg=0 if j == 0 else previous + 1,
                                polling="raf",
                            ).json_value()
                            previous = frame["cycle"]
                            hole = (seed + previous + previous // 3) % 3
                            cv.press(str(hole + 1))
                    else:
                        period = 850 + seed % 3 * 85
                        for j in range(3):
                            beat = page.wait_for_function(
                                """([per,min])=>{
                                let ms=+document.querySelector('#gesture').dataset.elapsed,n=Math.round(ms/per)
                                return n>=min && ms-n*per>=-100 && ms-n*per<=30 ? n : false
                            }""",
                                arg=[period, 1 if j == 0 else previous + 1],
                                polling="raf",
                            ).json_value()
                            cv.press("Space")
                            previous = beat
                    cv.wait_for(state="hidden", timeout=9500)
                state(lambda s: s["finishedEvents"] >= number)
                print("Completed on the server:", kind, flush=True)
            assert not errors, errors
        finally:
            send(host, "end")


if __name__ == "__main__":
    opts = argparse.ArgumentParser()
    opts.add_argument("--url", default="http://127.0.0.1:3000")
    opts.add_argument("--screenshot")
    args = opts.parse_args()
    run(args.url.rstrip("/"), args.screenshot)
