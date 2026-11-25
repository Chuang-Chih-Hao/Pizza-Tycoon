import * as T from 'three'
import { RoundedBoxGeometry } from '/vendor/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from '/vendor/examples/jsm/utils/BufferGeometryUtils.js'
import { guestDoor, queueX } from './guests.js'
import { skins, stations } from './world.js'
export const group = () => new T.Group()
const materials = new Map(),
  geos = new Map()
function cached(key, fn) {
  if (!geos.has(key)) geos.set(key, fn())
  return geos.get(key)
}
export function mat(color) {
  if (!materials.has(color))
    materials.set(
      color,
      new T.MeshStandardMaterial({
        color,
        roughness: 0.73,
        metalness: ['#aebfc0', '#c7d0c9'].includes(color) ? 0.32 : 0.025,
      }),
    )
  return materials.get(color)
}
function mesh(parent, geo, c, x, y, z) {
  const m = new T.Mesh(geo, typeof c === 'string' ? mat(c) : c)
  m.position.set(x, y, z)
  m.castShadow = m.receiveShadow = true
  parent.add(m)
  return m
}
export function box(p, x, y, z, w, h, d, c, rad = 0.05) {
  return mesh(
    p,
    cached(['b', w, h, d, rad].join(), () =>
      rad >= 0.025
        ? new RoundedBoxGeometry(w, h, d, 1, Math.min(rad, h * 0.45, w * 0.45, d * 0.45))
        : new T.BoxGeometry(w, h, d),
    ),
    c,
    x,
    y,
    z,
  )
}
export function ball(p, x, y, z, w, h, d, c) {
  const m = mesh(
    p,
    cached('sphere', () => new T.SphereGeometry(1, 14, 10)),
    c,
    x,
    y,
    z,
  )
  m.scale.set(w, h, d)
  return m
}
export function cyl(p, x, y, z, r, h, c, r2 = r, n = 24) {
  return mesh(
    p,
    cached(['c', r, r2, h, n].join(), () => new T.CylinderGeometry(r, r2, h, n)),
    c,
    x,
    y,
    z,
  )
}
export function rod(p, a, b, r, c) {
  const va = new T.Vector3(...a),
    vb = new T.Vector3(...b),
    len = va.distanceTo(vb),
    o = cyl(p, 0, 0, 0, r, len, c, r, 10)
  o.position.copy(va).lerp(vb, 0.5)
  o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), vb.sub(va).normalize())
  return o
}
export function tag(p, s, x, y, z, w, h, bg = '#244c42', ink = '#fff2ce', size = 83) {
  const cvs = document.createElement('canvas')
  cvs.width = 640
  cvs.height = 144
  const c = cvs.getContext('2d')
  c.fillStyle = bg
  c.fillRect(0, 0, 640, 144)
  c.strokeStyle = ink
  c.lineWidth = 3
  c.strokeRect(8, 7, 624, 130)
  c.fillStyle = ink
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.font = 'bold ' + size + 'px Georgia, sans-serif'
  c.fillText(s, 320, 73, 594)
  const tex = new T.CanvasTexture(cvs)
  tex.colorSpace = T.SRGBColorSpace
  const m = new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }),
  )
  m.position.set(x, y, z)
  p.add(m)
  return m
}
export function batch(p) {
  p.updateMatrixWorld(true)
  const inv = p.matrixWorld.clone().invert(),
    buckets = new Map(),
    remove = []
  p.traverse((o) => {
    if (!o.isMesh || o.material.map || Array.isArray(o.material)) return
    const source = o.material
    const key = source.metalness > 0.12 ? 'steel' : 'clay'
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld))
    for (const attr of Object.keys(g.attributes))
      if (!['position', 'normal', 'color'].includes(attr)) g.deleteAttribute(attr)
    if (!g.attributes.color) {
      const count = g.attributes.position.count,
        colors = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) source.color.toArray(colors, i * 3)
      g.setAttribute('color', new T.BufferAttribute(colors, 3))
    }
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(g)
    remove.push(o)
  })
  for (const o of remove) o.removeFromParent()
  for (const [m, gs] of buckets) {
    const merged = mergeGeometries(gs)
    if (!merged) continue
    const shared =
      materials.get('batch-' + m) ??
      new T.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.74,
        metalness: m === 'steel' ? 0.32 : 0.025,
      })
    materials.set('batch-' + m, shared)
    const mesh = new T.Mesh(merged, shared)
    mesh.castShadow = mesh.receiveShadow = true
    mesh.userData.ownGeo = true
    p.add(mesh)
    for (const g of gs) g.dispose()
  }
  return p
}
export function disposeGroup(p) {
  p.traverse((o) => {
    if (o.userData.ownGeo) o.geometry.dispose()
    if (o.userData.ghost) o.userData.ghost.dispose()
    if (o.material?.map) {
      o.material.map.dispose()
      o.material.dispose()
      o.geometry.dispose()
    }
  })
  p.removeFromParent()
}
const steel = '#aebfc0',
  cream = '#fff2d9',
  wood = '#af7040',
  edge = '#456660',
  dark = '#3c3631',
  green = '#638358',
  red = '#c85038',
  yellow = '#f0b842'
