import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { WebSocket } from 'ws'
import { makeServer } from '../server.js'
import { near, stations } from '../public/world.js'

async function client(url) {
  const ws = new WebSocket(url)
  const messages = [],
    pending = new Set()
  ws.on('message', (data) => {
    const m = JSON.parse(data)
    messages.push(m)
    for (const cb of [...pending]) cb()
  })
  await once(ws, 'open')
  function wait(pred, idx = 0) {
    return new Promise((resolve, reject) => {
      const check = () => {
        const m = messages.slice(idx).find(pred)
        if (m) {
          clearTimeout(timer)
          pending.delete(check)
          resolve(m)
        }
      }
      const timer = setTimeout(() => {
        pending.delete(check)
        reject(Error('Timed out waiting for room state'))
      }, 10000)
      pending.add(check)
      check()
    })
  }
  return {
    ws,
    wait,
    messages,
    send(op, data = {}) {
      const i = messages.length
      ws.send(JSON.stringify({ op, nonce: randomUUID(), ...data }))
      return i
    },
  }
}
test('teacher + four independent WebSockets share movement, race-safe items, pause, resume and report; room isolation', async (t) => {
  const { server, wss } = makeServer()
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
  const url = 'ws://127.0.0.1:' + server.address().port + '/play',
    sockets = []
  const open = async () => {
    const c = await client(url)
    sockets.push(c)
    return c
  }
  t.after(() => {
    for (const c of sockets) c.ws.terminate()
    wss.close()
    server.close()
  })
  const teacher = await open()
  teacher.send('create')
  const auth = await teacher.wait((m) => m.type === 'session')
  const crew = await Promise.all(
    Array.from({ length: 4 }, async (_, i) => {
      const c = await open()
      c.send('join', { name: '夥伴' + i, skin: i, code: auth.code })
      c.session = await c.wait((m) => m.type === 'session')
      return c
    }),
  )
  const separate = await open()
  separate.send('create')
  const other = (await separate.wait((m) => m.type === 'session')).code
  assert.notEqual(auth.code, other)
  const full = await open()
  full.send('join', { name: '第五位', code: auth.code })
  assert.match((await full.wait((m) => m.type === 'error')).message, /已滿/)
  teacher.send('start')
  const state = (await crew[0].wait((m) => m.type === 'state' && m.state.status === 'playing'))
    .state
  assert.equal(state.players.length, 4)
  const order = state.orders[0].id
  for (const c of crew.slice(0, 2)) c.send('walk', { x: stations.pantry.x, z: stations.pantry.z })
  await teacher.wait(
    (m) =>
      m.type === 'state' &&
      crew.slice(0, 2).every((c) => {
        const p = m.state.players.find((p) => p.id === c.session.id)
        return p && near(p, stations.pantry)
      }),
  )
  const same = randomUUID()
  for (const c of crew.slice(0, 2)) c.send('flour', { order, nonce: same })
  const won = (
    await crew[3].wait(
      (m) => m.type === 'state' && m.state.players.some((p) => p.hand?.id === order),
    )
  ).state
  assert.equal(won.players.filter((p) => p.hand?.id === order).length, 1)
  const owner = crew.find((c) => won.players.some((p) => p.id === c.session.id && p.hand))
  owner.send('flour', { order, nonce: same })
  owner.ws.terminate()
  const lost = (
    await teacher.wait((m) => m.type === 'state' && m.state.orders[0]?.item.loc === 'floor')
  ).state
  assert.equal(lost.players.filter((p) => p.online).length, 3)
  const fresh = await open()
  fresh.send('restore', { code: auth.code, token: owner.session.token })
  const restored = await fresh.wait((m) => m.type === 'session')
  assert.equal(restored.id, owner.session.id)
  const i = teacher.send('pause')
  await teacher.wait((m) => m.type === 'state' && m.state.status === 'paused', i)
  const j = teacher.send('resume')
  await teacher.wait((m) => m.type === 'state' && m.state.status === 'playing', j)
  teacher.send('end')
  assert.equal(
    (await fresh.wait((m) => m.type === 'state' && m.state.status === 'ended')).state.status,
    'ended',
  )
  assert.ok(
    separate.messages
      .filter((m) => m.type === 'state')
      .every((m) => m.state.code === other && m.state.players.length === 0),
  )
})
