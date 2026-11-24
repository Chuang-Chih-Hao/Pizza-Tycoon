import { motions, gesturePath, checkTrace, motionOptions } from '../public/gestures.js'
import { eligible } from '../public/brigade.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  room,
  addPlayer,
  command,
  tick,
  disconnect,
  reconnect,
  snapshot,
  newOrder,
  catalog,
} from '../game.js'
import { makeTask, correct, geometry, fractions, skills, readNumber } from '../math.js'
import { stations, near, eventPoint } from '../public/world.js'
function setup(n) {
  const r = room('123456')
  for (let i = 0; i < n; i++) addPlayer(r, '廚師' + i, i)
  command(r, null, { op: 'start' })
  return r
}
function walk(r, p, s) {
  command(r, p, { op: 'walk', x: s.x, z: s.z })
  for (let i = 0; i < 230 && !near(p, s); i++) tick(r, 0.05)
  assert.ok(near(p, s), 'station is reachable')
  command(r, p, { op: 'move', x: 0, z: 0 })
}
function act(r, p, o, op, extra = {}) {
  const trace = motions[op] ? gesturePath(op, motionOptions(op, o, extra.value)) : undefined
  return command(r, p, { op, order: o.id, trace, ...extra })
}
function tasks(r, o, st) {
  for (const q of o.tasks.filter((t) => t.station === st && !t.done)) {
    const p = r.players.find((p) => p.id === q.owner)
    walk(r, p, stations[st])
    const wrong = act(r, p, o, 'answer', { task: q.id, value: '錯' })
    assert.equal(wrong.ok, false)
    act(r, p, o, 'hint', { task: q.id })
    assert.ok(act(r, p, o, 'answer', { task: q.id, value: q.answer }).ok)
    assert.throws(() => act(r, p, o, 'answer', { task: q.id, value: q.answer }))
  }
}
function serve(r, o) {
  const [a, b = a, c = a] = r.players
  const d = r.players[3] ?? (r.players.length === 2 ? b : a)
  walk(r, a, stations.pantry)
  act(r, a, o, 'flour')
  assert.throws(() => act(r, a, o, 'flour'))
  walk(r, a, stations.dough)
  act(r, a, o, 'place')
  tasks(r, o, 'dough')
  for (let i = 0; i < 3; i++) act(r, a, o, 'knead', { radius: o.r })
  for (let i = 0; i < o.kitNeed; i++) {
    walk(r, b, stations.fridge)
    act(r, b, o, 'kit')
    walk(r, b, stations.top)
    act(r, b, o, 'addkit')
  }
  walk(r, b, stations.dough)
  act(r, b, o, 'pickup')
  walk(r, b, stations.top)
  act(r, b, o, 'place')
  tasks(r, o, 'top')
  for (const f of o.gold ? o.goldFlavors : [o.flavor]) act(r, b, o, 'top', { value: f })
  walk(r, c, stations.top)
  act(r, c, o, 'pickup')
  walk(r, c, stations.oven)
  act(r, c, o, 'preheat')
  act(r, c, o, 'bake')
  assert.throws(() => act(r, c, o, 'unbake'))
  tick(r, o.duration + 0.1)
  act(r, c, o, 'unbake')
  walk(r, c, stations.cut)
  act(r, c, o, 'place')
  tasks(r, o, 'cut')
  walk(r, d, stations.cut)
  for (const f of o.gold ? o.sectors : [o.f]) {
    assert.throws(() => act(r, d, o, 'cut', { value: 1 }))
    act(r, d, o, 'cut', { value: (360 * f[0]) / f[1] })
  }
  act(r, d, o, 'pickup')
  walk(r, d, stations.box)
  act(r, d, o, 'box')
  act(r, d, o, 'pickup')
  walk(r, d, stations.serve)
  act(r, d, o, 'serve')
  assert.throws(() => act(r, d, o, 'serve'))
}
test('geometry generator: all 10 skills × all fractions × 4 radii, precision, equivalent forms, large sectors, units', () => {
  for (const f of fractions)
    for (const r of [6, 8, 10, 12])
      for (const kind of Object.keys(skills)) {
        const q = makeTask(kind, r, f, 'cut', 'chef')
        assert.ok(correct(q, q.answer))
        assert.ok(!correct(q, ''))
        if (q.options) assert.equal(q.options.filter((v) => correct(q, v)).length, 1)
        if (kind === 'area') assert.ok(Math.abs(q.answer - (3.14 * r * r * f[0]) / f[1]) <= 0.0051)
        if (kind === 'arc') assert.ok(Math.abs(q.answer - (6.28 * r * f[0]) / f[1]) <= 0.0051)
        if (kind === 'name') assert.ok(correct(q, 2 * f[0] + '/' + 2 * f[1]))
        if (kind === 'grams') assert.equal(q.unit, '克')
      }
  assert.deepEqual(geometry(10, fractions[1]), { r: 10, angle: 90, area: 78.5, arc: 15.7 })
  assert.equal(geometry(10, fractions[4]).angle, 270)
  assert.equal(readNumber(' １ ／ ４ '), 0.25)
  assert.ok(Number.isNaN(readNumber('1/0')))
})
for (let n = 1; n <= 4; n++)
  test(
    n + ' student(s) start, walk between stations, serve a paid order and finish golden pizza',
    () => {
      const r = setup(n)
      r.settings.events = false
      serve(r, r.orders[0])
      assert.equal(r.delivered, 1)
      assert.ok(r.revenue > 0)
      command(r, null, { op: 'gold' })
      const o = r.orders.find((x) => x.gold)
      assert.equal(new Set(o.tasks.map((q) => q.owner)).size, n)
      serve(r, o)
      assert.equal(r.golden, '已完成')
      assert.equal(
        o.cuts.reduce((a, b) => a + b),
        360,
      )
      assert.ok(r.players.every((p) => p.stats.correct >= 1))
      assert.equal(r.delivered, 2)
      assert.ok(r.trophy)
      assert.equal(r.status, 'playing')
      const before = r.t
      command(r, null, { op: 'pause' })
      tick(r, 6)
      assert.equal(r.t, before)
      command(r, null, { op: 'resume' })
      command(r, null, { op: 'extend' })
      assert.equal(r.limit, 1920)
      tick(r, r.limit)
      assert.equal(r.status, 'ended')
    },
  )
