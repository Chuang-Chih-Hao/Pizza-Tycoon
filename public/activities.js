// The browser and server replay the same inputs for each workstation or rescue.
export const activities = {
  flour: ['秤一袋麵粉', '按住讓麵粉落下，指針進入綠區時放開。', '按住／放開空白鍵'],
  kit: ['配齊食材籃', '依採買單找兩種食材，碰錯可以重新選。', '點食材或按 1～3'],
  mouse: [
    '捉住偷吃鼠',
    '在老鼠出洞時點中牠兩次。牠鑽回洞裡就要等下一次。',
    '點老鼠或按洞口的 1～3',
  ],
  leak: ['關緊漏水閥', '握住紅色輪緣順時針旋緊一圈，看水柱降下來。', '轉動輪緣或分次按 →'],
  delivery: [
    '冷鏈分貨',
    '看貨單認出補給箱，搬到冰箱再放進正確的貨架。',
    '點箱子或貨架，亦可按 1～3',
  ],
  repair: ['重啟石窯電路', '讓三盞燈全部亮起。每個開關會切換自己與右邊一盞。', '點開關或按 1～3'],
  duel: ['主廚打拍子', '看光圈收進金環，跟著節奏拍麵團三次。錯拍可接著試。', '拍麵團或按空白鍵'],
}
export const handoffs = {
  pickup: '托起',
  place: '放上檯面',
  drop: '放在腳邊',
  addkit: '倒入配料',
  serve: '遞出餐盒',
}
export function activitySeed(o, e, p) {
  return e
    ? ((Math.round(e.start * 10) + p.lane * 11 + (e.contributions[p.id] || 0) * 7) % 997) +
        (e.kind === 'delivery' && p.cargo ? 997 : 0)
    : ((o?.id || 1) * 7 + (o?.flavor || 0) * 3 + (o?.kits || 0)) % 997
}
export const flourTarget = (s) => 75 + (s % 5) * 10
export const flourWeight = (ms) => Math.min(155, Math.round(ms * 0.062))
export const kitBins = (s) => [s % 3, (s + 1 + (Math.floor(s / 3) % 2)) % 3]
export const cargoCode = (s) => ((s % 997) + Math.floor((s % 997) / 3)) % 3
export const shelfShift = (s) => (s >= 997 ? 1 + ((s % 997) % 2) : 0)
export const cargoBin = (s) => (cargoCode(s) + shelfShift(s)) % 3
export const powerStart = (s) => [1, 2, 3, 4, 5, 6, 0][s % 7]
export const flipPower = (mask, index) => mask ^ [3, 6, 4][index]
export const beatPeriod = (s) => 850 + (s % 3) * 85
export function mouseAt(ms, s) {
  const cycle = Math.floor(ms / 1220),
    phase = (ms % 1220) / 1220
  const hole = (s + cycle + Math.floor(cycle / 3)) % 3
  return {
    hole,
    x: 0.2 + hole * 0.3,
    y: 0.65 - 0.18 * Math.sin(Math.PI * phase),
    visible: phase > 0.16 && phase < 0.84,
    cycle,
  }
}
export function beatAt(ms, s) {
  const period = beatPeriod(s),
    beat = Math.round(ms / period)
  return { beat, good: beat >= 1 && Math.abs(ms - beat * period) <= period * 0.19 }
}
const int = (n) => Number.isInteger(n) && n >= 0 && n < 180000
export function validActivity(kind, seed, inputs) {
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > 64) return false
  if (kind === 'flour')
    return (
      inputs.length === 1 &&
      int(inputs[0]) &&
      Math.abs(flourWeight(inputs[0]) - flourTarget(seed)) <= 9
    )
  if (kind === 'kit') return inputs.length === 2 && kitBins(seed).every((v, i) => v === inputs[i])
  if (kind === 'delivery') return inputs.length === 1 && inputs[0] === cargoBin(seed)
  if (kind === 'repair')
    return (
      inputs.every((i) => Number.isInteger(i) && i >= 0 && i < 3) &&
      inputs.reduce(flipPower, powerStart(seed)) === 7
    )
  if (kind === 'leak') {
    if (inputs.length < 7 || !inputs.every((v) => Number.isFinite(v) && v >= -180 && v <= 180))
      return false
    let total = 0
    for (let i = 1; i < inputs.length; i++) {
      const delta = ((inputs[i] - inputs[i - 1] + 540) % 360) - 180
      if (Math.abs(delta) > 65) return false
      total = Math.max(0, total + delta)
    }
    return total >= 345
  }
  if (kind === 'duel')
    return (
      inputs.length === 3 &&
      inputs.every(
        (ms, i) =>
          int(ms) &&
          beatAt(ms, seed).good &&
          (!i || beatAt(ms, seed).beat > beatAt(inputs[i - 1], seed).beat),
      )
    )
  if (kind === 'mouse') {
    let last = -1
    return (
      inputs.length === 2 &&
      inputs.every((h) => {
        if (
          !Array.isArray(h) ||
          h.length !== 3 ||
          !int(h[0]) ||
          !Number.isFinite(h[1]) ||
          !Number.isFinite(h[2])
        )
          return false
        const m = mouseAt(h[0], seed),
          hit = m.visible && m.cycle > last && Math.hypot((h[1] - m.x) * 1.75, h[2] - m.y) < 0.15
        last = m.cycle
        return hit
      })
    )
  }
  return false
}
