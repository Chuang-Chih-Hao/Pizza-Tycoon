import { randomUUID, randomInt } from 'node:crypto'
export const pick = (a) => a[randomInt(a.length)]
export const fractions = [
  [1, 6, '六分之一圓'],
  [1, 4, '四分之一圓'],
  [1, 2, '半圓'],
  [1, 3, '三分之一圓'],
  [3, 4, '四分之三圓'],
  [2, 3, '三分之二圓'],
]
export const skills = {
  center: '圓心辨識',
  radiusLine: '半徑辨識',
  name: '扇形比例',
  angle: '圓心角',
  radius: '半徑與直徑',
  area: '扇形面積',
  arc: '扇形弧長',
  inverse: '反推圓心角',
  compare: '面積比較',
  grams: '配料用量',
}
export function readNumber(v) {
  const s = String(v ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s/g, '')
  if (!/^[+\-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\/(?:\d+(?:\.\d*)?|\.\d+))?$/.test(s)) return NaN
  const [a, b = 1] = s.split('/').map(Number)
  return b ? a / b : NaN
}
export function geometry(r, [n, d]) {
  return {
    r,
    angle: (360 * n) / d,
    area: (314 * r * r * n) / (100 * d),
    arc: (628 * r * n) / (100 * d),
  }
}
const fmt = (n) => +n.toFixed(2)
export function makeTask(kind, r, f, station, owner, rotation = 0) {
  const [n, d, title] = f,
    { angle, area, arc } = geometry(r, f),
    share = n + '/' + d
  const options = kind === 'center' || kind === 'radiusLine' ? ['圓心', '半徑', '弧'] : null
  const definitions = {
    center: [
      '在圖上點選披薩的圓心。',
      '圓心',
      '',
      '找出每條半徑共同的起點。',
      '兩條半徑相交的點就是圓心。',
    ],
    radiusLine: [
      '在圖上點選一條半徑。',
      '半徑',
      '',
      '找一條由圓心連到餅皮外側的直線。',
      '從圓心到圓周的線段是半徑。',
    ],
    name: [
      angle + '° 的切片占整張披薩的幾分之幾？',
      n / d,
      '比例',
      '將圓心角除以 360。',
      angle + ' ÷ 360 = ' + share,
    ],
    angle: [
      title + '的切片，圓心角是多少？',
      angle,
      '°',
      '整圓有 360°，先除以分母。',
      '360 ÷ ' + d + ' × ' + n + ' = ' + angle + '°',
    ],
    radius: [
      '整張餅皮的直徑是 ' + 2 * r + ' 公分。把半徑調到多少？',
      r,
      '公分',
      '直徑橫跨兩條半徑。',
      2 * r + ' ÷ 2 = ' + r + ' 公分',
    ],
    area: [
      '半徑 ' + r + ' 公分，求' + title + '的配料覆蓋面積。',
      fmt(area),
      '平方公分',
      '先算整圓面積，再取訂單指定的比例。',
      r + ' × ' + r + ' × 3.14 × ' + share + ' ≈ ' + fmt(area) + ' 平方公分',
    ],
    arc: [
      '半徑 ' + r + ' 公分，求' + title + '外側餅皮的弧長。',
      fmt(arc),
      '公分',
      '只量外側曲線。先算整圓周長，再取指定比例。',
      '2 × ' + r + ' × 3.14 × ' + share + ' ≈ ' + fmt(arc) + ' 公分',
    ],
    inverse: [
      Math.abs(arc - fmt(arc)) < 1e-8
        ? '整圈餅皮長 ' +
          fmt(2 * 3.14 * r) +
          ' 公分，客人要外弧長 ' +
          fmt(arc) +
          ' 公分的切片。要把刀轉幾度？'
        : '整張披薩分成 ' + d + ' 等份，顧客要相連的 ' + n + ' 份。要把刀轉幾度？',
      angle,
      '°',
      '以所需弧長除以全圓周長（或以份數除以總份數），再乘 360。',
      share + ' × 360 = ' + angle + '°',
    ],
    compare: [
      '兩片半徑相同。A 的角度是 ' +
        angle +
        '°，B 是 ' +
        (angle === 90 ? 120 : 90) +
        '°。哪一片面積較大？',
      angle > (angle === 90 ? 120 : 90) ? 'A' : 'B',
      '',
      '半徑相同時，比較圓心角大小。',
      '整圓面積相同，圓心角越大，占的面積就越大。',
    ],
    grams: [
      '配料區為' + title + '，半徑 ' + r + ' 公分。每平方公分用 2 克起司，需要幾克？',
      fmt(area * 2),
      '克',
      '先算配料區面積，再乘每平方公分的克數。',
      r + ' × ' + r + ' × 3.14 × ' + share + ' × 2 ≈ ' + fmt(area * 2) + ' 克',
    ],
  }
  const [prompt, answer, unit, hint, solution] = definitions[kind]
  return {
    id: randomUUID(),
    kind,
    station,
    owner,
    r,
    f,
    rotation,
    prompt,
    answer,
    unit,
    hint,
    solution,
    options: kind === 'compare' ? ['A', 'B'] : options,
    attempts: 0,
    hints: 0,
    done: false,
  }
}
export function correct(task, input) {
  if (typeof task.answer === 'string') return String(input).trim() === task.answer
  const val = readNumber(input)
  if (!Number.isFinite(val)) return false
  return Math.abs(val - task.answer) < (task.kind === 'name' ? 1e-8 : 0.0050000001)
}
export function guidance(q, level) {
  if (level <= 1) return q.hint
  if (level >= 3) return q.solution + '。請在圖上核對，再輸入你的答案。'
  const [n, d] = q.f
  return (
    {
      area: q.r + ' × ' + q.r + ' × 3.14 ÷ ' + d + ' × ' + n,
      arc: '2 × ' + q.r + ' × 3.14 ÷ ' + d + ' × ' + n,
      grams: q.r + ' × ' + q.r + ' × 3.14 ÷ ' + d + ' × ' + n + ' × 2',
      radius: 2 * q.r + ' ÷ 2',
      angle: '360 ÷ ' + d + ' × ' + n,
      inverse: '360 ÷ ' + d + ' × ' + n,
      name: (360 * n) / d + ' ÷ 360',
    }[q.kind] ?? q.solution
  )
}