function leaf(p, x, y, z, a = 0, c = '#458553', s = 1) {
  let o = ball(p, x, y, z, 0.055 * s, 0.135 * s, 0.045 * s, c)
  o.rotation.z = Math.sin(a) * 0.85
  o.rotation.x = Math.cos(a) * 0.75
  return o
}
function herb(p, x, y, z, s = 1) {
  cyl(p, x, y + 0.13 * s, z, 0.19 * s, 0.27 * s, '#b96743', 0.14 * s)
  cyl(p, x, y + 0.27 * s, z, 0.205 * s, 0.06 * s, '#d27f58')
  for (let i = 0; i < 10; i++) {
    const a = i * 2.4
    leaf(
      p,
      x + 0.11 * s * Math.sin(a),
      y + 0.35 * s + (i % 2) * 0.09 * s,
      z + 0.1 * s * Math.cos(a),
      a,
      i % 2 ? '#54945a' : '#39784c',
      s,
    )
  }
}
function handle(p, x, y, z, w = 0.32) {
  box(p, x, y, z, w, 0.055, 0.065, '#394c4b', 0.025)
}
function drawer(p, x, y, z, w) {
  box(p, x, y, z, w, 0.36, 0.09, '#a0b4b0')
  handle(p, x, y + 0.07, z + 0.06)
}
function table(p, w, d, top = steel) {
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      box(p, x * (w / 2 - 0.13), 0.43, z * (d / 2 - 0.12), 0.12, 0.8, 0.12, edge)
      cyl(p, x * (w / 2 - 0.13), 0.08, z * (d / 2 - 0.12), 0.085, 0.12, dark)
    }
  box(p, 0, 0.29, 0, w - 0.12, 0.07, d - 0.1, steel)
  box(p, 0, 0.87, 0, w, 0.15, d, top, 0.065)
  box(p, 0, 0.77, 0, w - 0.07, 0.12, d - 0.07, edge)
  drawer(p, 0, 0.59, d / 2 - 0.05, w - 0.22)
}
function jar(p, x, y, z, c, h = 0.35) {
  cyl(p, x, y + h / 2, z, 0.115, h, c)
  cyl(p, x, y + h, z, 0.124, 0.035, cream)
  box(p, x, y + h * 0.55, z + 0.111, 0.14, 0.11, 0.012, '#fff2d4', 0.005)
}
function topping(p, x, y, z, i, s = 1, angle = 0) {
  const g = group()
  p.add(g)
  g.position.set(x, y, z)
  g.rotation.y = angle
  g.scale.setScalar(s)
  if (i === 1) {
    cyl(g, 0, 0.022, 0, 0.116, 0.046, '#b73829')
    for (let k = 0; k < 3; k++)
      ball(
        g,
        0.055 * Math.cos(k * 2.2),
        0.049,
        0.055 * Math.sin(k * 2.2),
        0.019,
        0.009,
        0.024,
        '#ef9774',
      )
  } else if (i === 2) {
    ball(g, 0, 0.035, 0, 0.12, 0.058, 0.072, '#d4b894')
    box(g, 0, 0.036, 0.067, 0.057, 0.06, 0.077, '#ead6ad')
  } else if (i === 3 || i === 5 || i === 7) {
    const c = i === 3 ? '#ffd044' : i === 5 ? '#eeb23a' : '#ed967d'
    box(g, 0, 0.028, 0, i === 5 ? 0.07 : 0.14, 0.055, i === 5 ? 0.09 : 0.105, c, 0.022)
  } else if (i === 4) {
    for (let k = 0; k < 4; k++) {
      const a = k * 0.6
      ball(
        g,
        0.075 * Math.cos(a),
        0.04,
        0.085 * Math.sin(a),
        0.047,
        0.04,
        0.052,
        k % 2 ? '#ffb18b' : '#e98261',
      )
    }
  } else if (i === 6) {
    for (let k = 0; k < 3; k++)
      box(g, (k - 1) * 0.055, 0.035, Math.sin(k) * 0.05, 0.07, 0.045, 0.045, '#588449').rotation.y =
        k * 0.4
  } else {
    ball(g, 0, 0.023, 0, 0.11, 0.038, 0.082, '#fff1b9')
    leaf(g, 0.038, 0.051, 0.05, 0.85, '#4b8542', 0.46)
  }
}
function layer(p, r, y, h, color, deg, start) {
  const key = ['slice', r, h, deg, start].join()
  const geo = cached(key, () => {
    const sh = new T.Shape()
    const a = ((start - 90) * Math.PI) / 180,
      b = a + (deg * Math.PI) / 180
    sh.moveTo(0, 0)
    sh.lineTo(r * Math.cos(a), r * Math.sin(a))
    sh.absarc(0, 0, r, a, b, false)
    sh.lineTo(0, 0)
    const g = new T.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 32 })
    g.rotateX(-Math.PI / 2)
    return g
  })
  return mesh(p, geo, color, 0, y, 0)
}
export function pizza({
  r = 10,
  flavor = 1,
  baked = true,
  deg = 360,
  start = 0,
  coverage = deg,
  ingredients = [],
  plain = false,
} = {}) {
  const p = group(),
    radius = 0.73
  layer(p, radius, 0, 0.085, baked ? '#b96433' : '#e3bb87', deg, start)
  layer(p, radius * 0.99, 0.085, 0.045, baked ? '#eda557' : '#f4d39d', deg, start)
  if (!plain) {
    layer(p, radius * 0.904, 0.13, 0.016, '#c55b36', deg, start)
    layer(p, radius * 0.86, 0.146, 0.021, baked ? '#f1c367' : '#ffe3a2', deg, start)
    const types = ingredients
      .map((v) => ['起司', '臘腸', '蘑菇', '鳳梨', '鮮蝦', '玉米', '青椒', '火腿'].indexOf(v))
      .filter((v) => v >= 0)
    for (let i = 0; i < 25; i++) {
      const a = (i * 137.508 + 13) % 360,
        relative = (a - start + 360) % 360,
        rr = 0.13 + 0.44 * Math.sqrt(i / 24)
      if (relative + 9 > coverage || (relative < 7 && coverage < 360)) continue
      const rad = ((a - 90) * Math.PI) / 180
      topping(
        p,
        Math.cos(rad) * rr,
        0.17,
        -Math.sin(rad) * rr,
        types.length ? types[i % types.length] : i % 4 === 0 ? 6 : flavor,
        i % 2 ? 0.8 : 0.68,
        a,
      )
    }
  }
  p.scale.setScalar(0.7 + r * 0.03)
  return p
}
export function feast(o) {
  const g = group()
  let start = o.rotation || 0
  for (let i = 0; i < o.sectors.length; i++) {
    const f = o.sectors[i],
      deg = (360 * f[0]) / f[1]
    const m = pizza({
      r: o.r,
      flavor: o.goldFlavors?.[i] ?? o.flavors?.[i] ?? 0,
      deg,
      start,
      plain: o.stage === 2 && i >= (o.ingredientsPlaced || 0),
    })
    const a = ((start + deg / 2 - 90) * Math.PI) / 180
    m.position.set(0.035 * Math.cos(a), 0, -0.035 * Math.sin(a))
    g.add(m)
    start += deg
  }
  return g
}
export function itemModel(type, o = {}) {
  if (['raw', 'baked', 'slice', 'base'].includes(type)) {
    if (o.gold && (type !== 'base' || o.ingredientsPlaced)) return feast(o)
    return pizza({
      r: o.r,
      flavor: o.flavor,
      baked: type === 'slice' || type === 'baked',
      plain: type === 'base',
      deg: type === 'slice' ? (o.cuts?.[0] ?? 90) : 360,
      start: o.rotation ?? 0,
      coverage: o.f ? (360 * o.f[0]) / o.f[1] : 360,
      ingredients: o.ingredients,
    })
  }
  const g = group()
  if (type === 'dough') {
    const presses = Math.min(3, o.press || 0),
      radius = 0.37 + presses * 0.09,
      height = 0.21 - presses * 0.045
    ball(g, 0, height * 0.65, 0, radius, height, radius * 0.94, '#edcf9b')
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4
      ball(
        g,
        Math.cos(a) * radius * 1.18,
        0.012,
        Math.sin(a) * radius * 1.21,
        0.035,
        0.009,
        0.023,
        '#f7e7c8',
      )
    }
  } else if (type === 'flour') {
    box(g, 0, 0.23, 0, 0.53, 0.48, 0.35, '#edcf96', 0.09)
    box(g, 0, 0.48, 0, 0.49, 0.065, 0.2, '#ca9d64')
    box(g, 0, 0.23, 0.18, 0.31, 0.18, 0.02, cream)
    box(g, 0, 0.23, 0.195, 0.18, 0.04, 0.015, red)
  } else if (type === 'boxed') {
    box(g, 0, 0.09, 0, 1.08, 0.18, 0.97, '#ba874f')
    box(g, 0, 0.2, 0, 1.12, 0.08, 1.01, '#e9cb95')
    cyl(g, 0, 0.25, 0, 0.24, 0.012, red)
    cyl(g, 0, 0.26, 0, 0.18, 0.012, '#edbc64')
  } else {
    box(g, 0, 0.14, 0, 0.69, 0.22, 0.46, '#a87248')
    for (const x of [-0.29, 0.29]) box(g, x, 0.27, 0, 0.07, 0.25, 0.5, wood)
    for (let i = 0; i < 5; i++)
      ball(
        g,
        ((i % 3) - 1) * 0.18,
        0.28,
        Math.floor(i / 3) * 0.14 - 0.09,
        0.12,
        0.12,
        0.1,
        [red, green, yellow][i % 3],
      )
  }
  return g
}
function awning(p, x, y, z, w) {
  const n = 13
  for (let i = 0; i < n; i++) {
    const dx = x - w / 2 + ((i + 0.5) * w) / n,
      c = i % 2 ? '#ffebcd' : '#bc4636'
    box(p, dx, y, z, w / n + 0.006, 0.085, 0.48, c, 0.025).rotation.x = 0.13
    ball(p, dx, y - 0.08, z + 0.23, (w / n) * 0.5, 0.115, 0.075, c)
  }
}
export function shell() {
  const p = group()
  box(p, 0, -0.5, 0.2, 12.25, 0.75, 9, '#975e48', 0.23)
  box(p, 0, -0.19, 0.2, 12.16, 0.18, 8.93, '#e6b278', 0.1)
  const tile = ['#a8c9b9', '#a2c3b4', '#b4cebc', '#e7d8b6', '#efe2c5']
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 12; j++) {
      const outside = i < 2 || j < 2 || i >= 14 || j > 8
      box(
        p,
        (i - 7.5) * 0.75,
        -0.058,
        (j - 5.5) * 0.73 + 0.16,
        0.737,
        0.11,
        0.716,
        tile[outside ? 3 + ((i + j) % 2) : (i * 7 + j * 5) % 3],
        0.012,
      )
    }
  for (let i = 0; i < 16; i++)
    for (let y = 0; y < 4; y++)
      box(
        p,
        (i - 7.5) * 0.75,
        0.24 + y * 0.46,
        -4.22,
        0.738,
        0.45,
        0.2,
        y === 0 ? '#bc7760' : (i + y) % 3 ? '#f0ddbe' : '#f8e8ca',
        0.018,
      )
  const door = guestDoor
  for (let j = 0; j < 12; j++) {
    const z = (j - 5.5) * 0.73 + 0.15
    if (z > door.nearZ && z < door.farZ) continue
    for (let y = 0; y < 3; y++)
      box(
        p,
        door.wallX,
        0.24 + y * 0.46,
        z,
        0.2,
        0.45,
        0.719,
        y === 0 ? '#bc7760' : (j + y) % 3 ? '#f2dfc1' : '#f9e9cc',
        0.018,
      )
  }
  box(p, 0, 1.91, -4.22, 12.15, 0.12, 0.31, '#d9b58c')
  const wallStart = -4.285
  box(
    p,
    door.wallX,
    1.43,
    (wallStart + door.nearZ) / 2,
    0.32,
    0.11,
    door.nearZ - wallStart,
    '#d9b58c',
  )
  const center = (door.nearZ + door.farZ) / 2,
    width = door.farZ - door.nearZ
  box(p, -7.08, -0.43, center, 2.25, 0.82, width + 0.4, '#ac846c', 0.09)
  box(p, -7.08, -0.04, center, 2.25, 0.08, width + 0.4, '#dfc9ac')
  box(p, door.wallX, 0.012, center, 1.02, 0.024, width - 0.18, '#759585')
  for (const z of [door.nearZ, door.farZ]) {
    box(p, door.wallX, 0.98, z, 0.21, 1.96, 0.11, edge)
    box(p, door.wallX, 0.18, z, 0.26, 0.36, 0.15, '#b78b62')
  }
  box(p, door.wallX, 1.96, center, 0.24, 0.14, width + 0.16, edge)
  const entrance = tag(p, '入口', door.wallX + 0.13, 1.96, center, 0.78, 0.21, '#3a6759')
  entrance.rotation.y = Math.PI / 2
  tag(p, 'GOLDEN  SLICE', -0.3, 1.52, -4.08, 2.68, 0.55, edge)
  awning(p, -3.05, 1.98, -4.01, 2.35)
  for (let i = 0; i < 12; i++) box(p, (i - 5.5) * 0.98, -0.43, 4.65, 0.065, 0.38, 0.035, '#cf8970')
  tag(p, 'P I Z Z E R I A', 0.25, -0.44, 4.705, 2.6, 0.32, '#884a3b', '#ffe6bd', 74)
  for (let i = 0; i < 3; i++) {
    herb(p, 5.45 - i * 0.42, 0, 3.85, 0.9)
    herb(p, -5.45, 1.5, -2.6 + i * 0.45, 0.68)
  }
  for (let i = 0; i < 5; i++) box(p, queueX(i), 0.007, door.inZ, 0.42, 0.014, 0.07, '#c69765', 0)
  // The back wall carries the tools used at the adjacent prep stations.
  rod(p, [1.12, 1.53, -4.06], [3.36, 1.53, -4.06], 0.033, steel)
  for (let i = 0; i < 4; i++) {
    const x = 1.35 + i * 0.49
    rod(p, [x, 1.53, -4.015], [x, 1.27, -4.015], 0.026, '#76523b')
    if (i < 2) {
      const pan = cyl(p, x, 1.15, -3.996, 0.147, 0.055, i ? '#b7794b' : '#546660')
      pan.rotation.x = Math.PI / 2
      const inset = cyl(p, x, 1.15, -3.96, 0.107, 0.017, i ? '#946340' : '#374d47')
      inset.rotation.x = Math.PI / 2
    } else if (i === 2) {
      ball(p, x, 1.16, -3.99, 0.083, 0.115, 0.04, steel)
    } else {
      box(p, x, 1.17, -4, 0.13, 0.16, 0.035, steel, 0.022)
      for (let k = 0; k < 3; k++)
        box(p, x - 0.044 + 0.044 * k, 1.13, -3.975, 0.012, 0.08, 0.008, edge, 0)
    }
  }
  const poster = tag(p, 'FARINA', -5.87, 1.07, -0.87, 1.0, 0.38, '#b7543f', '#fff0c8')
  poster.rotation.y = Math.PI / 2
  for (let i = 0; i < 3; i++) {
    const x = 3.23 + i * 0.21
    rod(p, [x, 1.83, -4.04], [x, 1.68, -4.04], 0.016, green)
    const pepper = ball(p, x, 1.59, -4.03, 0.056, 0.13, 0.05, i % 2 ? '#af4b33' : '#d1813b')
    pepper.rotation.z = 0.3
  }
  for (const x of [2.52, 3.18]) {
    box(p, x, 0.18, 4.02, 0.075, 0.31, 0.48, edge)
    box(p, x, 0.41, 4.18, 0.075, 0.55, 0.075, edge)
  }
  box(p, 2.85, 0.38, 4.01, 1.12, 0.1, 0.36, wood)
  box(p, 2.85, 0.6, 4.18, 1.14, 0.17, 0.07, '#bb8657')
  return batch(p)
}
export function stationModel(key, up = false) {
  const g = group(),
    s = stations[key],
    w = s.w,
    d = s.d
  g.position.set(s.x, 0, s.z)
  if (key === 'pantry') {
    for (const x of [-0.62, 0.62])
      for (const z of [-0.45, 0.45]) box(g, x, 0.83, z, 0.1, 1.64, 0.09, edge)
    for (const y of [0.19, 0.84, 1.54]) box(g, 0, y, 0, 1.48, 0.1, 1.05, wood)
    for (let i = 0; i < 4; i++) {
      const a = itemModel('flour')
      a.scale.setScalar(0.67)
      a.position.set(((i % 2) - 0.5) * 0.52, 0.25 + Math.floor(i / 2) * 0.65, 0)
      g.add(a)
    }
    for (let i = 0; i < 3; i++) jar(g, -0.43 + i * 0.42, 1.6, 0, ['#d7ad76', red, green][i])
  } else if (key === 'fridge') {
    box(g, 0, 1, 0, w, 2, d, up ? '#648e83' : '#a5b9b4', 0.12)
    box(g, 0, 1.86, 0, w + 0.05, 0.12, d + 0.04, cream)
    for (let i = 0; i < 2; i++) {
      box(g, 0, 0.53 + i * 0.88, d / 2, w - 0.13, 0.78, 0.1, '#c7d0c9')
      box(g, -0.42, 0.65 + i * 0.83, d / 2 + 0.075, 0.065, 0.3, 0.07, dark)
    }
    box(g, 0.34, 1.57, d / 2 + 0.068, 0.23, 0.15, 0.025, '#47705d')
    herb(g, -0.26, 1.94, 0, 0.75)
    if (up) {
      box(g, 0, 1.01, d / 2 + 0.07, 0.045, 1.66, 0.045, edge)
      for (const side of [-1, 1]) box(g, side * 0.1, 1.18, d / 2 + 0.12, 0.055, 0.32, 0.06, dark)
    }
  } else if (key === 'oven') {
    box(g, 0, 0.52, 0, w, 1.02, d, '#ae785b', 0.1)
    box(g, 0, 1, 0, w + 0.09, 0.17, d + 0.12, '#d3b99a')
    ball(g, 0, 1.01, 0, w * 0.49, 0.96, d * 0.52, up ? '#b28d39' : '#bf593d')
    box(g, 0.59, 1.94, -0.24, 0.32, 0.8, 0.32, '#7b6960')
    box(g, 0.59, 2.36, -0.24, 0.44, 0.1, 0.44, edge)
    ball(g, 0, 1.22, d * 0.43, 0.65, 0.49, 0.1, '#46362e')
    box(g, 0, 1.16, d * 0.43, 0.99, 0.39, 0.19, '#49352e')
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI) / 8
      const brick = box(
        g,
        0.64 * Math.cos(a),
        1.19 + 0.48 * Math.sin(a),
        d * 0.47,
        0.25,
        0.17,
        0.25,
        i % 2 ? '#e5bc8d' : '#f3d6a6',
      )
      brick.rotation.z = a - Math.PI / 2
    }
    box(g, 0, 1.03, d * 0.52, 1.48, 0.09, 0.39, '#936f54')
    if (up) {
      box(g, 0, 1.28, d * 0.49, 1.15, 0.05, 0.3, steel)
      tag(g, 'FORNO II', 0, 0.68, d * 0.52, 0.65, 0.21, '#8b6c36')
    }
    for (let i = 0; i < 4; i++)
      ball(
        g,
        -0.31 + i * 0.2,
        1.14,
        d * 0.49,
        0.1,
        0.1 + (i % 2) * 0.08,
        0.045,
        i % 2 ? '#f6953e' : '#f4bd50',
      )
    for (let i = 0; i < 5; i++)
      cyl(g, -0.54 + i * 0.28, 0.34, d * 0.49, 0.095, 0.13, '#72533c').rotation.x = Math.PI / 2
  } else if (key === 'upgrade') {
    box(g, 0, 0.6, 0, 0.54, 1.1, 0.4, wood)
    box(g, 0, 1.15, 0, 1.05, 0.74, 0.13, wood)
    tag(g, 'MENU', 0, 1.18, 0.075, 0.89, 0.52, edge)
    herb(g, 0.4, 0, 0.15, 0.78)
  } else {
    table(g, w, d, ['dough', 'cut', 'serve'].includes(key) ? '#d5a46d' : steel)
    if (key === 'dough') {
      box(g, -0.13, 0.982, 0, 1.1, 0.06, 0.75, '#e8c69b')
      let roll = cyl(g, 0.45, 1.12, -0.14, 0.098, 0.54, wood)
      roll.rotation.z = Math.PI / 2
      rod(g, [0.06, 1.12, -0.14], [0.84, 1.12, -0.14], 0.04, '#7b4f34')
      jar(g, -0.66, 0.96, -0.31, cream, 0.32)
    }
    if (key === 'top') {
      for (let i = 0; i < 4; i++) {
        box(g, -0.62 + i * 0.41, 1.0, -0.17, 0.37, 0.13, 0.47, edge)
        box(g, -0.62 + i * 0.41, 1.075, -0.17, 0.32, 0.025, 0.41, '#b9c9be')
        for (let j = 0; j < 4; j++)
          topping(
            g,
            -0.68 + i * 0.41 + (j % 2) * 0.11,
            1.1,
            -0.25 + Math.floor(j / 2) * 0.13,
            [1, 2, 6, 5][i],
            0.72,
            j,
          )
      }
      jar(g, 0.59, 0.98, 0.37, red, 0.24)
    }
    if (key === 'cut') {
      cyl(g, -0.14, 0.967, 0, 0.56, 0.06, '#ba834e')
      rod(g, [0.58, 1.02, -0.4], [0.61, 1.06, 0.06], 0.05, '#76472f')
      const blade = cyl(g, 0.6, 1.075, 0.15, 0.125, 0.045, steel)
      blade.rotation.z = Math.PI / 2
    }
    if (key === 'box') {
      for (let j = 0; j < 3; j++) {
        const b = itemModel('boxed')
        b.scale.setScalar(0.58)
        b.position.set(-0.4, 0.96 + j * 0.13, 0)
        g.add(b)
      }
    }
    if (key === 'serve') {
      box(g, 0, 0.54, 0.54, w, 0.68, 0.1, edge)
      tag(g, 'PICK UP', 0, 0.58, 0.603, 1.29, 0.35, edge)
      box(g, 0.62, 1.03, -0.08, 0.35, 0.2, 0.34, '#303e39')
      box(g, 0.62, 1.24, -0.1, 0.35, 0.27, 0.08, edge)
      cyl(g, -0.62, 1.01, 0.19, 0.15, 0.07, '#7c6854')
      ball(g, -0.62, 1.07, 0.19, 0.13, 0.1, 0.13, yellow)
    }
  }
  return batch(g)
}
export function chef(index = 0, customer = false) {
  const [_, accent, skin, hair] = skins[index % 6],
    g = group(),
    body = group()
  g.add(body)
  const legs = [],
    arms = []
  for (const side of [-1, 1]) {
    const l = group()
    l.position.set(side * 0.155, 0.39, 0)
    body.add(l)
    box(l, 0, -0.08, 0, 0.22, 0.3, 0.24, '#424751', 0.07)
    ball(l, 0, -0.25, 0.065, 0.145, 0.102, 0.19, '#3e3733')
    legs.push(batch(l))
  }
  box(body, 0, 0.69, 0, 0.61, 0.57, 0.42, customer ? accent : '#fff2db', 0.15)
  box(body, 0, 0.6, 0.208, 0.4, 0.3, 0.075, accent, 0.055)
  box(body, 0, 0.62, -0.03, 0.61, 0.055, 0.47, accent)
  for (let j = 0; j < 2; j++) ball(body, 0.09, 0.77 + j * 0.11, 0.216, 0.024, 0.026, 0.014, dark)
  for (const side of [-1, 1]) {
    const a = group()
    a.position.set(side * 0.32, 0.85, 0)
    body.add(a)
    ball(a, side * 0.034, -0.09, 0.025, 0.133, 0.16, 0.14, customer ? accent : cream)
    ball(a, side * 0.05, -0.245, 0.06, 0.1, 0.117, 0.108, skin)
    arms.push(batch(a))
  }
  const head = group()
  head.position.y = 1.25
  body.add(head)
  ball(head, 0, 0, 0.006, 0.38, 0.355, 0.345, skin)
  for (const side of [-1, 1]) {
    ball(head, side * 0.37, -0.02, 0.017, 0.077, 0.092, 0.067, skin)
    ball(head, side * 0.145, 0.021, 0.316, 0.038, 0.052, 0.027, '#312923')
    ball(head, side * 0.14 + 0.009, 0.039, 0.341, 0.009, 0.013, 0.006, '#fff8e5')
    ball(head, side * 0.225, -0.075, 0.274, 0.059, 0.026, 0.016, '#db927e')
    const brow = ball(head, side * 0.144, 0.118, 0.305, 0.061, 0.016, 0.013, hair)
    brow.rotation.z = side * 0.1
  }
  if (!customer) {
    ball(head, 0, -0.085, 0.341, 0.073, 0.035, 0.023, '#713c30')
    ball(head, 0, -0.071, 0.355, 0.055, 0.017, 0.011, '#f0ad90')
  }
  ball(head, 0, -0.026, 0.342, 0.054, 0.042, 0.04, skin)
  ball(head, 0, 0.17, -0.075, 0.37, 0.241, 0.31, hair)
  for (let i = 0; i < 3 + (index % 3); i++) {
    const a = (i - 2) * 0.37
    const f = ball(
      head,
      Math.sin(a) * 0.32,
      0.19 + Math.cos(i) * 0.03,
      Math.cos(a) * 0.23,
      0.095,
      0.082,
      0.072,
      hair,
    )
    f.rotation.z = a
  }
  if (index === 4) {
    for (const side of [-1, 1]) {
      const ring = new T.Mesh(
        cached('glasses', () => new T.TorusGeometry(0.069, 0.009, 6, 16)),
        mat('#4c4941'),
      )
      ring.position.set(side * 0.14, 0.025, 0.345)
      head.add(ring)
    }
    rod(head, [-0.073, 0.028, 0.349], [0.073, 0.028, 0.349], 0.009, '#4c4941')
  }
  if (index === 2)
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++)
        ball(
          head,
          side * (0.19 + i * 0.025),
          -0.045 + (i % 2) * 0.012,
          0.285,
          0.009,
          0.008,
          0.009,
          '#ad775a',
        )
  if (index === 3 || index === 5)
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++)
        ball(
          head,
          side * (0.303 + i * 0.012),
          0.05 - i * 0.088,
          -0.14,
          0.082 - i * 0.009,
          0.084,
          0.082,
          hair,
        )
  if (!customer) {
    cyl(head, 0, 0.297, 0, 0.331, 0.157, '#f6e9d2')
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3
      ball(
        head,
        0.215 * Math.cos(a),
        0.408 + 0.026 * (i % 2),
        0.18 * Math.sin(a),
        0.196,
        0.174,
        0.184,
        '#fff6e6',
      )
    }
    ball(head, 0, 0.465, -0.015, 0.242, 0.159, 0.207, '#fff6e6')
  }
  if (customer && index % 2 === 0) {
    cyl(head, 0, 0.285, 0, 0.34, 0.095, accent)
    box(head, 0, 0.251, 0.23, 0.63, 0.065, 0.37, accent, 0.06)
  }
  batch(head)
  let mouth
  if (customer) {
    mouth = group()
    mouth.position.set(0, -0.086, 0.335)
    for (const side of [-1, 1])
      rod(mouth, [side * 0.07, 0.018, 0], [0, -0.012, 0.012], 0.012, '#713c30')
    head.add(batch(mouth))
  }
  return { g, body, legs, arms, head, mouth }
}
export function animateChef(a, time, action, carrying, seed = 0) {
  const walk = ['行走', '搬運', '奔跑', '滑倒'].includes(action),
    beat = time * (action === '奔跑' ? 14 : 9) + seed,
    work = !walk && action !== '待機'
  a.body.position.y = walk
    ? Math.abs(Math.sin(beat)) * 0.046
    : action === '慶祝'
      ? Math.abs(Math.sin(time * 7)) * 0.18
      : Math.sin(time * 2 + seed) * 0.012
  a.body.rotation.z = action === '滑倒' ? 0.32 * Math.sin(beat) : 0
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1
    a.legs[i].rotation.x = walk ? Math.sin(beat) * 0.55 * s : 0
    a.arms[i].rotation.x = carrying
      ? -0.91
      : walk
        ? -Math.sin(beat) * 0.42 * s
        : work
          ? -0.78 + Math.sin(time * 11 + i) * 0.48
          : Math.sin(time * 2 + i) * 0.05
    a.arms[i].rotation.z = action === '慶祝' ? s * 0.9 : 0
    if (/擀|揉/.test(action)) {
      a.arms[i].rotation.x = -1 + 0.35 * Math.sin(time * 7)
      a.body.rotation.x = 0.1 + 0.07 * Math.sin(time * 7)
    } else if (/旋轉|安裝|電線/.test(action)) {
      a.arms[i].rotation.x = -1.05
      a.arms[i].rotation.z = 0.31 * Math.sin(time * 6 + i)
      a.body.rotation.x = 0.04
    } else if (/刀|配料|刮|合圍/.test(action)) {
      a.arms[i].rotation.z = 0.3 * Math.sin(time * 6 + i)
      a.body.rotation.x = 0.11
    } else if (/出爐|入爐|遞出|托起|放上|取麵粉|折盒/.test(action)) {
      a.arms[i].rotation.x = -0.8 + 0.38 * Math.cos(time * 4.8)
      a.body.rotation.x = 0.1 + 0.06 * Math.cos(time * 4.8)
    } else a.body.rotation.x = 0
  }
}
export function animateGuest(guest, t, mood, walking, seed) {
  animateChef(guest, t, walking ? '行走' : mood === 'paid' ? '慶祝' : '待機', false, seed)
  const wave = Math.sin(t * 2 + seed)
  const sad = mood === 'left' || mood === 'lastCall'
  guest.mouth.rotation.z = sad ? Math.PI : 0
  guest.head.rotation.x = sad ? 0.25 + wave * 0.04 : mood === 'eager' ? -0.06 + wave * 0.055 : 0
  guest.head.rotation.y = mood === 'waiting' ? Math.sin(t * 1.8 + seed) * 0.35 : 0
  guest.head.rotation.z = mood === 'left' ? 0.13 : 0
  if (mood === 'paid') {
    guest.arms[0].rotation.x = -1.05
    guest.arms[0].rotation.z = -0.12
    return
  }
  if (walking) return
  if (mood === 'waiting' || mood === 'lastCall') {
    guest.arms[0].rotation.x = -1.15
    guest.arms[0].rotation.z = -0.42
    guest.legs[1].rotation.x = 0.12 * Math.sin(t * 6)
  } else {
    guest.arms[1].rotation.z = 0.6 + wave * 0.2
    guest.arms[1].rotation.x = -0.7
  }
}
export function mouse() {
  const g = group()
  ball(g, 0, 0.14, 0, 0.18, 0.13, 0.29, '#857d75')
  ball(g, 0, 0.16, 0.22, 0.14, 0.13, 0.15, '#9a8e82')
  for (const s of [-1, 1]) {
    ball(g, s * 0.11, 0.28, 0.19, 0.081, 0.067, 0.042, '#c18e83')
    ball(g, s * 0.086, 0.19, 0.32, 0.022, 0.022, 0.019, dark)
  }
  ball(g, 0, 0.15, 0.365, 0.039, 0.029, 0.04, '#b97d73')
  rod(g, [0, 0.12, -0.25], [0.14, 0.1, -0.48], 0.022, '#af8c80')
  return batch(g)
}
export function plant(p, x, y, z, s) {
  herb(p, x, y, z, s)
}
