import * as T from 'three'
import {
  group,
  box,
  ball,
  cyl,
  rod,
  tag,
  shell,
  stationModel,
  itemModel,
  chef,
  animateChef,
  batch,
  disposeGroup,
  mouse,
  feast,
  plant,
} from './models.js'
import { stations, skins, eventPoint, near, route } from './world.js'
export class Kitchen {
  constructor(host, onPick) {
    this.host = host
    this.onPick = onPick
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = T.PCFSoftShadowMap
    this.renderer.outputColorSpace = T.SRGBColorSpace
    this.renderer.toneMapping = T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.canvas = this.renderer.domElement
    host.prepend(this.canvas)
    this.labels = document.createElement('div')
    this.labels.className = 'labels'
    host.append(this.labels)
    this.world = new T.Scene()
    this.camera = new T.OrthographicCamera(-8, 8, 5, -5, 0.1, 85)
    this.camera.position.set(11.3, 12.4, 16.4)
    this.camera.lookAt(0, 0.66, 0.25)
    this.ray = new T.Raycaster()
    this.floor = new T.Plane(new T.Vector3(0, 1, 0), 0)
    this.world.add(new T.HemisphereLight(0xfff3d9, 0xa1b29b, 1.75))
    const sun = new T.DirectionalLight(0xffe5bd, 2.6)
    sun.position.set(-5, 12, 8)
    sun.castShadow = true
    Object.assign(sun.shadow.camera, {
      left: -10,
      right: 10,
      top: 9,
      bottom: -9,
      near: 0.5,
      far: 35,
    })
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.bias = -0.0007
    sun.shadow.normalBias = 0.035
    this.world.add(sun)
    const edge = new T.DirectionalLight(0xd4edff, 1.4)
    edge.position.set(7, 7, -4)
    this.world.add(edge)
    this.world.add(shell())
    this.sceneClock = 0
    this.parts = {}
    this.actors = new Map()
    this.items = new Map()
    this.tags = new Map()
    this.effects = []
    this.customers = new Map()
    this.zoom = 1
    this.low = false
    this.lastFx = 0
    for (const k in stations) {
      this.parts[k] = stationModel(k)
      this.world.add(this.parts[k])
      this.parts[k].userData.key = k
    }
    const shadow = new T.Mesh(new T.PlaneGeometry(38, 30), new T.ShadowMaterial({ opacity: 0.18 }))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -0.91
    shadow.receiveShadow = true
    this.world.add(shadow)
    this.marker = new T.Mesh(
      new T.RingGeometry(0.36, 0.43, 36),
      new T.MeshBasicMaterial({ color: 0xe5a633, side: T.DoubleSide }),
    )
    this.marker.rotation.x = -Math.PI / 2
    this.world.add(this.marker)
    this.target = new T.Mesh(
      new T.RingGeometry(0.7, 0.77, 32),
      new T.MeshBasicMaterial({
        color: 0xeaaa2f,
        transparent: true,
        opacity: 0.9,
        side: T.DoubleSide,
      }),
    )
    this.target.rotation.x = -Math.PI / 2
    this.world.add(this.target)
    this.trail = new T.InstancedMesh(
      new T.CylinderGeometry(0.049, 0.049, 0.015, 7),
      new T.MeshBasicMaterial({ color: 0xefbd51 }),
      48,
    )
    this.trail.count = 0
    this.trail.frustumCulled = false
    this.world.add(this.trail)
    this.canvas.addEventListener('pointerdown', (e) => this.pick(e))
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    this.last = 0
    this.frame = this.frame.bind(this)
    requestAnimationFrame(this.frame)
  }
  setHost(el) {
    if (el === this.host) return
    this.ro.disconnect()
    this.host = el
    el.prepend(this.canvas)
    el.append(this.labels)
    this.ro.observe(el)
    this.resize()
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight
    if (!w || !h) return
    const aspect = w / h
    const half = Math.max(4.84, 8.04 / aspect) / this.zoom
    Object.assign(this.camera, {
      left: -half * aspect,
      right: half * aspect,
      top: half,
      bottom: -half,
    })
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(this.low ? 1 : Math.min(1.65, window.devicePixelRatio || 1))
    this.renderer.setSize(w, h, false)
  }
  quality(low) {
    this.low = low
    this.renderer.shadowMap.enabled = !low
    this.resize()
  }
  pick(e) {
    const r = this.canvas.getBoundingClientRect()
    this.ray.setFromCamera(
      { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: 1 - ((e.clientY - r.top) / r.height) * 2 },
      this.camera,
    )
    const hits = this.ray.intersectObjects(
      [
        ...Object.values(this.parts),
        ...(this.eventObj ? [this.eventObj] : []),
        ...this.items.values(),
      ].map((v) => v.g ?? v),
      true,
    )
    if (hits.length) {
      let obj = hits[0].object
      while (obj && !obj.userData.key) obj = obj.parent
      if (obj?.userData.key) {
        this.onPick(obj.userData.key, obj.userData.data)
        return
      }
    }
    const pt = new T.Vector3()
    if (this.ray.ray.intersectPlane(this.floor, pt)) this.onPick('floor', { x: pt.x, z: pt.z })
  }
  label(key, txt, pos, cls = '') {
    let e = this.tags.get(key)
    if (!e) {
      e = document.createElement('span')
      this.labels.append(e)
      this.tags.set(key, e)
    }
    e.dataset.used = '1'
    if (e.textContent !== txt) e.textContent = txt
    e.className = 'nameplate ' + cls
    const v = pos.clone().project(this.camera)
    e.style.left = (v.x + 1) * 50 + '%'
    e.style.top = (1 - v.y) * 50 + '%'
  }
  placed(key, sig, fn, loc, scale = 1) {
    let entry = this.items.get(key)
    if (entry?.sig !== sig) {
      if (entry) disposeGroup(entry.g)
      const g = batch(fn())
      g.scale.multiplyScalar(scale)
      this.world.add(g)
      entry = { g, sig }
      this.items.set(key, entry)
    }
    entry.used = true
    entry.g.position.copy(loc)
    return entry.g
  }
  sync(state, id, goal) {
    this.s = state
    this.me = id
    this.goal = goal
  }
  spawnFx(ev) {
    const station = stations[ev.where] || stations.serve
    const a = this.actors.get(ev.who)
    const pos = a?.g.position ?? station
    if (!['right', 'sale', 'gold', 'upgrade', 'cut', 'rescue'].includes(ev.type)) return
    const n = ev.type === 'gold' ? 35 : ev.type === 'sale' ? 12 : 6
    for (let i = 0; i < n; i++) {
      const g = group()
      cyl(
        g,
        0,
        0,
        0,
        0.055 + Math.random() * 0.035,
        0.035,
        ev.type === 'right' ? '#62ac84' : i % 3 ? '#f0b947' : '#e78042',
        undefined,
        8,
      )
      this.world.add(g)
      this.effects.push({
        g,
        origin: new T.Vector3(pos.x, 1.15, pos.z),
        a: i * 2.4,
        s: 0.4 + Math.random(),
        age: 0,
      })
    }
  }
  frame(ms) {
    requestAnimationFrame(this.frame)
    if (document.hidden || this.host.offsetWidth === 0 || ms - this.last < (this.low ? 50 : 32))
      return
    const dt = Math.min(0.12, (ms - this.last) / 1000)
    this.last = ms
    const t = ms / 1000
    const s = this.s,
      preview = !s || s.status === 'lobby'
    const clock = s?.t || 0
    for (const e of this.tags.values()) e.dataset.used = '0'
    for (const i of this.items.values()) i.used = false
    const people = preview
      ? [
          { id: 'demo1', x: -2.5, z: -1.5, skin: 0, heading: 0.6, action: '揉麵' },
          { id: 'demo2', x: 0.8, z: -1.38, skin: 1, heading: -0.55, action: '加料' },
          { id: 'demo3', x: 2.5, z: 1.55, skin: 2, heading: 1, action: '切割' },
          {
            id: 'demo4',
            x: -2.65,
            z: 1.28,
            skin: 4,
            heading: 1.6,
            action: '搬運',
            hand: { type: 'raw' },
          },
        ]
      : s.players.filter((p) => p.online)
    for (const [id, a] of this.actors)
      if (!people.some((p) => p.id === id)) {
        disposeGroup(a.g)
        this.actors.delete(id)
      }
    for (const p of people) {
      let a = this.actors.get(p.id)
      if (!a) {
        a = chef(p.skin)
        this.actors.set(p.id, a)
        this.world.add(a.g)
        a.g.position.set(p.x, 0, p.z)
      }
      a.g.position.lerp(new T.Vector3(p.x, 0.01, p.z), 1 - Math.exp(-dt * 16))
      const wanted = p.heading
      const diff = Math.atan2(Math.sin(wanted - a.g.rotation.y), Math.cos(wanted - a.g.rotation.y))
      a.g.rotation.y += diff * (1 - Math.exp(-dt * 13))
      animateChef(a, s?.status === 'paused' ? clock : t, p.action, !!(p.hand || p.cargo), p.skin)
      if (!preview)
        this.label(
          p.id,
          p.name,
          a.g.position.clone().add(new T.Vector3(0, 1.96, 0)),
          p.id === this.me ? 'mine' : '',
        )
      if (p.hand || p.cargo) {
        const held = p.cargo ? { type: 'crate' } : p.hand
        const o = s?.orders.find((v) => v.id === held.id) || {}
        const pos = new T.Vector3(0, 0.71, 0.37)
          .applyAxisAngle(new T.Vector3(0, 1, 0), a.g.rotation.y)
          .add(a.g.position)
        this.placed(
          'hand' + p.id,
          [held.type, o.id, o.flavor].join(),
          () => itemModel(held.type, o),
          pos,
          0.58,
        ).rotation.y = a.g.rotation.y
      }
      if (p.id === this.me) this.marker.position.set(a.g.position.x, 0.016, a.g.position.z)
    }
    this.marker.visible = !preview && people.some((p) => p.id === this.me)
    for (const [key, part] of Object.entries(this.parts)) {
      const up = s?.upgrades.includes(key)
      if (!!part.userData.up !== !!up) {
        disposeGroup(part)
        const g = stationModel(key, up)
        if (up) {
          box(g, 0, 0.92, stations[key].d / 2 + 0.02, stations[key].w, 0.08, 0.06, '#edbf56')
        }
        g.userData = { key, up }
        this.parts[key] = g
        this.world.add(g)
      }
    }
    if (s?.upgrades.includes('sign')) {
      this.placed(
        'sign',
        '1',
        () => {
          const g = group()
          tag(g, 'GOLDEN  SLICE', 0, 0, 0, 2.68, 0.55, '#926829', '#ffe4a2')
          return g
        },
        new T.Vector3(-0.3, 1.52, -4.064),
      )
    }
    if (preview) {
      this.placed(
        'demopizza',
        '1',
        () => itemModel('baked', { flavor: 1 }),
        new T.Vector3(2.5, 1.02, 0.35),
        0.7,
      )
      this.placed('demodough', '1', () => itemModel('base'), new T.Vector3(-2.8, 1.01, -2.95), 0.75)
    }
    const locs = {}
    if (!preview)
      for (const o of s.orders) {
        for (const item of [o.item, o.kit].filter(Boolean)) {
          if ((item.loc !== 'floor' && !stations[item.loc]) || (o.stage === 0 && item === o.item))
            continue
          const st = stations[item.loc]
          let pt
          if (st) {
            const idx = locs[item.loc] || 0
            locs[item.loc] = idx + 1
            pt = new T.Vector3(
              st.x + ((idx % 2) - 0.5) * 0.54,
              st === stations.oven ? 1.115 : 0.99 + Math.floor(idx / 2) * 0.15,
              st.z + (st === stations.oven ? 0.61 : 0.07),
            )
          } else pt = new T.Vector3(item.x, 0.12, item.z)
          const ovenReady = o.stage === 4 && clock - o.bakeStart >= o.duration
          const appearance =
            item.type === 'flour' && item.loc === 'dough'
              ? 'dough'
              : ovenReady
                ? 'baked'
                : item.type
          const g = this.placed(
            o.id + '-' + (item === o.kit ? 'kit' : 'main'),
            [
              appearance,
              o.press,
              o.r,
              o.flavor,
              o.cuts.length,
              o.ingredientsPlaced,
              ovenReady,
            ].join(),
            () => itemModel(appearance, o),
            pt,
            item.loc === 'oven' ? 0.52 : o.stage === 1 ? 0.46 + o.press * 0.09 : 0.62,
          )
          g.userData.key = item.loc === 'floor' ? 'dropItem' : item.loc
          g.userData.data = { order: o.id, kit: item === o.kit, x: pt.x, z: pt.z }
          if (item.loc === 'floor')
            this.label(
              'item' + o.id + item.type,
              '#' + o.id + ' 取物',
              pt.clone().add(new T.Vector3(0, 0.64, 0)),
              'item',
            )
        }
      }
    let goal = stations[this.goal]
    if (goal && !preview) {
      this.target.visible = true
      this.target.position.set(goal.x, 0.018, goal.z)
      this.target.scale.set(1.5, 1.21, 1)
      this.label(
        'goal',
        '◆ ' + goal.name,
        new T.Vector3(goal.x, goal === stations.oven ? 2.27 : 1.58, goal.z),
        'goal',
      )
    } else this.target.visible = false
    const self = people.find((p) => p.id === this.me)
    if (self && !preview) {
      const close = Object.entries(stations).find(([k, v]) => k !== this.goal && near(self, v))
      if (close) {
        const [key, v] = close
        this.label(
          'near',
          'E · ' + v.name,
          new T.Vector3(v.x, key === 'fridge' ? 2.15 : 1.5, v.z),
          'item',
        )
      }
      const trailKey = [this.goal, Math.round(self.x * 2), Math.round(self.z * 2)].join()
      if (this.trailKey !== trailKey) {
        this.trailKey = trailKey
        const path = goal && !near(self, goal) ? route(self, goal.x, goal.z) : []
        this.trail.count = Math.min(48, path.length)
        for (let i = 0; i < this.trail.count; i++)
          this.trail.setMatrixAt(i, new T.Matrix4().makeTranslation(path[i][0], 0.021, path[i][1]))
        this.trail.instanceMatrix.needsUpdate = true
      }
    } else this.trail.count = 0
    const crowd = preview ? [{ id: -1, customer: '', born: 0, stage: 0 }] : s.orders
    for (const o of crowd) {
      let c = this.customers.get(o.id)
      if (!c) {
        c = chef(Math.abs(o.id + 3) % 6, true)
        this.customers.set(o.id, c)
        this.world.add(c.g)
        c.g.scale.setScalar(0.82)
        c.g.position.set(-5.75, 0, 3.4)
      }
      const index = crowd.indexOf(o),
        x = -3.3 - index * 0.85
      c.g.position.x += (x - c.g.position.x) * (1 - Math.exp(-dt * 2))
      c.g.position.z = 3.55
      c.g.rotation.y = 2.93
      c.head.rotation.x = !preview && clock - o.born > o.patience ? 0.13 * Math.sin(t * 3) : 0
      animateChef(c, t, Math.abs(c.g.position.x - x) > 0.08 ? '行走' : '待機', false, index)
      if (!preview && o.id === s.orders[0]?.id)
        this.label(
          'guest' + o.id,
          '#' + o.id + ' ' + (clock - o.born > o.patience ? '期待上菜' : '等候取餐'),
          new T.Vector3(c.g.position.x, 1.66, 3.55),
          'guest',
        )
    }
    for (const [id, c] of this.customers)
      if (!crowd.some((o) => o.id === id)) {
        c.g.position.x -= dt * 2
        animateChef(c, t, '慶祝', false)
        if (c.g.position.x < -5.9 || preview) {
          disposeGroup(c.g)
          this.customers.delete(id)
        }
      }
    if (this.eventKind !== s?.event?.kind) {
      if (this.eventObj) disposeGroup(this.eventObj)
      this.eventObj = null
      this.eventKind = s?.event?.kind
      if (this.eventKind) {
        let g = group()
        if (this.eventKind === 'mouse') g = mouse()
        else if (this.eventKind === 'delivery') g = itemModel('crate')
        else if (this.eventKind === 'leak') {
          ball(g, 0, 0.02, 0, 0.75, 0.025, 0.49, '#5ebac2')
          ball(g, 0.49, 0.018, 0.27, 0.22, 0.019, 0.14, '#89d0cf')
        } else {
          cyl(g, 0, 0, 0, 0.24, 0.075, '#ffc14d')
          box(g, 0, 0.22, 0, 0.09, 0.29, 0.09, '#e88d38')
        }
        g.userData.key = 'event'
        this.eventObj = g
        this.world.add(g)
      }
    }
    if (this.eventObj) {
      const e = eventPoint(s.event, clock)
      this.eventObj.position.set(
        e.x,
        this.eventKind === 'repair' || this.eventKind === 'duel' ? 1.16 : 0.02,
        e.z,
      )
      this.eventObj.rotation.y = this.eventKind === 'mouse' ? Math.cos(clock * 0.73) * 1.58 : 0
      this.label('event', '! 廚房事件', new T.Vector3(e.x, 1.34, e.z), 'alert')
    }
    if (s?.trophy) {
      const u = Math.max(0, Math.min(1, (clock - s.trophy.at) / 2.3))
      const ease = u * u * (3 - 2 * u)
      const final = new T.Vector3(-1.32, 0.82, 3.64)
      this.placed(
        'awardtable',
        'gold',
        () => {
          const g = group()
          cyl(g, 0, 0.33, 0, 0.27, 0.64, '#9b7040', 0.34)
          cyl(g, 0, 0.68, 0, 0.68, 0.1, '#d8af52')
          return g
        },
        new T.Vector3(final.x, 0.01, final.z),
      )
      const pos = new T.Vector3(stations.oven.x, 1.38, stations.oven.z + 0.66).lerp(final, ease)
      pos.y += Math.sin(u * Math.PI) * 1.65
      const g = this.placed('trophy', 'gold', () => feast(s.trophy), pos, 0.89)
      g.rotation.y = t * 0.25
      this.label('trophy', '黃金拼盤', pos.clone().add(new T.Vector3(0, 0.58, 0)), 'goal')
      this.placed(
        'goldsign',
        '1',
        () => {
          const g = group()
          tag(g, '✦  GOLDEN  SLICE  ✦', 0, 0, 0, 2.68, 0.55, '#a57526', '#fff0ac', 68)
          return g
        },
        new T.Vector3(-0.3, 1.52, -4.053),
      )
    }
    if (s?.feedback)
      for (const ev of s.feedback)
        if (ev.id > this.lastFx) {
          this.spawnFx(ev)
          this.lastFx = ev.id
        }
    for (const e of [...this.effects]) {
      e.age += dt
      const u = e.age / 1.3
      if (u >= 1) {
        e.g.removeFromParent()
        this.effects.splice(this.effects.indexOf(e), 1)
        continue
      }
      e.g.position
        .copy(e.origin)
        .add(new T.Vector3(Math.cos(e.a) * u * e.s, 3 * u - 2.5 * u * u, Math.sin(e.a) * u * e.s))
      e.g.rotation.z = t * 6
      e.g.scale.setScalar(1 - u * 0.8)
    }
    for (const o of s?.orders || [])
      if (o.stage === 4 && clock - o.bakeStart >= o.duration * 0.6) {
        const oven = stations.oven
        for (let i = 0; i < 3; i++) {
          const u = (t * 0.48 + i / 3) % 1
          const m = this.placed(
            'steam' + o.id + i,
            'steam',
            () => {
              const g = group()
              ball(g, 0, 0, 0, 0.09, 0.13, 0.08, '#eddcc4')
              return g
            },
            new T.Vector3(
              oven.x + (i - 1) * 0.15 + Math.sin(u * 5) * 0.13,
              1.37 + u * 0.85,
              oven.z + 0.72,
            ),
            1,
          )
          m.scale.setScalar(0.6 + u * 0.45)
        }
      }
    // Fade a workstation only while it lies on the sightline to the local chef.
    const mine = this.actors.get(this.me)
    let obstructed = null
    if (mine && !preview) {
      const pos = mine.g.position.clone().add(new T.Vector3(0, 1, 0)),
        ray = new T.Raycaster()
      ray.setFromCamera(pos.clone().project(this.camera), this.camera)
      ray.far = ray.ray.origin.distanceTo(pos) - 0.2
      const hit = ray.intersectObjects(Object.values(this.parts), true)[0]
      if (hit) {
        let x = hit.object
        while (x && !x.userData.key) x = x.parent
        obstructed = x
      }
    }
    for (const g of Object.values(this.parts))
      if (!!g.userData.faded !== (g === obstructed)) {
        g.userData.faded = g === obstructed
        g.traverse((o) => {
          if (!o.isMesh) return
          if (!o.userData.base) o.userData.base = o.material
          if (!o.userData.ghost) {
            o.userData.ghost = o.material.clone()
            o.userData.ghost.transparent = true
            o.userData.ghost.opacity = 0.38
          }
          o.material = g === obstructed ? o.userData.ghost : o.userData.base
        })
      }
    for (const [key, entry] of this.items)
      if (!entry.used) {
        disposeGroup(entry.g)
        this.items.delete(key)
      }
    for (const [key, e] of this.tags)
      if (e.dataset.used === '0') {
        e.remove()
        this.tags.delete(key)
      }
    this.renderer.render(this.world, this.camera)
  }
}
