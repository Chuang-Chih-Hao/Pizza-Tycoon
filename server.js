import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { randomInt } from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'
import { room, addPlayer, command, tick, disconnect, reconnect, snapshot } from './game.js'
const base = new URL('./public/', import.meta.url),
  vendor = new URL('./node_modules/three/', import.meta.url)
const ext = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
}
const allowed = new Set([
  'index.html',
  'app.js',
  'world.js',
  'scene.js',
  'models.js',
  'workbench.js',
  'style.css',
  'icon.svg',
  'vendor/build/three.module.js',
  'vendor/build/three.core.js',
  'vendor/examples/jsm/geometries/RoundedBoxGeometry.js',
  'vendor/examples/jsm/utils/BufferGeometryUtils.js',
])
export function makeServer() {
  const rooms = new Map(),
    peers = new Map()
  const server = http.createServer(async (req, res) => {
    let path
    try {
      path = new URL(req.url, 'http://localhost').pathname
    } catch {
      res.writeHead(400)
      res.end()
      return
    }
    if (path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, version: '1.1.0' }))
      return
    }
    const name = path === '/' ? 'index.html' : path.slice(1)
    if (!allowed.has(name)) {
      res.writeHead(404)
      res.end()
      return
    }
    const url = name.startsWith('vendor/') ? new URL(name.slice(7), vendor) : new URL(name, base)
    try {
      const body = await readFile(url)
      res.writeHead(200, {
        'Content-Type': ext[name.split('.').at(-1)] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  })
  const wss = new WebSocketServer({
    server,
    path: '/play',
    maxPayload: 8192,
    perMessageDeflate: false,
  })
  const send = (ws, obj) => {
    if (ws.readyState === WebSocket.OPEN && (obj.type !== 'state' || ws.bufferedAmount < 90000))
      ws.send(JSON.stringify(obj))
  }
  function broadcast(r) {
    for (const [ws, v] of peers) if (v.r === r) send(ws, { type: 'state', state: snapshot(r, v.p) })
  }
  function attach(ws, r, p) {
    for (const [old, v] of peers)
      if (v.r === r && v.p === p) {
        peers.delete(old)
        old.close(4001, 'replaced')
      }
    peers.set(ws, { r, p })
    if (p) reconnect(r, p)
    r.emptySince = null
    send(ws, { type: 'session', code: r.code, id: p?.id ?? 'host', token: p?.token ?? r.host })
    broadcast(r)
  }
  wss.on('connection', (ws) => {
    ws.alive = true
    ws.on('pong', () => (ws.alive = true))
    let burst = 0,
      epoch = Date.now()
    ws.on('message', (raw) => {
      let m
      try {
        m = JSON.parse(raw)
        if (!m || typeof m !== 'object') throw Error('資料格式無效。')
        if (Date.now() - epoch > 1000) {
          epoch = Date.now()
          burst = 0
        }
        if (++burst > 60) throw Error('操作太快，請稍候。')
        const v = peers.get(ws)
        if (!v) {
          if (m.op === 'create') {
            let code
            do {
              code = String(randomInt(100000, 1000000))
            } while (rooms.has(code))
            const r = room(code)
            rooms.set(code, r)
            attach(ws, r, null)
            return
          }
          const r = rooms.get(String(m.code))
          if (!r) throw Error('找不到這個房間，請核對六位代碼。')
          if (m.op === 'join') {
            attach(ws, r, addPlayer(r, m.name, m.skin))
            return
          }
          if (m.op === 'restore') {
            const p = r.players.find((p) => p.token === m.token)
            if (!p && r.host !== m.token) throw Error('登入憑證失效，請重新加入。')
            attach(ws, r, p ?? null)
            return
          }
          throw Error('請先進入房間。')
        }
        const { r, p } = v
        const seen = p ? p.inputs : (r.hostInputs ??= new Set())
        if (typeof m.nonce !== 'string' || seen.has(m.nonce)) return
        seen.add(m.nonce)
        if (seen.size > 512) seen.delete(seen.values().next().value)
        const result = command(r, p, m)
        if (m.op !== 'move' && m.op !== 'walk') {
          send(ws, { type: 'ack', op: m.op, nonce: m.nonce, ...result })
          broadcast(r)
        }
      } catch (e) {
        send(ws, { type: 'error', op: m?.op, message: e.message })
      }
    })
    ws.on('close', () => {
      const v = peers.get(ws)
      peers.delete(ws)
      if (!v) return
      if (v.p) disconnect(v.r, v.p)
      if (![...peers.values()].some((s) => s.r === v.r)) v.r.emptySince = Date.now()
      broadcast(v.r)
    })
  })
  let last = Date.now(),
    beat = 0
  const timer = setInterval(() => {
    const now = Date.now(),
      dt = Math.min(0.5, (now - last) / 1000)
    last = now
    beat++
    for (const [code, r] of rooms) {
      if (r.emptySince && now - r.emptySince > 3600000) {
        rooms.delete(code)
        continue
      }
      tick(r, dt)
      if (beat % 3 === 0 && r.status !== 'lobby') broadcast(r)
    }
    if (beat % 500 === 0)
      for (const ws of wss.clients) {
        if (!ws.alive) ws.terminate()
        else {
          ws.alive = false
          ws.ping()
        }
      }
  }, 50)
  timer.unref()
  server.on('close', () => clearInterval(timer))
  return { server, wss, rooms }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server } = makeServer()
  server.listen(Number(process.env.PORT) || 3000, '0.0.0.0', () =>
    console.log('Golden Slice kitchen listening on', server.address().port),
  )
}
