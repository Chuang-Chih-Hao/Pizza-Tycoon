export const stations = {
  pantry: { name: '乾貨架', x: -4.7, z: -2.9, w: 1.4, d: 1.15 },
  dough: { name: '揉麵桌', x: -2.7, z: -3.05, w: 1.85, d: 1.15 },
  fridge: { name: '食材冰箱', x: -0.65, z: -3.05, w: 1.3, d: 1.2 },
  top: { name: '配料桌', x: 1.35, z: -3, w: 1.8, d: 1.2 },
  oven: { name: '石窯烤箱', x: 4.25, z: -2.65, w: 2.05, d: 1.6 },
  cut: { name: '扇形切割桌', x: 2.65, z: 0.35, w: 1.9, d: 1.25 },
  box: { name: '裝盒桌', x: 0.05, z: 2.55, w: 1.75, d: 1.05 },
  serve: { name: '出餐櫃台', x: -3.05, z: 2.55, w: 2.0, d: 1.1 },
  upgrade: { name: '設備目錄', x: -4.75, z: 0.1, w: 1.05, d: 0.85 },
}
export const skins = [
  ['番茄紅', '#d64e36', '#e1a475', '#3e271e'],
  ['羅勒綠', '#43836c', '#ad704d', '#38271e'],
  ['檸檬黃', '#e3a532', '#f0bd91', '#9d552d'],
  ['莓果紫', '#9873a7', '#84513a', '#282329'],
  ['海洋藍', '#477f9f', '#daa17e', '#4e352b'],
  ['蜜桃粉', '#d28187', '#bc805c', '#774739'],
]
export const flavors = ['瑪格麗特', '臘腸', '田園蘑菇', '夏威夷', '海陸鮮蝦', '甜玉米']
export const toppings = ['起司', '臘腸', '蘑菇', '鳳梨', '鮮蝦', '玉米', '青椒', '火腿']
export const stages = [
  '取麵粉',
  '揉製餅皮',
  '鋪上配料',
  '送入石窯',
  '烘烤中',
  '數學切割',
  '裝入餐盒',
  '交給顧客',
]
export const itemNames = {
  flour: '麵粉袋',
  base: '餅皮',
  kit: '配料籃',
  raw: '生披薩',
  baked: '熱披薩',
  slice: '披薩切片',
  boxed: '餐盒',
  crate: '補貨箱',
}
export const stationFor = ['pantry', 'dough', 'top', 'oven', 'oven', 'cut', 'box', 'serve']
export function canStand(x, z) {
  if (x < -5.35 || x > 5.35 || z < -3.65 || z > 3.5) return false
  return !Object.values(stations).some(
    (s) => Math.abs(x - s.x) < s.w / 2 + 0.18 && Math.abs(z - s.z) < s.d / 2 + 0.18,
  )
}
export function near(p, s) {
  return (
    Math.hypot(
      Math.max(0, Math.abs(p.x - s.x) - s.w / 2),
      Math.max(0, Math.abs(p.z - s.z) - s.d / 2),
    ) < 0.91
  )
}
export function route(p, x, z) {
  const step = 0.35,
    cell = (a, b) => [Math.round(a / step), Math.round(b / step)],
    start = cell(p.x, p.z),
    key = (a, b) => a + ',' + b
  const queue = [start],
    prev = new Map([[key(...start), null]])
  let best = start,
    min = Infinity
  for (let i = 0; i < queue.length; i++) {
    const [a, b] = queue[i],
      dist = (a * step - x) ** 2 + (b * step - z) ** 2
    if (dist < min) {
      min = dist
      best = [a, b]
    }
    if (dist < 0.035) break
    for (const [u, v] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = [a + u, b + v],
        k = key(...n)
      if (!prev.has(k) && canStand(n[0] * step, n[1] * step)) {
        prev.set(k, [a, b])
        queue.push(n)
      }
    }
  }
  const path = []
  for (let n = best; prev.get(key(...n)); n = prev.get(key(...n)))
    path.push([n[0] * step, n[1] * step])
  return path.reverse()
}
export function eventPoint(e, t, player = null) {
  const lane = (player?.lane ?? 0) % 4
  if (e.kind === 'mouse')
    return {
      x: (lane - 1.5) * 0.83 + 0.48 * Math.sin(t * 0.72 + lane),
      z: -0.95 + 0.32 * Math.sin(t * 0.84 + lane),
      w: 0.35,
      d: 0.35,
    }
  if (e.kind === 'delivery')
    return { x: player?.cargo ? -1.65 : 4.7, z: player?.cargo ? -1.8 : 2.55, w: 0.45, d: 0.5 }
  if (e.kind === 'repair') return stations.oven
  if (e.kind === 'duel') return stations.dough
  return { x: -2.5 + lane * 1.05, z: 0.32 + (lane % 2) * 0.42, w: 0.8, d: 0.65 }
}

export function holdingMouse(e, t, p, spot) {
  return (
    e?.kind === 'mouse' &&
    spot?.id === e.start &&
    t >= spot.at &&
    t - spot.at <= 30 &&
    Math.hypot(p.x - spot.x, p.z - spot.z) < 0.4
  )
}
