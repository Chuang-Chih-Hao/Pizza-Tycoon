import { randomBytes, randomUUID, randomInt } from 'node:crypto'
import {
  stations,
  flavors,
  toppings,
  stages,
  stationFor,
  canStand,
  route,
  near,
  eventPoint,
  holdingMouse,
} from './public/world.js'
import { eligible, availableMath, roleFor } from './public/brigade.js'
import { patienceLeft, moodOf } from './public/guests.js'
import { activities, activitySeed, validActivity } from './public/activities.js'
import { motions, checkTrace, motionOptions, cutAdvice } from './public/gestures.js'
import { makeTask, pick, fractions, geometry, correct, guidance } from './math.js'
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const secret = () => randomBytes(20).toString('hex')
const newStats = () => ({
  seen: 0,
  correct: 0,
  first: 0,
  retried: 0,
  hints: 0,
  cooking: 0,
  events: 0,
  types: {},
})
const online = (r) => r.players.filter((p) => p.online)
const count = (r) => Math.max(1, online(r).length)
function need(ok, msg) {
  if (!ok) throw Error(msg)
}
export function room(code) {
  return {
    code,
    round: 1,
    nextGuestAt: 0,
    trophy: undefined,
    lastEvent: null,
    host: secret(),
    players: [],
    status: 'lobby',
    settings: { minutes: 30, difficulty: 'auto', events: true, hints: true, pace: 1 },
    t: 0,
    limit: 1800,
    nextOrder: 0,
    nextEvent: 75,
    orders: [],
    serial: 0,
    seen: new Set(),
    event: null,
    finishedEvents: 0,
    money: 0,
    revenue: 0,
    delivered: 0,
    walkedAway: 0,
    satisfaction: 0,
    upgrades: [],
    stock: 12,
    goal: 0,
    golden: '等待中',
    recipes: [],
    notice: '',
    newsId: 0,
    customers: [],
    feedback: [],
    feedbackId: 0,
  }
}
function shiftPlayer(lane) {
  return {
    x: -2 + lane,
    z: -0.75,
    heading: 0,
    ready: false,
    hand: null,
    action: '待機',
    animUntil: 0,
    lastStep: 0,
    move: [0, 0],
    path: [],
    running: false,
    stats: newStats(),
    seenTasks: new Set(),
    cargo: false,
    studying: null,
    engaged: null,
    coach: null,
    view: null,
    viewAt: 0,
    viewKey: '',
    lastResult: '',
  }
}
export function addPlayer(r, name, skin) {
  need(r.status !== 'ended', '這家店已打烊。')
  need(r.players.length < 4, '四個廚師名額已滿。')
  name = String(name || '')
    .trim()
    .slice(0, 14)
  need(name, '請輸入暱稱。')
  need(!r.players.some((p) => p.name === name), '這個暱稱已有人使用。')
  const p = {
    id: randomUUID(),
    token: secret(),
    name,
    lane: r.players.length,
    skin: clamp(Math.floor(Number(skin) || 0), 0, 5),
    online: true,
    ...shiftPlayer(r.players.length),
    inputs: new Set(),
  }
  r.players.push(p)
  return p
}
function announce(r, s) {
  r.notice = s
  r.newsId++
}
function fx(r, type, payload = {}) {
  r.feedback.push({ id: ++r.feedbackId, type, t: r.t, ...payload })
  if (r.feedback.length > 8) r.feedback.shift()
}
const cap = (r) => Math.min(4, Math.ceil(count(r) * 0.75) + (r.settings.pace === 2 ? 1 : 0))
export function phase(r) {
  const v = r.t / r.limit
  return v < 0.1 ? 0 : v < 0.267 ? 1 : v < 0.5 ? 2 : v < 0.734 ? 3 : v < 0.934 ? 4 : 5
}
function assigned(r, used = []) {
  const pending = r.orders.flatMap((o) => o.tasks.filter((q) => !q.done).map((q) => q.owner))
  return [...online(r)].sort(
    (a, b) =>
      a.stats.correct +
      pending.filter((x) => x === a.id).length +
      used.filter((x) => x === a.id).length -
      (b.stats.correct +
        pending.filter((x) => x === b.id).length +
        used.filter((x) => x === b.id).length),
  )[0]?.id
}
function subject(r, step) {
  const easy = ['center', 'radiusLine', 'name', 'angle', 'radius'],
    late = ['area', 'arc', 'inverse', 'compare', 'grams']
  if (step <= 1) return easy[(r.serial - 1) % easy.length]
  const all = r.players.reduce((a, p) => [a[0] + p.stats.first, a[1] + p.stats.seen], [0, 0])
  if (
    r.settings.difficulty === 'basic' ||
    (r.settings.difficulty === 'auto' && all[1] >= 4 && all[0] / all[1] < 0.5 && r.serial % 3 === 0)
  )
    return pick(easy)
  return step === 2
    ? pick(['radius', 'angle', 'name', 'compare'])
    : late[(r.serial - 1) % late.length]
}
export function newOrder(r, gold = false) {
  const id = ++r.serial,
    step = phase(r)
  const fset = step < 2 && r.settings.difficulty !== 'challenge' ? fractions.slice(0, 3) : fractions
  let r0,
    f,
    flavor,
    rotation,
    type,
    sig,
    tries = 0
  do {
    r0 = gold ? 10 : pick([6, 8, 10, 12])
    f = gold ? fractions[1] : pick(fset)
    flavor = gold ? 0 : randomInt(flavors.length)
    rotation = randomInt(12) * 30
    type = subject(r, r.settings.difficulty === 'challenge' ? 4 : step)
    sig = [r0, f[0], f[1], flavor, type, rotation].join('.')
  } while (r.seen.has(sig) && ++tries < 200)
  r.seen.add(sig)
  const o = {
    id,
    gold,
    creative: !gold && step >= 2 && id % 6 === 0,
    vip: !gold && step >= 3 && id % 4 === 0,
    r: r0,
    f,
    flavor,
    rotation,
    customer: pick(['沐沐', '阿樂', '晴晴', '安安', '小森', '豆豆', '阿栗', '小宇']),
    stage: 0,
    item: { type: 'flour', loc: 'pantry' },
    kit: null,
    kits: 0,
    kitNeed: count(r) >= 3 ? 2 : 1,
    press: 0,
    leads: {},
    preheated: false,
    bakeStart: null,
    quality: '',
    tasks: [],
    cuts: [],
    cutIndex: 0,
    ingredients: [],
    entryAt: Math.max(r.t, r.nextGuestAt ?? 0),
    born: r.t,
    patience: (gold ? 270 : 200) + 65 * (4 - count(r)) + 18 * r.orders.length,
    lastBy: '',
    label: '',
    revision: 0,
  }
  const add = (kind, st, frac = f, seg = 0) => {
    const q = makeTask(
      kind,
      r0,
      frac,
      st,
      assigned(
        r,
        o.tasks.map((t) => t.owner),
      ),
      rotation,
    )
    q.seg = seg
    o.tasks.push(q)
  }
  if (gold) {
    o.kitNeed = 1
    o.sectors =
      count(r) === 1
        ? [
            [1, 2, '半圓'],
            [1, 2, '半圓'],
          ]
        : [
            [1, 4, '四分之一圓'],
            [1, 2, '半圓'],
            [1, 4, '四分之一圓'],
          ]
    o.goldFlavors = [0, 4, 1].slice(0, o.sectors.length)
    const crew = [...online(r)].sort((a, b) => a.stats.correct - b.stats.correct)
    const kinds = ['angle', 'area', 'arc', 'name']
    for (let i = 0; i < Math.max(2, count(r)); i++) {
      add(kinds[i], 'cut', o.sectors[i % o.sectors.length], i % o.sectors.length)
      o.tasks.at(-1).owner = crew[i % crew.length]?.id
    }
  } else {
    add(type, { radius: 'dough', area: 'top', grams: 'top' }[type] ?? 'cut')
    const behind = online(r).some((p) => p.stats.correct < Math.floor((r.t / r.limit) * 10))
    if (count(r) > 1 && ((step >= 3 && id % 2 === 0) || (step >= 2 && behind))) {
      const follow = type === 'arc' ? 'area' : step < 3 ? 'radius' : 'arc'
      if (follow !== type)
        add(follow, follow === 'area' ? 'top' : follow === 'radius' ? 'dough' : 'cut')
    }
  }
  if (!gold && r.goal > 0 && r.revenue >= r.goal) {
    o.vip = id % 2 === 0
    if (id % 5 === 0) o.creative = true
  }
  if (!gold && online(r).length === 4 && id === 1 && o.tasks[0]?.station === 'cut')
    o.tasks[0].owner = online(r).find((p) => roleFor(o, r.players, p.id) === 3).id
  r.nextGuestAt = o.entryAt + 0.66
  r.orders.push(o)
  fx(r, 'arrival', { order: id })
  return o
}
export function disconnect(r, p) {
  p.online = false
  p.engaged = null
  p.studying = null
  p.cargo = false
  p.move = [0, 0]
  p.path = []
  if (p.hand) drop(r, p)
  for (const o of r.orders)
    for (const q of o.tasks) if (!q.done && q.owner === p.id) q.owner = assigned(r)
  rebalance(r)
}
function rebalance(r) {
  if (r.status === 'playing' || r.status === 'paused') r.goal = count(r) * 150
  for (const o of r.orders)
    if (o.stage < 3 && !o.gold)
      o.kitNeed = Math.max(o.kits + (o.kit ? 1 : 0), count(r) >= 3 ? 2 : 1)
  for (const o of r.orders)
    for (const q of o.tasks)
      if (!q.done && !online(r).some((p) => p.id === q.owner)) q.owner = assigned(r)
}
export function reconnect(r, p) {
  p.online = true
  rebalance(r)
}
function byHand(r, p) {
  return r.orders.find((o) => o.id === p.hand?.id)
}
function take(p, o, item) {
  need(!p.hand, '雙手已滿，先放下物品。')
  p.hand = { id: o.id, type: item.type }
  item.loc = p.id
}
function put(p, item, loc) {
  p.hand = null
  item.loc = loc
}
function drop(r, p) {
  const o = byHand(r, p)
  if (o) {
    const item = p.hand.type === 'kit' ? o.kit : o.item
    if (item) {
      put(p, item, 'floor')
      item.x = p.x
      item.z = p.z
    }
  }
  p.hand = null
}
function at(p, key) {
  need(stations[key] && near(p, stations[key]), '先走到設備旁邊。')
}
function action(p, r, label) {
  p.action = label
  p.animUntil = r.t + 1.4
  p.stats.cooking++
}
function taskAt(o, s) {
  return o.tasks.filter((q) => q.station === s && !q.done)
}
function produce(r, p, o, type, stage, key) {
  o.stage = stage
  o.item = { type, loc: key }
  if (p.hand?.id === o.id) p.hand = null
  action(p, r, stages[stage] || '完成')
  o.lastBy = p.name
}
export const catalog = [
  ['oven', '快火石窯', 75, '烘烤時間縮短三成'],
  ['fridge', '雙門冰箱', 95, '庫存上限及現有庫存增加 8 份'],
  ['box', '金邊餐盒', 120, '每張訂單多收 12 枚'],
  ['sign', '金色招牌', 160, '候餐耐心增加 60 秒'],
]
function upgrade(r, p, id) {
  at(p, 'upgrade')
  const row = catalog.find((a) => a[0] === id)
  need(row && !r.upgrades.includes(id), '已經升級這項設備。')
  need(r.money >= row[2], '公款還不夠。')
  r.money -= row[2]
  r.upgrades.push(id)
  if (id === 'fridge') r.stock += 8
  fx(r, 'upgrade', { where: 'upgrade' })
  announce(r, '店鋪升級了！' + row[1])
}
const makeEvent = (kind, r) => {
  kind =
    kind || pick(['mouse', 'delivery', 'leak', 'repair', 'duel'].filter((v) => v !== r.lastEvent))
  r.lastEvent = kind
  return {
    kind,
    step: 0,
    need: Math.max(2, count(r)),
    crewGoal: count(r),
    contributions: {},
    lastBy: {},
    start: r.t,
    until: r.t + { mouse: 70, leak: 65, delivery: 90, repair: 75, duel: 70 }[kind],

    last: -1,
  }
}
function playEvent(r, p, m) {
  const e = r.event
  const atMouse = holdingMouse(e, r.t, p, p.engaged)
  need(e && (atMouse || near(p, eventPoint(e, r.t, p))), '請前往你負責的事件位置。')
  need(m.eventId === e.start, '這場事件已結束。')
  need(r.t - (e.lastBy[p.id] ?? -2) > 0.22, '稍候再接下一棒。')
  const required = Math.min(e.crewGoal, count(r)),
    others = online(r).filter((c) => !e.contributions[c.id])
  if (e.contributions[p.id] && others.length && Object.keys(e.contributions).length < required)
    throw Error('隊友還有一棒：' + others.map((c) => c.name).join('、'))

  if (e.kind === 'delivery' && !p.cargo) {
    need(!p.hand, '請先放下手上物品。')
    p.cargo = true
    e.lastBy[p.id] = r.t
    action(p, r, '搬運')
    return
  }
  p.cargo = false
  e.lastBy[p.id] = r.t
  e.contributions[p.id] = (e.contributions[p.id] || 0) + 1
  e.step++
  action(p, r, activities[e.kind][0])
  p.stats.events++
  fx(r, 'rescue', { who: p.id })
  const target = Math.max(2, required)
  if (e.step >= target && Object.keys(e.contributions).length >= required) {
    r.finishedEvents++
    r.money += 18
    r.stock = Math.min(r.stock + 3, stockCap(r))
    r.event = null
    r.players.forEach((p) => (p.cargo = false))
    fx(r, 'rescued', { who: p.id })
    announce(r, '全隊救援成功！獲得 18 枚獎金與補給。')
  }
}
function stockCap(r) {
  return r.upgrades.includes('fridge') ? 20 : 12
}
function startGold(r) {
  if (r.golden !== '等待中') return
  r.golden = '製作中'
  newOrder(r, true)
  announce(r, '黃金訂單抵達！大家一起完成不同口味的扇形。')
}
function reopen(r) {
  need(r.status === 'ended', '打烊結算後才能準備下一輪。')
  const summary = {}
  for (const field of [
    'round',
    'code',
    'revenue',
    'money',
    'delivered',
    'satisfaction',
    'walkedAway',
    'goal',
    'upgrades',
    'finishedEvents',
    'recipes',
    'golden',
  ])
    summary[field] = r[field]
  summary.players = r.players.map(({ id, name, stats }) => ({ id, name, stats }))
  const { host, players, settings, round } = r
  Object.assign(r, room(r.code), { host, players, settings, round: round + 1, lastReport: summary })
  for (const p of players) Object.assign(p, shiftPlayer(p.lane))
}
function teacher(r, m) {
  switch (m.op) {
    case 'settings': {
      const s = m.value || {}
      if (r.status === 'lobby' && Number.isFinite(+s.minutes))
        r.settings.minutes = clamp(Math.round(+s.minutes), 3, 60)
      if (['auto', 'basic', 'challenge'].includes(s.difficulty))
        r.settings.difficulty = s.difficulty
      for (const k of ['events', 'hints']) if (typeof s[k] === 'boolean') r.settings[k] = s[k]
      if ([0.5, 1, 2].includes(s.pace)) r.settings.pace = s.pace
      return
    }
    case 'reopen':
      return reopen(r)
    case 'start':
      need(r.status === 'lobby' && online(r).length, '請先讓至少一位學生加入。')
      r.status = 'playing'
      r.limit = r.settings.minutes * 60
      r.goal = count(r) * 150
      for (let i = 0; i < cap(r); i++) newOrder(r)
      return
    case 'pause':
      if (r.status === 'playing') r.status = 'paused'
      return
    case 'resume':
      if (r.status === 'paused') r.status = 'playing'
      return
    case 'extend':
      if (['playing', 'paused'].includes(r.status)) r.limit += 120
      return
    case 'end':
      need(r.status !== 'lobby', '尚未開始。')
      r.status = 'ended'
      return
    case 'event':
      need(r.status === 'playing' && !r.event, '目前無法發起事件。')
      r.event = makeEvent(
        ['mouse', 'delivery', 'leak', 'repair', 'duel'].includes(m.value) ? m.value : null,
        r,
      )
      fx(r, 'event')
      return
    case 'gold':
      need(r.status === 'playing', '請先開始營業。')
      startGold(r)
      return
    case 'coach': {
      const target = r.players.find((p) => p.id === m.who),
        message = String(m.value || '')
          .trim()
          .slice(0, 120)
      need(target && message, '請選擇學生並輸入指引。')
      target.coach = { id: (target.coach?.id || 0) + 1, message }
      return
    }
    case 'tip':
      announce(r, '老師提示：先看訂單的已知條件，找到半徑與整圓比例，再分工操作。')
      return
    default:
      throw Error('未知的店務操作。')
  }
}
function record(r, p, q, value) {
  const t = p.stats,
    ok = correct(q, value)
  let info = (t.types[q.kind] ??= { seen: 0, first: 0, correct: 0, wrong: 0, hints: 0 })
  const first = !p.seenTasks.has(q.id)
  if (first) {
    p.seenTasks.add(q.id)
    t.seen++
    info.seen++
  }
  q.attempts++
  q.lastInput = String(value).slice(0, 24)
  if (!ok) {
    info.wrong++
    return { ok: false, help: guidance(q, q.attempts), task: q.id }
  }
  q.done = true
  q.solver = p.id
  t.correct++
  info.correct++
  if (first) {
    t.first++
    info.first++
  } else t.retried++
  fx(r, 'right', { who: p.id })
  return { ok: true, help: q.solution, task: q.id }
}
function leaveCounter(r, o, outcome, rating = 0) {
  r.customers.push({
    id: o.id,
    customer: o.customer,
    outcome,
    rating,
    quality: o.quality,
    position: r.orders.indexOf(o),
    t: r.t,
  })
  r.orders = r.orders.filter((entry) => entry !== o)
  r.nextOrder = r.t + 5 / r.settings.pace
}
function cancelOrder(r, o) {
  for (const p of r.players) {
    if (p.hand?.id === o.id) p.hand = null
    if (p.studying && o.tasks.some((q) => q.id === p.studying.task)) p.studying = null
  }
  r.walkedAway++
  if (o.gold) r.golden = '客人已離店'
  leaveCounter(r, o, 'left')
  announce(r, o.customer + '等不到 #' + o.id + '，已離店，這張訂單沒有收入。')
}
function complete(r, p, o) {
  const timely = moodOf(o, r.t, r.upgrades) !== 'lastCall'
  const rating = clamp(
    3 + (timely ? 1 : 0) + (o.quality === '剛剛好' ? 1 : 0) - (o.quality === '焦香過頭' ? 1 : 0),
    1,
    5,
  )
  const pay =
    22 +
    rating * 5 +
    (o.gold ? 100 : 0) +
    (o.vip ? 25 : 0) +
    (r.upgrades.includes('box') ? 12 : 0) +
    (o.creative ? o.designScore : 0)
  r.revenue += pay
  r.money += pay
  r.delivered++
  r.satisfaction += rating
  p.hand = null
  action(p, r, '慶祝')
  if (o.gold) {
    r.golden = '已完成'
    for (const chef of online(r)) {
      chef.action = '慶祝'
      chef.animUntil = r.t + 3.6
    }
    r.trophy = { at: r.t, r: o.r, sectors: o.sectors, flavors: o.goldFlavors, rotation: o.rotation }
    fx(r, 'gold', { where: 'oven' })
  }
  if (o.creative && o.designScore >= 8) r.recipes.push(o.label)
  leaveCounter(r, o, 'paid', rating)
  fx(r, 'sale', { where: 'serve', amount: pay })
  announce(r, o.customer + '收到披薩，給了 ' + rating + ' 顆星！收入 +' + pay)
}
export function command(r, p, m) {
  if (!p) return teacher(r, m)
  if (m.op === 'view') {
    const v = m.view || {},
      text = (k, n = 64) => String(v[k] ?? '').slice(0, n)
    const view = {
      page: text('page', 24),
      station: stations[v.station] ? v.station : '',
      order: Number(v.order) || 0,
      task: text('task', 48),
      heading: text('heading', 100),
      draft: text('draft', 64),
      feedback: text('feedback', 180),
      controls: text('controls', 180),
      tool: Object.hasOwn(motions, v.tool) || Object.hasOwn(activities, v.tool) ? v.tool : '',
      target: Number.isFinite(v.target) ? clamp(v.target, 1, 359) : null,
      reading: clamp(+v.reading || 0, 0, 1000),
      elapsed: clamp(+v.elapsed || 0, 0, 180000),
      step: Math.min(10, Math.max(0, +v.step || 0)),
      pointer: Array.isArray(v.pointer)
        ? v.pointer.slice(0, 2).map((x) => clamp(Number(x) || 0, 0, 1))
        : null,
      angle: clamp(+v.angle || 0, 0, 360),
      rotation: clamp(+v.rotation || 0, 0, 720),
      radius: clamp(+v.radius || 0, 0, 20),
      options: text('options', 100),
    }
    const key = JSON.stringify(view)
    if (key !== p.viewKey) {
      p.view = view
      p.viewKey = key
      p.viewAt = r.t
    }
    if (r.status === 'playing' && view.tool) {
      p.action = (activities[view.tool] || motions[view.tool])[0]
      p.animUntil = r.t + 0.6
    }
    return
  }
  if (m.op === 'ready') {
    need(r.status === 'lobby', '已開始營業。')
    p.ready = !p.ready
    return
  }
  need(r.status === 'playing', '目前不在營業中。')
  if (m.op === 'engage') {
    const e = r.event
    need(
      e?.kind === 'mouse' &&
        m.eventId === e.start &&
        (holdingMouse(e, r.t, p, p.engaged) ||
          [0, 0.5, 1].some((delay) => near(p, eventPoint(e, Math.max(e.start, r.t - delay), p)))),
      '請先靠近鼠洞。',
    )
    p.engaged = { id: e.start, at: r.t, x: p.x, z: p.z }
    return
  }
  const ticket = r.orders.find((o) => o.id === m.order)
  if (!ticket && r.customers.some((c) => c.id === m.order && c.outcome === 'left'))
    throw Error('這位客人已經離店，請改做其他訂單。')
  const motion = m.op === 'event' ? r.event?.kind : m.op
  if (Object.hasOwn(activities, motion)) {
    const seed = activitySeed(ticket, m.op === 'event' ? r.event : null, p)
    need(validActivity(motion, seed, m.inputs), '這次操作尚未完成，請再試一次。')
  }
  if (motions[motion])
    need(
      checkTrace(motion, m.trace, motionOptions(m.op, ticket, m.value)),
      '請從起點按住工具，沿標記操作到終點。',
    )
  if (['knead', 'top', 'bake', 'cut'].includes(m.op) && ticket) {
    const cooks = eligible(ticket, r.players, m.op)
    need(
      cooks.some((c) => c.id === p.id),
      '這一棒請交給 ' + cooks.map((c) => c.name).join('、') + '。',
    )
  }
  if (m.op === 'preheat') {
    at(p, 'oven')
    need(ticket && ticket.stage <= 3 && !ticket.preheated, '這張訂單已經預熱。')
    ticket.preheated = true
    action(p, r, '預熱')
    fx(r, 'ignite', { where: 'oven' })
    return
  }
  if (m.op === 'study') {
    p.studying = null
    if (!m.task) return
    const o = r.orders.find((o) => o.id === m.order),
      q = o?.tasks.find(
        (q) => q.id === m.task && q.owner === p.id && availableMath(o, q, count(r) > 1),
      )
    if (q && near(p, stations[q.station])) p.studying = { task: q.id, until: r.t + 25 }
    return
  }
  if (m.op === 'move') {
    const x = Number(m.x),
      z = Number(m.z)
    need(Number.isFinite(x + z), '方向無效。')
    const len = Math.max(1, Math.hypot(x, z))
    p.move = [x / len, z / len]
    p.path = []
    p.running = !!m.run
    p.lastStep = r.t
    return
  }
  if (m.op === 'walk') {
    need(Number.isFinite(m.x + m.z), '位置無效。')
    p.path = route(p, m.x, m.z)
    p.move = [0, 0]
    p.running = false
    return
  }
  if (m.op === 'drop') {
    drop(r, p)
    return
  }
  if (m.op === 'event') return playEvent(r, p, m)
  if (m.op === 'upgrade') return upgrade(r, p, m.value)
  need(!p.cargo, '請先把補貨箱送到冰箱旁。')
  const o = r.orders.find((o) => o.id === m.order)
  need(o, '先選一張營業中的訂單。')
  if (m.op === 'pickup') {
    const item = m.value === 'kit' ? o.kit : o.item
    need(item, '物品尚未備好。')
    if (item.loc === 'floor') need(Math.hypot(p.x - item.x, p.z - item.z) < 1.15, '先走到物品旁。')
    else {
      need(
        stations[item.loc] && !(item === o.item && [0, 4].includes(o.stage)),
        '物品已被取走或尚未完成。',
      )
      at(p, item.loc)
    }
    take(p, o, item)
    action(p, r, '搬運')
    return
  }
  if (m.op === 'flour') {
    at(p, 'pantry')
    need(o.stage === 0, '這張訂單已有麵粉。')
    take(p, o, o.item)
    o.stage = 1
    action(p, r, '領料')
    return
  }
  if (m.op === 'kit') {
    at(p, 'fridge')
    need(o.stage <= 2 && o.kits < o.kitNeed && !o.kit, '本單的配料已被領取。')
    need(!p.hand, '先放下手中物品。')
    need(r.stock > 0, '冰箱正在補料，稍等一下。')
    o.kit = { type: 'kit', loc: 'fridge' }
    take(p, o, o.kit)
    r.stock--
    action(p, r, '領料')
    return
  }
  if (m.op === 'addkit') {
    at(p, 'top')
    need(p.hand?.id === o.id && p.hand.type === 'kit', '先帶來這張訂單的配料。')
    o.kit = null
    p.hand = null
    o.kits++
    action(p, r, '加料')
    return
  }
  const station = stationFor[o.stage]
  if (['answer', 'hint'].includes(m.op)) {
    need(!o.creative || o.label, '請先設計本單配方。')
    const q = o.tasks.find((q) => q.id === m.task && availableMath(o, q, count(r) > 1))
    need(q, '題目已完成或已更換。')
    at(p, q.station)
    rebalance(r)
    need(q.owner === p.id, '輪到其他夥伴操作。')
    if (m.op === 'hint') {
      need(r.settings.hints, '老師已關閉額外提示。')
      q.hints++
      p.stats.hints++
      ;(p.stats.types[q.kind] ??= { seen: 0, first: 0, correct: 0, wrong: 0, hints: 0 }).hints++
      return { help: guidance(q, q.hints), task: q.id }
    }
    return record(r, p, q, m.value)
  }
  at(p, station)
  if (m.op === 'design') {
    need(o.creative && !o.label && o.stage === 1, '目前沒有自由創作訂單。')
    const radius = Number(m.radius),
      deg = Number(m.deg),
      ing = [
        ...new Set(
          (Array.isArray(m.ingredients) ? m.ingredients : []).filter((k) => toppings.includes(k)),
        ),
      ].slice(0, 4)
    need(
      [6, 8, 10, 12].includes(radius) &&
        fractions.some((f) => geometry(1, f).angle === deg) &&
        ing.length,
      '請選尺寸、角度與配料。',
    )
    o.label =
      String(m.label || '主廚特製')
        .trim()
        .slice(0, 18) || '主廚特製'
    o.r = radius
    o.f = fractions.find((f) => geometry(1, f).angle === deg)
    o.ingredients = ing
    o.flavor = clamp(Math.floor(+m.flavor || 0), 0, 5)
    o.designScore = clamp(4 + ing.length + randomInt(4), 4, 12)
    o.tasks = o.tasks.map((q) => makeTask(q.kind, radius, o.f, q.station, q.owner, o.rotation))
    return
  }
  if (m.op === 'place') {
    need(
      [1, 2, 3, 5].includes(o.stage) && p.hand?.id === o.id && p.hand.type === o.item.type,
      '請帶來正確的物品。',
    )
    put(p, o.item, station)
    action(p, r, '放置')
    return
  }
  if (m.op === 'knead') {
    need(o.stage === 1 && o.item.loc === 'dough', '先把麵粉放在揉麵桌。')
    need(!taskAt(o, station).length, '先完成本桌的學習任務。')
    need(!o.creative || o.label, '先設計本單的招牌配方。')
    need(Math.abs(Number(m.radius) - o.r) < 0.01, '調整半徑，讓餅皮符合訂單尺寸。')
    o.leads.knead = p.id
    o.press++
    action(p, r, '揉麵')
    if (o.press >= 3) produce(r, p, o, 'base', 2, 'dough')
    return
  }
  if (m.op === 'top') {
    need(o.stage === 2 && o.item.loc === 'top' && o.kits >= o.kitNeed, '先送來餅皮和足夠的配料籃。')
    need(!taskAt(o, station).length, '先確認配料區的面積或用量。')
    need(
      o.gold ? m.value === o.goldFlavors[o.ingredients.length] : m.value === o.flavor,
      '請依訂單選擇口味。',
    )
    o.leads.top = p.id
    o.ingredientsPlaced = (o.ingredientsPlaced || 0) + 1
    if (o.gold) o.ingredients.push(flavors[m.value])
    action(p, r, '加料')
    if (!o.gold || o.ingredientsPlaced === o.sectors.length) produce(r, p, o, 'raw', 3, 'top')
    return
  }
  if (m.op === 'bake') {
    need(
      o.stage === 3 &&
        ((p.hand?.id === o.id && p.hand.type === 'raw') || (!p.hand && o.item.loc === 'oven')),
      '把已完成配料的披薩帶進石窯。',
    )
    need(
      r.orders.filter((x) => x.stage === 4).length < (r.upgrades.includes('oven') ? 2 : 1),
      '石窯已有披薩。',
    )
    need(r.event?.kind !== 'repair', '先修復石窯或等維修員抵達。')
    need(ticket.preheated || count(r) === 1, '可請隊友先到石窯旋轉溫控鈕預熱。')
    o.leads.bake = p.id
    put(p, o.item, 'oven')
    o.stage = 4
    o.bakeStart = r.t
    o.duration = (count(r) < 3 ? 4 : 7) * (r.upgrades.includes('oven') ? 0.7 : 1)
    action(p, r, '入爐')
    return
  }
  if (m.op === 'unbake') {
    need(o.stage === 4 && r.t - o.bakeStart >= o.duration, '餅皮還在烘烤。')
    const late = o.hotAge || 0
    o.quality = late < 40 ? '剛剛好' : late < 85 ? '稍微過熟' : '焦香過頭'
    take(p, o, o.item)
    p.hand.type = o.item.type = 'baked'
    o.stage = 5
    action(p, r, '出爐')
    return
  }
  if (m.op === 'cut') {
    need(
      o.stage === 5 && o.item.loc === 'cut' && !taskAt(o, station).length,
      '先把熟披薩放好，讓夥伴完成本桌的任務。',
    )
    const f = o.gold ? o.sectors[o.cutIndex] : o.f
    const deg = geometry(o.r, f).angle
    const advice = cutAdvice(o, m.value)
    if (advice) throw Error(advice.message)
    o.leads.cut = p.id
    o.cuts.push(deg)
    o.cutIndex++
    action(p, r, '切割')
    fx(r, 'cut', { where: 'cut', order: o.id })
    if (!o.gold || o.cutIndex === o.sectors.length) produce(r, p, o, 'slice', 6, 'cut')
    return
  }
  if (m.op === 'box') {
    need(o.stage === 6 && p.hand?.id === o.id && p.hand.type === 'slice', '先取出切好的披薩。')
    produce(r, p, o, 'boxed', 7, 'box')
    return
  }
  if (m.op === 'serve') {
    need(
      o.stage === 7 && p.hand?.type === 'boxed' && p.hand.id === o.id,
      '確認訂單號碼，再送上對應餐盒。',
    )
    complete(r, p, o)
    return
  }
  throw Error('設備狀態已改變，請重新確認。')
}
export function tick(r, dt) {
  if (r.status !== 'playing') return
  r.t = Math.min(r.limit, r.t + dt)
  r.customers = r.customers.filter((c) => r.t - c.t < 6)
  for (const o of r.orders) {
    if (patienceLeft(o, r.t, r.upgrades) === 0) cancelOrder(r, o)
  }
  if (r.t >= r.limit) {
    r.status = 'ended'
    return
  }
  if (r.golden === '等待中' && r.limit - r.t <= Math.min(count(r) > 2 ? 240 : 180, r.limit * 0.22))
    startGold(r)
  if (r.orders.filter((o) => !o.gold).length < cap(r) && r.t >= r.nextOrder) {
    newOrder(r)
    r.nextOrder = r.t + 6 / r.settings.pace
  }
  if (r.settings.events && !r.event && r.t >= r.nextEvent) {
    r.event = makeEvent(null, r)
    fx(r, 'event')
  }
  if (r.event && r.t > r.event.until) {
    r.players.forEach((p) => (p.cargo = false))
    r.event = null
    announce(r, '廚房恢復正常，繼續出餐！')
  }
  if (r.event) r.event.need = Math.max(2, Math.min(r.event.crewGoal, count(r)))
  if (r.event) r.nextEvent = r.t + 65
  if (Math.floor(r.t / 12) !== Math.floor((r.t - dt) / 12))
    r.stock = Math.min(stockCap(r), r.stock + 1)
  const studying = online(r).some(
    (p) =>
      p.studying?.until >= r.t &&
      r.orders.some((o) => o.tasks.some((q) => !q.done && q.id === p.studying.task)),
  )
  for (const o of r.orders)
    if (o.stage === 4 && r.t - o.bakeStart >= o.duration) {
      o.warming = studying
      if (!studying) o.hotAge = (o.hotAge || 0) + dt
    }

  for (const p of online(r)) {
    let [x, z] = p.move,
      dist = Infinity
    if (p.path.length) {
      const [tx, tz] = p.path[0]
      x = tx - p.x
      z = tz - p.z
      dist = Math.hypot(x, z)
      if (dist) {
        x /= dist
        z /= dist
      }
    } else if (r.t - p.lastStep > 0.65) {
      x = z = 0
    }
    const slippery = r.event?.kind === 'leak' && near(p, eventPoint(r.event, r.t))
    const speed = (p.running ? 4.3 : 2.85) * (slippery ? 0.55 : 1)
    const step = Math.min(dist, dt * speed),
      nx = p.x + x * step,
      nz = p.z + z * step
    if (canStand(nx, p.z)) p.x = nx
    if (canStand(p.x, nz)) p.z = nz
    if (p.path.length && (dist <= step + 0.001 || Math.hypot(p.x - nx, p.z - nz) > 0.05))
      p.path.shift()
    if (x || z) {
      p.heading = Math.atan2(x, z)
      p.action = slippery ? '滑倒' : p.running ? '奔跑' : p.hand ? '搬運' : '行走'
    } else if (p.animUntil <= r.t) p.action = '待機'
  }
}
export function snapshot(r, viewer) {
  const { host, seen, hostInputs, emptySince, lastReport, ...state } = r
  return {
    ...state,
    phase: phase(r),
    ...(lastReport && r.status === 'lobby'
      ? {
          lastReport: {
            ...lastReport,
            players: lastReport.players.filter((p) => !viewer || p.id === viewer.id),
          },
        }
      : {}),
    players: r.players.map((p) => ({
      id: p.id,
      name: p.name,
      skin: p.skin,
      lane: p.lane,
      x: +p.x.toFixed(3),
      z: +p.z.toFixed(3),
      heading: p.heading,
      online: p.online,
      ready: p.ready,
      hand: p.hand,
      cargo: !!p.cargo,
      action: p.action,
      ...(!viewer
        ? { view: p.view ?? null, viewAt: p.viewAt ?? 0, lastResult: p.lastResult ?? '' }
        : {}),
      ...(!viewer || viewer === p ? { stats: p.stats, coach: p.coach } : {}),
    })),
    orders: r.orders.map((o) => ({
      ...o,
      tasks: o.tasks.map(({ answer, hint, solution, lastInput, ...q }) => ({
        ...q,
        ...(!viewer ? { lastInput } : {}),
        ...(q.done && viewer?.id === q.solver ? { solution } : {}),
      })),
    })),
  }
}
