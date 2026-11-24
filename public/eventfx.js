import * as T from 'three'
import { group, box, ball, cyl, rod, mouse, batch, disposeGroup } from './models.js'
import { eventPoint } from './world.js'
const colors = {
  mouse: '#efbf50',
  leak: '#79d8e9',
  repair: '#ff9d4d',
  delivery: '#97ce85',
  duel: '#f6d9a2',
}
function van() {
  const v = group()
  box(v, 0, 0.47, 0, 0.92, 0.68, 0.7, '#61947d')
  box(v, -0.6, 0.35, 0, 0.36, 0.46, 0.65, '#e6d9a5')
  box(v, -0.62, 0.48, 0.335, 0.25, 0.17, 0.025, '#90b9b7')
  for (const x of [-0.58, 0.27])
    for (const z of [-0.34, 0.34]) {
      const w = cyl(v, x, 0.15, z, 0.15, 0.08, '#47544c')
      w.rotation.x = Math.PI / 2
    }
  box(v, 0.05, 0.46, 0.355, 0.58, 0.25, 0.02, '#efdcab')
  return batch(v)
}
function bolt() {
  const g = group()
  for (const s of [-1, 1]) {
    rod(g, [0, 0.06, 0], [s * 0.26, 0.32, 0.01], 0.037, '#f9c264')
    rod(g, [s * 0.26, 0.32, 0.01], [s * 0.14, 0.45, 0], 0.037, '#fff1a2')
    rod(g, [s * 0.14, 0.45, 0], [s * 0.41, 0.72, 0], 0.037, '#f7ad4a')
  }
  return batch(g)
}
export class EventEffects {
  constructor(scene) {
    this.scene = scene
    this.key = ''
    this.root = null
  }
  clear() {
    if (!this.root) return
    this.points.geometry.dispose()
    this.points.material.dispose()
    this.points.material.map.dispose()
    this.ring.geometry.dispose()
    this.ring.material.dispose()
    disposeGroup(this.root)
    this.root = null
  }
  update(event, t, players, me, low) {
    const key = event ? event.kind + event.start : ''
    if (key !== this.key) {
      this.clear()
      this.key = key
      if (!event) return
      this.root = group()
      this.root.userData.key = 'event'
      this.scene.add(this.root)
      this.nodes = []
      const family = event.kind,
        color = colors[family]
      if (family === 'delivery') this.prop = van()
      else if (family === 'repair') this.prop = bolt()
      else this.prop = group()
      this.root.add(this.prop)
      const c = document.createElement('canvas')
      c.width = c.height = 32
      const ctx = c.getContext('2d'),
        gradient = ctx.createRadialGradient(16, 16, 1, 16, 16, 16)
      gradient.addColorStop(0, '#ffffff')
      gradient.addColorStop(0.45, '#ffffffe6')
      gradient.addColorStop(1, '#ffffff00')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 32, 32)
      const geo = new T.BufferGeometry()
      geo.setAttribute('position', new T.BufferAttribute(new Float32Array(96 * 3), 3))
      this.points = new T.Points(
        geo,
        new T.PointsMaterial({
          color,
          map: new T.CanvasTexture(c),
          size: family === 'leak' ? 0.16 : 0.125,
          transparent: true,
          depthWrite: false,
        }),
      )
      this.points.frustumCulled = false
      this.root.add(this.points)
      this.ring = new T.Mesh(
        new T.RingGeometry(0.8, 0.86, 40),
        new T.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.72,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      )
      this.ring.rotation.x = -Math.PI / 2
      this.root.add(this.ring)
    }
    if (!event || !this.root) return
    const kind = event.kind,
      p = players.find((p) => p.id === me) || players[0],
      focus = eventPoint(event, t, p),
      lift = kind === 'repair' || kind === 'duel' ? 1.05 : 0.04
    const anchors = (players.length ? players : [null]).map((p) => eventPoint(event, t, p))
    this.ring.position.set(focus.x, 0.025, focus.z)
    const u = (t * 0.65) % 1
    this.ring.scale.setScalar(0.84 + u * 0.85)
    this.ring.material.opacity = 0.78 * (1 - u)
    this.prop.position.set(focus.x, lift + Math.sin(t * 3) * 0.035, focus.z)
    if (kind === 'delivery') {
      this.prop.position.set(4.8 + 0.12 * Math.sin(t * 1.2), 0.04, 2.85)
      this.prop.rotation.y = -0.25
    }
    if (kind === 'repair') this.prop.rotation.y = t * 1.1
    if (kind === 'mouse' || kind === 'leak')
      for (let i = 0; i < anchors.length; i++) {
        if (!this.nodes[i]) {
          let g
          if (kind === 'mouse') {
            g = mouse()
            g.scale.setScalar(1.42)
          } else {
            g = group()
            ball(g, 0, 0, 0, 0.2, 0.023, 0.13, '#76c5d2')
            ball(g, 0.15, 0, 0.1, 0.095, 0.017, 0.07, '#99d7dd')
            g = batch(g)
          }
          this.root.add(g)
          this.nodes[i] = g
        }
        const g = this.nodes[i],
          a = anchors[i]
        g.position.set(a.x, lift, a.z)
        g.rotation.y =
          kind === 'mouse' ? Math.atan2(Math.cos(t * 0.72 + i), -Math.sin(t * 0.84 + i)) : t * 0.3
        g.position.y += kind === 'mouse' ? Math.abs(Math.sin(t * 9 + i)) * 0.026 : 0
      }
    this.nodes.forEach((node, i) => (node.visible = i < anchors.length))
    const pos = this.points.geometry.attributes.position,
      amount = low ? 32 : 96
    this.points.geometry.setDrawRange(0, amount)
    for (let i = 0; i < amount; i++) {
      const a = i * 2.3999,
        v = (t * (kind === 'repair' ? 1.45 : 0.72) + i * 0.123) % 1,
        origin = anchors[i % anchors.length]
      let x = origin.x,
        y = lift,
        z = origin.z
      if (kind === 'leak') {
        x += Math.cos(a) * v * 0.75
        y += (1 - v) * v * 6.8
        z += Math.sin(a) * v * 0.75
      } else if (kind === 'mouse') {
        x += Math.cos(a) * v * 0.58
        y += v * 0.23
        z += Math.sin(a) * v * 0.58 - 0.2
      } else if (kind === 'delivery') {
        x = 4.77 + Math.cos(a) * v * 0.72
        y = 0.38 + v * 0.8
        z = 2.64 + Math.sin(a) * v * 0.64
      } else if (kind === 'repair') {
        x += Math.cos(a) * v * 1.15
        y += 0.42 + Math.sin(v * 3.14) * 0.83
        z += Math.sin(a) * v * 0.8
      } else {
        x += Math.sin(a) * (0.24 + v * 0.67)
        y += Math.sin(v * Math.PI) * 1.55
        z += Math.cos(a) * (0.24 + v * 0.55)
      }
      pos.setXYZ(i, x, y, z)
    }
    pos.needsUpdate = true
  }
}
