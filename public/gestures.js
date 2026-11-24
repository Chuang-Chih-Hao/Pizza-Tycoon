// Normalized coordinates are shared by mouse, touch, keyboard, observer and server.
const left = [0.19, 0.56],
  right = [0.79, 0.56],
  mid = [0.5, 0.55]
const transfer = [left, right]
export const motions = {
  flour: ['舀取麵粉', '把量匙從粉罐拖進麵粉袋。', 'scoop', transfer],
  kit: ['裝食材籃', '將備料盤推進菜籃。', 'kit', transfer],
  pickup: ['托起成品', '將成品從檯面托到雙手。', 'tray', transfer],
  place: ['放上料理桌', '將托盤滑到桌上定位圈。', 'tray', transfer],
  addkit: ['倒入配料', '移動菜籃，把配料倒入工作盤。', 'kit', [left, [0.52, 0.3], right]],
  knead: ['往返擀麵', '按住擀麵棍，沿麵團推過去再拉回來。', 'roll', [left, right, left]],
  top: [
    '鋪上配料',
    '夾起配料，經過兩個落點鋪上餅皮。',
    'topping',
    [left, [0.59, 0.36], [0.74, 0.65]],
  ],
  preheat: [
    '旋轉爐溫旋鈕',
    '沿刻度旋轉旋鈕到金色區。',
    'dial',
    [
      [0.3, 0.66],
      [0.36, 0.37],
      [0.5, 0.28],
      [0.66, 0.37],
      [0.72, 0.56],
    ],
  ],
  bake: ['推鏟入爐', '用木鏟將披薩平穩送進窯口。', 'peel', transfer],
  unbake: ['拉出熱披薩', '抓住鏟柄，將冒熱氣的披薩拉出來。', 'peel', [right, left]],
  cut: ['滾刀切片', '從圓心沿已設定的刀線推到底。', 'wheel', [mid, right]],
  box: [
    '折盒封口',
    '向內摺側翼，再壓下盒蓋。',
    'fold',
    [
      [0.22, 0.57],
      [0.5, 0.57],
      [0.5, 0.28],
      [0.5, 0.7],
    ],
  ],
  serve: ['遞出餐盒', '把餐盒滑到顧客取餐的位置。', 'serve', transfer],
  drop: [
    '放下物品',
    '把手中的物品放在腳邊的定位圈。',
    'tray',
    [
      [0.45, 0.27],
      [0.59, 0.74],
    ],
  ],
  upgrade: [
    '安裝設備',
    '沿刻度轉緊新設備的固定鈕。',
    'dial',
    [
      [0.3, 0.66],
      [0.36, 0.37],
      [0.5, 0.28],
      [0.66, 0.37],
      [0.72, 0.56],
    ],
  ],
  mouse: [
    '合圍老鼠',
    '從外側拉網，繞過乳酪，收攏網口。',
    'net',
    [left, [0.4, 0.3], [0.65, 0.34], right],
  ],
  leak: ['刮走積水', '握住刮水器，來回推過水漬。', 'mop', [left, right, left, right]],
  delivery: ['搬運補貨箱', '將木箱沿板車推到目的地。', 'crate', transfer],
  repair: ['接回電線', '拖動插頭繞過固定扣，接入亮燈的插座。', 'wire', [left, [0.47, 0.33], right]],
  duel: [
    '麵團接力',
    '沿彎道擀開麵團，完成這一棒。',
    'roll',
    [left, [0.49, 0.31], right, [0.49, 0.68], left],
  ],
}
export function gesturePath(key, options = {}) {
  if (key === 'cut') {
    const a =
      (((Number(options.angle) || 0) + (Number(options.rotation) || 0) - 90) * Math.PI) / 180
    return [mid, [mid[0] + 0.25 * Math.cos(a), mid[1] + 0.38 * Math.sin(a)]]
  }
  if (key === 'top' && Number.isFinite(options.angle)) {
    const at = (part, r) => {
      const a = (((options.rotation || 0) + options.angle * part - 90) * Math.PI) / 180
      return [0.69 + Math.cos(a) * r, 0.53 + Math.sin(a) * r * 1.65]
    }
    return [left, at(0.29, 0.105), at(0.71, 0.165)]
  }
  return motions[key]?.[3] ?? []
}
export function checkTrace(key, trace, options = {}) {
  const path = gesturePath(key, options)
  if (!path.length || !Array.isArray(trace) || trace.length < path.length || trace.length > 160)
    return false
  const valid = trace.every(
    (pt) =>
      Array.isArray(pt) &&
      pt.length === 2 &&
      pt.every((n) => Number.isFinite(n) && n >= 0 && n <= 1),
  )
  if (!valid) return false
  let i = 0
  const hit = (p, v) => Math.hypot((p[0] - v[0]) * 1.25, p[1] - v[1]) < 0.11
  if (!hit(trace[0], path[0])) return false
  for (const pt of trace) if (i < path.length && hit(pt, path[i])) i++
  return i === path.length && hit(trace.at(-1), path.at(-1))
}
export function motionOptions(op, o, value) {
  const segment = o?.gold ? (op === 'top' ? o.ingredientsPlaced || 0 : o.cutIndex || 0) : 0
  const sectors = o?.sectors || [],
    f = sectors[segment] || o?.f || [1, 4]
  const rotation =
    (o?.rotation || 0) + sectors.slice(0, segment).reduce((sum, f) => sum + (360 * f[0]) / f[1], 0)
  return { angle: op === 'cut' ? +value : (360 * f[0]) / f[1], rotation }
}