test('disconnect releases food and reassigns learning; stats and hints private', () => {
  const r = setup(2),
    [a, b] = r.players,
    o = r.orders[0]
  walk(r, a, stations.pantry)
  act(r, a, o, 'flour')
  disconnect(r, a)
  assert.equal(o.item.loc, 'floor')
  assert.ok(o.tasks.every((q) => q.owner !== a.id))
  walk(r, b, { x: o.item.x, z: o.item.z, w: 0.1, d: 0.1 })
  act(r, b, o, 'pickup')
  reconnect(r, a)
  assert.equal(snapshot(r, b).players[0].stats, undefined)
  assert.ok(!JSON.stringify(snapshot(r, b)).includes(a.token))
  assert.ok(!('answer' in snapshot(r, b).orders[0].tasks[0]))
})
test('shared upgrade finances and duplicate purchase', () => {
  const r = setup(2),
    p = r.players[0]
  r.money = r.revenue = 250
  walk(r, p, stations.upgrade)
  command(r, p, { op: 'upgrade', value: catalog[0][0], trace: gesturePath('upgrade') })
  assert.equal(r.money, 175)
  assert.equal(r.revenue, 250)
  assert.throws(() =>
    command(r, p, { op: 'upgrade', value: 'oven', trace: gesturePath('upgrade') }),
  )
  assert.equal(r.money, 175)
})
test('five active events have distinct interactions, supply and a single completion', () => {
  for (const kind of ['mouse', 'delivery', 'leak', 'repair', 'duel']) {
    const r = setup(2),
      p = r.players[0]
    command(r, null, { op: 'event', value: kind })
    for (let i = 0; i < 1600 && r.event; i++) {
      for (const chef of r.players) {
        const e = r.event
        if (!e || e.contributions[chef.id]) continue
        const pt = eventPoint(e, r.t, chef)
        if (!near(chef, pt) && !chef.path.length) command(r, chef, { op: 'walk', x: pt.x, z: pt.z })
        if (near(chef, pt) && r.t - (e.lastBy[chef.id] ?? -1) > 0.3)
          command(r, chef, {
            op: 'event',
            eventId: e.start,
            value: e.sequence[chef.skin % 3],
            trace: gesturePath(kind),
          })
      }
      tick(r, 0.05)
    }
    assert.equal(r.finishedEvents, 1, kind)
    assert.equal(r.money, 18)
  }
})
test('30 minute simulated classroom reaches timed finale and closes with unfinished tickets', () => {
  const r = setup(4)
  for (let s = 0; s < 1799; s++) tick(r, 1)
  assert.equal(r.status, 'playing')
  assert.equal(r.golden, '製作中')
  assert.ok(r.orders.some((o) => o.gold))
  tick(r, 1)
  assert.equal(r.status, 'ended')
  assert.equal(r.t, 1800)
})
test('sessions generate varied, nonrepeating order specifications', () => {
  const r = setup(1)
  for (let i = 0; i < 80; i++) newOrder(r)
  assert.equal(r.seen.size, r.serial)
  assert.ok(new Set(r.orders.map((o) => o.rotation)).size > 3)
})
test('creative recipe changes model parameters and regenerates geometry tasks before baking', () => {
  const r = setup(1),
    p = r.players[0]
  r.t = 1000
  r.serial = 5
  const o = newOrder(r)
  assert.ok(o.creative)
  walk(r, p, stations.pantry)
  act(r, p, o, 'flour')
  walk(r, p, stations.dough)
  act(r, p, o, 'place')
  act(r, p, o, 'design', {
    label: '玉米花園',
    radius: 12,
    deg: 270,
    flavor: 5,
    ingredients: ['玉米', '青椒', '火腿', '起司'],
  })
  assert.equal(o.r, 12)
  assert.equal(o.f[2], '四分之三圓')
  assert.equal(o.designScore >= 8, true)
  assert.ok(o.tasks.every((q) => q.r === 12))
  assert.throws(() => act(r, p, o, 'design', { radius: 8 }))
})
test('oven protects the pizza while another chef studies, then tracks overbaking', () => {
  const r = setup(2),
    [a, b] = r.players,
    [oven, study] = r.orders
  r.settings.events = false
  oven.stage = 4
  oven.bakeStart = r.t
  oven.duration = 1
  oven.item = { type: 'raw', loc: 'oven' }
  study.stage = 5
  study.item = { type: 'baked', loc: 'cut' }
  const q = study.tasks[0]
  q.station = 'cut'
  q.owner = b.id
  walk(r, b, stations.cut)
  const prior = oven.hotAge
  command(r, b, { op: 'study', order: study.id, task: q.id })
  tick(r, 5)
  assert.equal(oven.warming, true)
  assert.equal(oven.hotAge, prior)
  command(r, b, { op: 'study' })
  tick(r, 3)
  assert.equal(oven.warming, false)
  assert.ok(oven.hotAge >= 3)
})

