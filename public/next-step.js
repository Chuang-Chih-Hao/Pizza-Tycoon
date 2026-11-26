import { stations, itemNames, flavors, stationFor } from './world.js'
import { availableMath, eligible, roleFor, craftLabels } from './brigade.js'

// One destination drives both the written instruction and the navigation button.
export function orderStep(state, o, p) {
  const crew = state.players,
    multi = crew.filter((c) => c.online).length > 1
  const at = (key, text) => ({ key, order: o?.id, text })
  const wait = (text) => at(null, text)
  if (!p) return wait('打開「店務管理」，可選一位學生查看他正在做什麼。')
  if (p.cargo) return at('event', '把補貨箱搬到冰箱旁，照貨單選對冷藏架。')
  if (!o) return wait('等待下一位顧客進店。')
  const stage = o.stage,
    station = stationFor[stage],
    loc = o.item.loc
  const lead = { 1: 'knead', 2: 'top', 3: 'bake', 5: 'cut' }[stage]
  const leaders = lead ? eligible(o, crew, lead) : []
  const canLead = leaders.some((c) => c.id === p.id)
  const mate = (id) => crew.find((c) => c.id === id)?.name || '夥伴'
  const role = roleFor(o, crew, p.id)
  const remaining = o.kits < o.kitNeed && stage <= 2
  const kit = () =>
    o.kit?.loc === 'floor'
      ? at('floorKit', '撿起地上的配料籃，再送到配料桌。')
      : o.kit
        ? wait(mate(o.kit.loc) + ' 正在配送料籃。')
        : state.stock > 0
          ? at('fridge', '按「領取本單配料籃」，依採買單選兩樣食材。')
          : wait('冰箱正在補貨，等食材到貨後再領配料籃。')
  const preheat = () => at('oven', '按「轉動溫控鈕預熱」，把旋鈕轉到金色區。')
  const ovenBlocked = () =>
    state.event?.kind === 'repair'
      ? at('event', '烤箱故障了。先去修復電路，再把披薩入爐。')
      : state.orders.filter((v) => v.stage === 4).length >=
          (state.upgrades.includes('oven') ? 2 : 1)
        ? wait('爐位已滿，等烤好的披薩出爐後再送入。')
        : null
  if (p.hand?.id === o.id) {
    if (p.hand.type === 'kit') return at('top', '把配料籃送到配料桌，按「放入配料籃」。')
    if (stage === 3) {
      if (!canLead) return at('oven', '按「將木鏟放到爐邊交棒」，讓隊友接手。')
      if (multi && !o.preheated) return preheat()
      return ovenBlocked() || at('oven', '按「送入石窯」，用木鏟把生披薩推進去。')
    }
    if (stage === 6) return at('box', '按「折盒裝入披薩」，依序折好側翼與盒蓋。')
    if (stage === 7) return at('serve', '把餐盒送給' + o.customer + '，按「交付 #' + o.id + '」。')
    return at(station, '帶著' + itemNames[p.hand.type] + '，按「放上工作桌」。')
  }
  if (multi && role === 1 && remaining && !o.kit) return kit()
  if (multi && role === 2 && stage <= 3 && !o.preheated) return preheat()
  const task = o.tasks.find((q) => q.owner === p.id && availableMath(o, q, multi))
  if (task) return at(task.station, '先完成你的題目：' + task.prompt)
  if (stage === 0) return at('pantry', '按「拿取麵粉」，按住倒粉，在綠區放開。')
  if (stage === 4) {
    const secs = Math.ceil(o.duration - (state.t - o.bakeStart))
    return secs > 0
      ? wait('烤箱還要 ' + secs + ' 秒，時間到再取出熱披薩。')
      : at('oven', '按「取出熱披薩」，把木鏟往回拉。')
  }
  if (
    remaining &&
    (!o.kit || o.kit.loc === 'floor') &&
    (stage === 2 || (loc !== station && !stations[loc]))
  ) {
    const prep = kit()
    if (prep.key || loc === station) return prep
  }
  if (loc === 'floor')
    return at(
      'floorItem',
      '撿起地上的' + itemNames[o.item.type] + '，再送到' + stations[station].name + '。',
    )
  if (stations[loc] && loc !== station)
    return at(loc, '按「拿起' + itemNames[o.item.type] + '」，送到' + stations[station].name + '。')
  if (!stations[loc])
    return wait(
      mate(loc) +
        ' 正拿著' +
        itemNames[o.item.type] +
        '，等對方送到' +
        stations[station].name +
        '。',
    )
  if (o.creative && !o.label && stage === 1)
    return at('dough', '選尺寸、角度與配料，再按「採用配方」。')
  const pending = o.tasks.find((q) => !q.done && q.station === station)
  if (pending)
    return wait('等 ' + mate(pending.owner) + ' 在' + stations[station].name + '完成題目。')
  if (stage === 2 && remaining) return kit()
  if (lead && !canLead)
    return wait(
      '這一步由 ' + leaders.map((c) => c.name).join('、') + ' 接手' + craftLabels[lead] + '。',
    )
  if (stage === 1) return at('dough', '半徑調到 ' + o.r + ' 公分，按「開始擀麵」，左右連擀九下。')
  if (stage === 2)
    return at(
      'top',
      '選「' +
        flavors[o.gold ? o.goldFlavors[o.ingredientsPlaced || 0] : o.flavor] +
        '」，用夾子把配料鋪在餅皮上。',
    )
  if (stage === 3)
    return multi && !o.preheated
      ? preheat()
      : ovenBlocked() || at('oven', '按「送入石窯」，把披薩推進烤箱。')
  if (stage === 5)
    return at(
      'cut',
      '調整刀線切出' +
        (o.gold ? o.sectors[o.cutIndex][2] : o.f[2]) +
        '，按「落刀切片」，從圓心推向外圈。',
    )
  return at(station, '拿起' + itemNames[o.item.type] + '，完成這張訂單。')
}
export function nextStep(state, selected, p) {
  const order = state.orders.find((o) => o.id === p?.hand?.id) || selected
  const step = orderStep(state, order, p)
  if (step.key || !p || p.hand || state.status !== 'playing') return step
  for (const other of state.orders) {
    if (other === order) continue
    const alternative = orderStep(state, other, p)
    if (alternative.key) return { ...alternative, waiting: step.text }
  }
  return state.event
    ? { key: 'event', text: '料理暫時需要等待，先到事件位置支援。', waiting: step.text }
    : step
}
export const destinationName = (key) =>
  stations[key]?.name ||
  { event: '事件現場', floorKit: '地上的配料籃', floorItem: '地上的食材' }[key]
