import { flavors } from './world.js'

export const guestLabels = {
  eager: '滿心期待',
  waiting: '開始著急',
  lastCall: '快要離開',
  paid: '開心取餐',
  left: '失望離店',
}

export function patienceLeft(order, clock, upgrades) {
  return Math.max(0, order.born + order.patience + (upgrades.includes('sign') ? 60 : 0) - clock)
}

export function moodOf(order, clock, upgrades) {
  const left = patienceLeft(order, clock, upgrades)
  const total = left + clock - order.born
  if (left <= total * 0.22) return 'lastCall'
  if (left <= total * 0.5) return 'waiting'
  return 'eager'
}

export function guestLine(order, mood) {
  const pizza = order.gold ? '黃金拼盤' : order.label || flavors[order.flavor]
  const voice = order.id % 3
  if (mood === 'left')
    return [
      '午休快結束了……今天先不買了。',
      '原本好期待這一片。可惜，我得先走了。',
      '車子要來了！這份就取消吧。',
    ][voice]
  if (mood === 'paid') {
    if (order.quality === '焦香過頭') return '謝謝！下次幫我烤淺一點，好嗎？'
    return ['謝謝！這片就是我要的。', '好香！我想趁熱吃第一口。', '收到了！謝謝幫我留這一片。'][
      voice
    ]
  }
  if (mood === 'lastCall')
    return [
      '我得趕回去了，還來得及拿嗎？',
      '再等一小會兒，我就得走了……',
      '好想吃到這一片，可是時間快到了。',
    ][voice]
  if (mood === 'waiting')
    return [
      '肚子咕嚕叫了。我的那份做到哪了？',
      '我等了一會兒了，輪到我了嗎？',
      '我再等等，可以幫我看看訂單嗎？',
    ][voice]
  if (order.stage >= 6) return '那個餐盒是我的嗎？我準備好接了！'
  if (order.stage >= 4)
    return [
      '好香！是我的披薩出爐了嗎？',
      '聞到餅皮的香氣了，好期待！',
      '看見披薩了！等不及要吃了。',
    ][voice]
  return [
    '我點了' + pizza + '，最期待第一口！',
    '今天就是為了' + pizza + '來的！',
    '請給我一份' + pizza + '，謝謝！',
  ][voice]
}

// The wall opening, landing and routes share the same world coordinates.
export const guestDoor = {
  wallX: -6,
  nearZ: 2.34,
  farZ: 4.73,
  streetX: -7.68,
  inZ: 3.54,
  outZ: 4.23,
  sidewalkStartZ: 2.86,
}
export const queueX = (slot) => -2.32 - 0.79 * slot

function follow(points, distance) {
  for (let i = 1; i < points.length; i++) {
    const [x, z] = points[i - 1],
      dx = points[i][0] - x,
      dz = points[i][1] - z
    const len = Math.hypot(dx, dz)
    if (len && distance < len)
      return {
        x: x + (dx * distance) / len,
        z: z + (dz * distance) / len,
        heading: Math.atan2(dx, dz),
        walking: true,
      }
    distance -= len
  }
  const [x, z] = points.at(-1)
  return { x, z, heading: 0.46, walking: false }
}
export function arrivalPose(slot, age) {
  const d = guestDoor
  return follow(
    [
      [d.streetX, d.sidewalkStartZ],
      [d.streetX, d.inZ],
      [queueX(slot), d.inZ],
    ],
    Math.max(0, age) * 1.62,
  )
}
export function departurePose(from, age) {
  const d = guestDoor
  if (age < 1.1) return { ...from, heading: 0.46, walking: false }
  return follow(
    [
      [from.x, from.z],
      [from.x, d.outZ],
      [d.streetX, d.outZ],
    ],
    Math.max(0, age - 1.1) * 1.64,
  )
}