test('four independent jobs are available on the opening ticket; private page state belongs to the teacher', () => {
  const r = setup(4),
    [a, b, c, d] = r.players,
    o = r.orders[0]
  r.settings.events = false
  for (const [p, where] of [
    [a, 'pantry'],
    [b, 'fridge'],
    [c, 'oven'],
    [d, 'cut'],
  ])
    walk(r, p, stations[where])
  const q = o.tasks.find((q) => q.owner === d.id)
  assert.equal(q.station, 'cut')
  act(r, d, o, 'answer', { task: q.id, value: q.answer })
  act(r, c, o, 'preheat')
  act(r, b, o, 'kit')
  act(r, a, o, 'flour')
  assert.equal(o.stage, 1)
  assert.equal(q.done, true)
  assert.ok(o.preheated)
  assert.equal(b.hand.type, 'kit')
  command(r, d, {
    op: 'view',
    view: {
      page: 'station',
      station: 'cut',
      task: q.id,
      order: o.id,
      heading: '扇形切割桌',
      draft: '3/4',
      feedback: '檢查單位',
    },
  })
  assert.equal(snapshot(r, null).players[3].view.draft, '3/4')
  assert.equal(snapshot(r, a).players[3].view, undefined)
})
test('work requires a continuous gesture and a different online chef until the whole brigade contributes', () => {
  const r = setup(4),
    [a, b, c, d] = r.players,
    o = r.orders[0]
  walk(r, a, stations.pantry)
  assert.throws(() => command(r, a, { op: 'flour', order: o.id }), /沿標記/)
  assert.equal(o.stage, 0)
  for (const [key, spec] of Object.entries(motions)) {
    const path = gesturePath(key, { angle: 270, rotation: 60 })
    assert.ok(checkTrace(key, path, { angle: 270, rotation: 60 }))
    assert.ok(!checkTrace(key, [path[0], path[0]], { angle: 270, rotation: 60 }))
  }
  o.leads.knead = a.id
  assert.deepEqual(eligible(o, r.players, 'top'), [b, c, d])
  assert.throws(() => act(r, a, o, 'top', { value: o.flavor }), /這一棒/)
  o.leads.top = b.id
  o.leads.bake = c.id
  assert.deepEqual(eligible(o, r.players, 'cut'), [d])
  disconnect(r, d)
  assert.ok(eligible(o, r.players, 'cut').length)
  disconnect(r, b)
  disconnect(r, c)
  assert.deepEqual(eligible(o, r.players, 'cut'), [a])
})
