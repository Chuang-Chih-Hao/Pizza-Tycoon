import { motions, gesturePath, checkTrace } from './gestures.js'
const W = 520,
  H = 268
const circle = (c, x, y, r, color) => {
  c.fillStyle = color
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
}
function line(c, points, color, width) {
  c.strokeStyle = color
  c.lineWidth = width
  c.lineJoin = c.lineCap = 'round'
  c.beginPath()
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)))
  c.stroke()
}
function rect(c, x, y, w, h, color, r = 5) {
  c.fillStyle = color
  c.beginPath()
  c.roundRect(x, y, w, h, r)
  c.fill()
}
function pie(c, x, y, r, cheese = true) {
  circle(c, x, y + 4, r + 2, '#ae7544')
  circle(c, x, y, r, '#e7b879')
  if (!cheese) {
    circle(c, x, y, r - (0.9 * r) / 10, '#f4d9a6')
    return
  }
  circle(c, x, y, r * 0.88, '#bd5837')
  circle(c, x, y, r * 0.82, '#f4c768')
  for (let i = 0; i < 11; i++) {
    const a = i * 2.4,
      s = r * (0.21 + (i % 4) * 0.13)
    circle(c, x + Math.cos(a) * s, y + Math.sin(a) * s, r * 0.087, i % 3 ? '#bd543b' : '#658458')
  }
}
function crate(c, x, y) {
  rect(c, x - 25, y - 17, 50, 38, '#966a41')
  for (const d of [-11, 0, 11]) rect(c, x - 25, y + d, 50, 5, '#e2b579')
  for (const d of [-17, 17]) rect(c, x + d, y - 17, 4, 36, '#b18152')
}
function tool(c, key, x, y, t, progress, item) {
  c.save()
  c.translate(x, y)
  const icon = motions[key][2]
  if (icon === 'roll') {
    c.rotate(-0.16)
    line(
      c,
      [
        [-37, 0],
        [37, 0],
      ],
      '#8a5938',
      9,
    )
    rect(c, -24, -12, 48, 24, '#bc8456', 10)
    rect(c, -20, -9, 39, 6, '#e3b782', 4)
  } else if (icon === 'scoop') {
    line(
      c,
      [
        [-27, 12],
        [9, -6],
      ],
      '#78553b',
      7,
    )
    circle(c, 12, -6, 13, '#a5b4a9')
    circle(c, 12, -8, 10, '#fbebc7')
  } else if (icon === 'kit' || icon === 'crate') {
    crate(c, 0, 0)
    if (icon === 'kit')
      for (let i = 0; i < 4; i++)
        circle(
          c,
          -15 + i * 10,
          -13 + (i % 2) * 4,
          7,
          ['#b74b34', '#63834e', '#d8a041', '#f0d79e'][i],
        )
  } else if (icon === 'tray' || icon === 'peel') {
    rect(c, -30, 1, 60, 13, '#b0b9aa')
    if (icon === 'peel')
      line(
        c,
        [
          [-23, 4],
          [-55, 17],
        ],
        '#906139',
        7,
      )
    if (item === 'boxed') crate(c, 0, -2)
    else if (item === 'flour') {
      rect(c, -11, -21, 23, 26, '#e8d1a3')
      rect(c, -11, -21, 23, 5, '#b38b61')
    } else pie(c, 0, -4, 20, !['base', 'flour'].includes(item))
  } else if (icon === 'topping') {
    line(
      c,
      [
        [0, 0],
        [-20, -25],
        [0, -10],
        [11, -8],
      ],
      '#83988f',
      5,
    )
    circle(c, 6, 0, 7, '#bc5337')
    circle(c, 4, -1, 2, '#f0c079')
  } else if (icon === 'dial') {
    circle(c, 0, 0, 17, '#cda36b')
    circle(c, 0, 0, 11, '#4c5c50')
    line(
      c,
      [
        [0, 0],
        [6, -10],
      ],
      '#ffe19b',
      3,
    )
  } else if (icon === 'wheel') {
    line(
      c,
      [
        [-21, -22],
        [0, 0],
      ],
      '#77583f',
      8,
    )
    circle(c, 0, 0, 13, '#80968f')
    circle(c, 0, 0, 9, '#bdc9bd')
    circle(c, 0, 0, 3, '#53675a')
  } else if (icon === 'fold' || icon === 'serve') {
    rect(c, -26, -16, 52, 35, '#ad8256')
    rect(c, -26, -19, 52, 32, '#e9c996')
    circle(c, 0, -4, 8, '#bc5338')
  } else if (icon === 'net') {
    line(
      c,
      [
        [-27, 26],
        [0, 0],
      ],
      '#a6764c',
      6,
    )
    circle(c, 0, 0, 18, '#e1e7cc')
    for (let i = -1; i <= 1; i++) {
      line(
        c,
        [
          [i * 7 - 6, -10],
          [i * 7 + 6, 10],
        ],
        '#92a698',
        1.5,
      )
      line(
        c,
        [
          [i * 7 + 6, -10],
          [i * 7 - 6, 10],
        ],
        '#92a698',
        1.5,
      )
    }
  } else if (icon === 'mop') {
    line(
      c,
      [
        [-24, -24],
        [0, 2],
      ],
      '#ae865f',
      7,
    )
    rect(c, -14, 0, 35, 9, '#789c91')
    for (let i = 0; i < 7; i++)
      line(
        c,
        [
          [-13 + i * 5, 9],
          [-15 + i * 5, 16 + Math.sin(t + i) * 3],
        ],
        '#e1e5cc',
        3,
      )
  } else if (icon === 'wire') {
    line(
      c,
      [
        [-26, 19],
        [-10, 6],
        [4, 1],
      ],
      '#ae4e39',
      6,
    )
    rect(c, 1, -8, 17, 15, '#52685b')
    line(
      c,
      [
        [17, -4],
        [25, -4],
      ],
      '#c0a66b',
      3,
    )
    line(
      c,
      [
        [17, 3],
        [25, 3],
      ],
      '#c0a66b',
      3,
    )
  }
  c.restore()
}
export function paintMotion(canvas, key, options = {}, state = {}) {
  if (!canvas || !motions[key]) return
  const c = canvas.getContext('2d'),
    path = gesturePath(key, options),
    n = Math.min(state.step || 0, path.length - 1),
    pointer = state.pointer || path[0],
    t = (state.t || 0) / 1000
  const xy = (p) => [p[0] * W, p[1] * H],
    pts = path.map(xy)
  c.save()
  c.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0)
  const theme =
    { mouse: '#e1dcc1', leak: '#c9e1df', repair: '#d8dbce', duel: '#efdab1', delivery: '#d7e0c9' }[
      key
    ] || '#e9d6b2'
  rect(c, 0, 0, W, H, theme, 14)
  for (let i = 0; i < 5; i++)
    line(
      c,
      [
        [0, 32 + i * 54],
        [W, 32 + i * 54],
      ],
      '#90744927',
      1.5,
    )
  const icon = motions[key][2]
  if (['roll', 'wheel', 'topping'].includes(icon)) {
    const x = icon === 'topping' ? W * 0.69 : W * 0.5,
      y = H * 0.54
    c.save()
    c.translate(x, y)
    if (icon === 'roll') {
      const squash = 0.93 + 0.16 * Math.abs(pointer[0] - 0.18)
      c.scale(squash, 1.04 - 0.12 * n)
    }
    pie(c, 0, 0, icon === 'wheel' ? 90 : 67, icon !== 'roll' && icon !== 'topping')
    c.restore()
    if (icon === 'topping') {
      const a = ((options.rotation - 90) * Math.PI) / 180,
        b = a + ((options.angle || 90) * Math.PI) / 180
      c.fillStyle = '#efd079'
      c.beginPath()
      c.moveTo(x, y)
      c.arc(x, y, 61, a, b)
      c.fill()
      for (let i = 1; i < Math.min(state.step || 0, pts.length); i++) {
        circle(c, ...pts[i], 8, '#b94f34')
        circle(c, pts[i][0] - 2, pts[i][1] - 2, 2, '#e8ab7c')
      }
    }
    if (icon === 'wheel' && (state.step || 0) > 0) {
      line(c, [pts[0], xy(pointer)], '#825835', 3)
    }
    if (icon === 'wheel') {
      const a = ((options.rotation - 90) * Math.PI) / 180
      line(
        c,
        [
          [x, y],
          [x + 89 * Math.cos(a), y + 89 * Math.sin(a)],
        ],
        '#93784a',
        2,
      )
    }
  }
  if (icon === 'dial') {
    circle(c, W * 0.51, H * 0.55, 67, '#566a5c')
    circle(c, W * 0.51, H * 0.55, 55, '#9ca99a')
    for (let i = 0; i < 11; i++) {
      const a = 2.9 + i * 0.39
      line(
        c,
        [
          [W * 0.51 + Math.cos(a) * 57, H * 0.55 + Math.sin(a) * 57],
          [W * 0.51 + Math.cos(a) * 64, H * 0.55 + Math.sin(a) * 64],
        ],
        i > 6 ? '#f6b65e' : '#f6e8c5',
        3,
      )
    }
  }
  if (icon === 'peel') {
    rect(c, W * 0.68, 50, 140, 148, '#ae6e4f', 30)
    rect(c, W * 0.705, 74, 116, 109, '#51463a', 27)
    for (let i = 0; i < 5; i++)
      circle(c, W * 0.736 + i * 17, 153, 12 + Math.sin(t * 5 + i) * 3, '#eb9c45')
  }
  if (icon === 'fold') {
    rect(c, 186, 75, 148, 110, '#c8a073', 9)
    rect(c, 204, 87, 113, 83, '#ecd3a7')
    pie(c, 260, 128, 32)
    const flap = Math.max(0, Math.min(1, (pointer[0] - 0.22) / 0.28))
    rect(c, 151 + flap * 51, 88, 45 * (1 - 0.8 * flap), 82, '#d3ae7d')
    if (n >= 2) {
      const limit = Math.max(0.12, Math.min(1, (pointer[1] - 0.28) / 0.42))
      rect(c, 204, 87, 113, 83 * limit, '#e2bd89')
    }
  }
  if (icon === 'mop')
    for (let i = 0; i < 6; i++) {
      c.save()
      c.translate(105 + i * 51, 125 + Math.sin(i) * 18)
      c.scale(1, 0.4)
      circle(c, 0, 0, Math.max(5, 35 - n * 6), '#80bcc4')
      c.restore()
    }
  if (icon === 'wire') {
    rect(c, 43, 59, 440, 152, '#506456')
    for (let i = 0; i < 3; i++) {
      circle(c, 391, 84 + i * 42, 13, ['#b75743', '#dfb449', '#81a17c'][i])
      circle(c, 391, 84 + i * 42, 5, '#38483e')
    }
  }
  if (icon === 'crate') {
    rect(c, 344, 142, 96, 18, '#7b8b7a')
    for (const x of [362, 422]) circle(c, x, 168, 8, '#605f51')
  }
  if (icon === 'net') {
    c.save()
    c.translate(257 + Math.sin(t * 3) * 14, 143 + Math.cos(t * 3) * 6)
    c.scale(1, 0.7)
    circle(c, 0, 0, 17, '#82796a')
    circle(c, 17, -2, 10, '#958a79')
    circle(c, 15, -10, 5, '#c99f92')
    circle(c, 22, -4, 2, '#342e27')
    c.restore()
  }
  c.setLineDash([5, 8])
  line(c, pts, '#5d745b8c', 3)
  c.setLineDash([])
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i]
    const active = i === n
    circle(
      c,
      x,
      y,
      active ? 13 + Math.sin(t * 4) * 2 : 9,
      i < n ? '#52856d' : active ? '#d4933a' : '#fff5d8',
    )
    circle(c, x, y, 4, i < n ? '#f3f2cd' : '#856c45')
  }
  tool(c, key, ...xy(pointer), t, n, options.item)
  c.restore()
}
export function startMotion(canvas, key, options, change, done) {
  const path = gesturePath(key, options),
    status = { step: 0, pointer: path[0].slice() },
    trace = []
  let held = false,
    finished = false,
    frame = 0
  const clamp = (n) => Math.max(0, Math.min(1, n))
  function draw(ms) {
    if (!canvas.isConnected || !canvas.offsetWidth || finished) return
    paintMotion(canvas, key, options, { ...status, t: ms })
    frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
  const hit = (p, v) => Math.hypot((p[0] - v[0]) * 1.25, p[1] - v[1]) < 0.107
  function point(p) {
    status.pointer = p
    if (!held) return
    const target = path[status.step]
    if (target && hit(p, target)) {
      trace.push(p.slice())
      status.step++
      change(status)
    } else if (
      trace.length < 130 &&
      (!trace.length || Math.hypot(p[0] - trace.at(-1)[0], p[1] - trace.at(-1)[1]) > 0.065)
    )
      trace.push(p.slice())
  }
  function begin(p) {
    if (finished || !hit(p, path[0])) return
    trace.length = 0
    status.step = 0
    held = true
    point(p)
  }
  function end(p) {
    if (!held) return
    point(p)
    held = false
    trace.push(p.slice())
    if (status.step === path.length && checkTrace(key, trace, options)) {
      finished = true
      paintMotion(canvas, key, options, { ...status, t: performance.now() })
      cancelAnimationFrame(frame)
      done(trace)
    } else {
      status.step = 0
      status.pointer = path[0].slice()
      change(status, '沿著光點順序完成，再放開工具。')
    }
  }
  const pos = (e) => {
    const r = canvas.getBoundingClientRect()
    return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)]
  }
  canvas.onpointerdown = (e) => {
    e.preventDefault()
    canvas.focus({ preventScroll: true })
    canvas.setPointerCapture(e.pointerId)
    begin(pos(e))
  }
  canvas.onpointermove = (e) => {
    if (held) point(pos(e))
  }
  canvas.onpointerup = (e) => end(pos(e))
  canvas.onpointercancel = () => {
    held = false
    status.step = 0
    status.pointer = path[0].slice()
    change(status)
  }
  canvas.onkeydown = (e) => {
    const dirs = {
      ArrowLeft: [-0.035, 0],
      ArrowRight: [0.035, 0],
      ArrowUp: [0, -0.045],
      ArrowDown: [0, 0.045],
    }
    if (e.key === ' ') {
      e.preventDefault()
      if (!e.repeat) {
        if (held) end(status.pointer)
        else begin(path[0])
      }
    } else if (dirs[e.key]) {
      e.preventDefault()
      const d = dirs[e.key]
      point([clamp(status.pointer[0] + d[0]), clamp(status.pointer[1] + d[1])])
    }
  }
  return status
}
