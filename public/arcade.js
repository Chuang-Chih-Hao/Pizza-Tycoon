import {
  activities,
  validActivity,
  flourTarget,
  flourWeight,
  kitBins,
  cargoBin,
  cargoCode,
  shelfShift,
  powerStart,
  flipPower,
  beatPeriod,
  beatAt,
  mouseAt,
} from './activities.js'

const W = 600,
  H = 300,
  binX = (i) => 120 + i * 180
const dark = '#263e37',
  ivory = '#fff1cd',
  copper = '#cc8550'
const names = ['番茄', '香菇', '玉米', '羅勒', '臘腸', '鳳梨', '鮮蝦', '起司']
const recipes = [
  [0, 3],
  [4, 7],
  [1, 3],
  [5, 7],
  [6, 0],
  [2, 7],
]
function binsForOrder(seed, flavor) {
  const picked = kitBins(seed),
    recipe = recipes[flavor] || recipes[0]
  const bins = [0, 0, 0]
  bins[picked[0]] = recipe[0]
  bins[picked[1]] = recipe[1]
  const extras = names.map((_, i) => i).filter((i) => !recipe.includes(i))
  bins[3 - picked[0] - picked[1]] = extras[seed % extras.length]
  return bins
}
const cargo = ['冷藏起司', '田園蔬菜', '冷凍鮮蝦']
function disk(c, x, y, r, color) {
  c.fillStyle = color
  c.beginPath()
  c.arc(x, y, r, 0, 7)
  c.fill()
}
function panel(c, x, y, w, h, color, r = 9) {
  c.fillStyle = color
  c.beginPath()
  c.roundRect(x, y, w, h, r)
  c.fill()
}
function line(c, x, y, u, v, color, width = 4) {
  c.strokeStyle = color
  c.lineWidth = width
  c.lineCap = 'round'
  c.beginPath()
  c.moveTo(x, y)
  c.lineTo(u, v)
  c.stroke()
}
function label(c, text, x, y, size = 19, color = dark) {
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.font = 'bold ' + size + 'px system-ui,sans-serif'
  c.fillStyle = color
  c.fillText(text, x, y, 570)
}
function food(c, x, y, i) {
  if (i === 0) {
    disk(c, x, y, 25, '#c3533b')
    for (let n = 0; n < 5; n++)
      line(c, x, y - 21, x + Math.cos(n * 1.25) * 13, y - 21 + Math.sin(n * 1.25) * 6, '#597a4c', 4)
  }
  if (i === 1) {
    panel(c, x - 8, y - 4, 16, 31, '#f0d099')
    c.fillStyle = '#986c47'
    c.beginPath()
    c.arc(x, y, 26, Math.PI, Math.PI * 2)
    c.fill()
    disk(c, x - 8, y - 12, 4, '#dfab72')
  }
  if (i === 3) {
    c.fillStyle = '#5e8a55'
    c.beginPath()
    c.ellipse(x, y, 17, 28, 0.57, 0, 7)
    c.fill()
    line(c, x - 9, y + 19, x + 9, y - 17, '#a9c38b', 2)
  }
  if (i === 4) {
    disk(c, x, y, 24, '#a84838')
    for (const [dx, dy] of [
      [4, 10],
      [-9, -8],
      [8, -9],
    ])
      disk(c, x + dx, y + dy, 4, '#e6ac86')
  }
  if (i === 5 || i === 7) {
    c.fillStyle = i === 5 ? '#e7ae38' : '#edc65f'
    c.beginPath()
    c.moveTo(x - 28, y + 17)
    c.lineTo(x - 14, y - 23)
    c.lineTo(x + 29, y + 13)
    c.closePath()
    c.fill()
    for (let n = 0; n < 3; n++) disk(c, x - 13 + n * 9, y + 5 - (n % 2) * 9, 3, '#d6a34a')
  }
  if (i === 6) {
    c.strokeStyle = '#da8f78'
    c.lineWidth = 13
    c.beginPath()
    c.arc(x, y, 17, -1.8, 2.5)
    c.stroke()
    disk(c, x - 4, y - 19, 3, dark)
  }
  if (i === 2) {
    panel(c, x - 13, y - 26, 26, 50, '#e6b442', 13)
    for (let n = 0; n < 8; n++)
      disk(c, x - 6 + (n % 2) * 11, y - 18 + Math.floor(n / 2) * 10, 3, '#ffe68b')
    line(c, x - 16, y + 3, x, y + 25, '#759358', 8)
  }
}
export function paintActivity(canvas, key, opt, st) {
  const c = canvas.getContext('2d'),
    seed = opt.seed,
    ms = st.elapsed || 0,
    step = st.step || 0
  c.save()
  c.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0)
  const theme = {
    flour: '#e7cfaa',
    kit: '#d6dfc0',
    mouse: '#dbccac',
    leak: '#c9e4e0',
    delivery: '#e4d2b7',
    repair: '#41554d',
    duel: '#edcf9f',
  }[key]
  panel(c, 0, 0, W, H, theme, 15)
  if (key === 'flour') {
    const grams = st.reading || 0,
      goal = flourTarget(seed)
    label(c, '秤出 ' + goal + ' 克麵粉', 300, 34, 25)
    panel(c, 76, 227, 448, 26, '#aa8760')
    panel(c, 155, 165, 145, 64, '#5f837e')
    panel(c, 169, 176, 117, 37, '#ecf3cf')
    label(c, grams + ' g', 227, 196, 23)
    panel(c, 148, 153, 160, 12, '#798b87')
    c.fillStyle = '#b25f44'
    c.beginPath()
    c.ellipse(225, 129, 69, 34, 0, 0, Math.PI)
    c.fill()
    c.fillStyle = '#fbebbc'
    c.beginPath()
    c.ellipse(225, 128, 58, Math.min(24, 3 + grams / 6), 0, 0, 7)
    c.fill()
    if (grams > 0)
      for (let i = 0; i < 12; i++)
        disk(c, 225 + Math.sin(i * 8) * 9, 65 + ((ms / 5 + i * 7) % 62), 2, '#fff6da')
    panel(c, 374, 66, 42, 140, '#f6e6c7')
    panel(c, 374, 195 - (goal + 9) * 0.77, 42, 18 * 0.77, '#76a47c')
    line(c, 366, 195 - grams * 0.77, 422, 195 - grams * 0.77, '#934a38', 5)
    label(c, '目標區', 457, 195 - goal * 0.77, 17)
  } else if (key === 'kit' || key === 'delivery') {
    const isKit = key === 'kit',
      foods = binsForOrder(seed, opt.flavor),
      list = isKit
        ? foods.map((i) => names[i])
        : [0, 1, 2].map((i) => cargo[(i - shelfShift(seed) + 3) % 3]),
      goals = kitBins(seed),
      target = isKit ? goals[Math.min(step, 1)] : cargoBin(seed)
    label(
      c,
      isKit
        ? '採買單　' + list[goals[0]] + ' → ' + list[goals[1]]
        : (opt.cargo ? '入庫單　' : '提貨單　') + cargo[cargoCode(seed)],
      300,
      35,
      23,
    )
    for (let i = 0; i < 3; i++) {
      const x = binX(i)
      panel(c, x - 74, 83, 148, 145, isKit ? '#b48655' : opt.cargo ? '#719095' : '#a67851')
      panel(c, x - 64, 92, 128, 99, isKit ? '#f4e4be' : '#ddbb85')
      if (isKit) food(c, x, 146, foods[i])
      else {
        const code = cargo.indexOf(list[i])
        panel(c, x - 30, 115, 60, 49, ['#d2ad58', '#739157', '#c48268'][code])
        line(c, x, 116, x, 163, '#ffe6b5', 7)
        label(c, ['乳', '菜', '蝦'][code], x, 141, 18)
      }
      label(c, list[i], x, 209, 18, ivory)
      label(c, String(i + 1), x, 253, 16)
    }
    if (isKit)
      label(c, step ? '第一樣已入籃，接著找' + list[target] : '先找' + list[target], 300, 279, 15)
  } else if (key === 'mouse') {
    label(c, '等牠探頭，再出手！　' + step + ' / 2', 300, 36, 24)
    for (let i = 0; i < 3; i++) {
      const x = binX(i)
      c.fillStyle = '#76664f'
      c.beginPath()
      c.ellipse(x, 198, 58, 19, 0, 0, 7)
      c.fill()
      label(c, String(i + 1), x, 249)
    }
    const m = mouseAt(ms, seed)
    if (m.visible) {
      const x = m.x * W,
        y = m.y * H
      disk(c, x, y, 27, '#81796c')
      disk(c, x - 20, y - 23, 12, '#a9887f')
      disk(c, x + 19, y - 22, 11, '#b6968b')
      disk(c, x - 10, y - 3, 3, '#282f28')
      disk(c, x + 9, y - 3, 3, '#282f28')
      disk(c, x, y + 6, 4, '#d59988')
    }
  } else if (key === 'leak') {
    const degrees = st.reading || 0,
      angle = (degrees * Math.PI) / 180
    label(c, '順時針關閥　' + Math.min(100, Math.round((degrees / 345) * 100)) + '%', 300, 32, 23)
    line(c, 68, 173, 496, 173, '#668c88', 24)
    line(c, 488, 173, 488, 202, '#668c88', 23)
    for (let i = 0; i < 8; i++) {
      const v = (ms / 680 + i / 8) % 1
      disk(
        c,
        488 + Math.sin(i) * v * 20,
        199 + v * (70 - 0.15 * degrees),
        3 + 2 * (1 - degrees / 360),
        '#549bb2',
      )
    }
    disk(c, 300, 158, 68, '#a44f42')
    disk(c, 300, 158, 52, theme)
    for (let i = 0; i < 4; i++)
      line(
        c,
        300,
        158,
        300 + Math.cos(angle + (i * Math.PI) / 2) * 60,
        158 + Math.sin(angle + (i * Math.PI) / 2) * 60,
        copper,
        9,
      )
    disk(c, 300, 158, 17, '#9d5843')
    disk(c, 300 + Math.cos(angle) * 60, 158 + Math.sin(angle) * 60, 7, '#ffdfa2')
  } else if (key === 'repair') {
    const mask = st.reading ?? powerStart(seed)
    label(c, '讓三路電源同時亮起', 300, 35, 24, ivory)
    for (let i = 0; i < 3; i++) {
      const x = binX(i),
        on = !!(mask & (1 << i))
      if (i < 2) line(c, x, 103, x + 180, 103, '#c5ae78', 5)
      disk(c, x, 103, 31, '#263d37')
      disk(c, x, 103, on ? 22 : 17, on ? '#ffdc75' : '#839084')
      label(c, on ? '亮' : '暗', x, 104, 15)
      panel(c, x - 39, 163, 78, 67, '#263d37')
      line(c, x, 211, x + (on ? 14 : -14), 180, on ? '#dabe80' : '#a6aaa1', 8)
      label(c, String(i + 1), x, 253, 18, ivory)
    }
  } else if (key === 'duel') {
    const per = beatPeriod(seed),
      phase = (ms % per) / per,
      hit = beatAt(ms, seed).good
    label(c, '光圈碰到金環時拍下　' + step + ' / 3', 300, 31, 23)
    c.save()
    c.translate(300, 161)
    c.scale(1, 0.72)
    disk(c, 0, 11, 69, '#bd8453')
    disk(c, 0, 0, 69, '#f6d98c')
    c.restore()
    c.strokeStyle = '#ad793e'
    c.lineWidth = 4
    c.beginPath()
    c.arc(300, 159, 65, 0, 7)
    c.stroke()
    c.strokeStyle = hit ? '#538369' : '#fff3ce'
    c.lineWidth = 7
    c.beginPath()
    c.arc(300, 159, 65 + (hit ? 0 : 54 * (1 - phase)), 0, 7)
    c.stroke()
    label(c, hit ? '拍！' : '準備', 300, 160, 25)
  }
  c.restore()
}
export function activityProgress(key, opt, state) {
  const step = state.step || 0
  switch (key) {
    case 'flour':
      return (state.reading || 0) + ' / ' + flourTarget(opt.seed) + ' 克'
    case 'kit':
      return '入籃 ' + step + ' / 2'
    case 'mouse':
      return '捉到 ' + step + ' / 2 次'
    case 'leak':
      return '閥輪 ' + Math.min(100, Math.round(((state.reading || 0) * 100) / 345)) + '%'
    case 'duel':
      return '合拍 ' + step + ' / 3 次'
    case 'repair':
      return (
        '電源亮燈 ' +
        [1, 2, 4].filter((bit) => (state.reading ?? powerStart(opt.seed)) & bit).length +
        ' / 3'
      )
    case 'delivery':
      return opt.cargo ? '第二站・冷藏架' : '第一站・收貨口'
  }
}
export function startActivity(canvas, key, opt, change, done, active, beatSound) {
  const st = {
    step: 0,
    elapsed: 0,
    reading: key === 'repair' ? powerStart(opt.seed) : 0,
    pointer: [0.5, 0.5],
  }
  let input = [],
    finished = false,
    last = performance.now(),
    heldAt = null,
    previous = null,
    lastDraw = 0,
    lastBeat = 0
  const fail = (msg) => change(st, msg)
  function accept() {
    if (!validActivity(key, opt.seed, input)) return false
    finished = true
    change(st, '完成！')
    done(input.slice())
    return true
  }
  function turn(deg) {
    if (previous === null) {
      previous = deg
      input = [deg]
      return
    }
    const delta = ((deg - previous + 540) % 360) - 180
    if (Math.abs(delta) > 65 || input.length >= 62) {
      previous = null
      input = []
      st.reading = 0
      fail('慢一點，握住輪緣重新轉一圈。')
      return
    }
    if (Math.abs(delta) < 6) return
    input.push(deg)
    previous = deg
    st.reading = Math.max(0, st.reading + delta)
    st.step = Math.floor(st.reading / 90)
    change(st)
    accept()
  }
  function hit(i, pt) {
    if (finished || !active()) return
    const ms = Math.round(st.elapsed),
      seed = opt.seed
    if (key === 'kit') {
      if (i !== kitBins(seed)[input.length]) {
        input = []
        st.step = 0
        fail('食材不同，照採買單從第一樣再找一次。')
        return
      }
      input.push(i)
      st.step = input.length
    } else if (key === 'delivery') {
      input = [i]
      if (i !== cargoBin(seed)) {
        fail('標籤對不上，再看一次貨單。')
        return
      }
      st.step = 1
    } else if (key === 'repair') {
      if (input.length >= 60) {
        input = []
        st.reading = powerStart(seed)
      }
      input.push(i)
      st.reading = flipPower(st.reading, i)
      st.step = [1, 2, 4].filter((b) => b & st.reading).length
    } else if (key === 'duel') {
      const b = beatAt(ms, seed)
      if (!b.good || input.some((n) => beatAt(n, seed).beat === b.beat)) {
        fail('看金環，等下一拍再試。')
        return
      }
      input.push(ms)
      st.step = input.length
    } else if (key === 'mouse') {
      const m = mouseAt(ms, seed)
      const coords = pt || [binX(i) / W, m.y]
      if (
        !m.visible ||
        Math.hypot((coords[0] - m.x) * 1.75, coords[1] - m.y) >= 0.15 ||
        input.some((h) => mouseAt(h[0], seed).cycle === m.cycle)
      ) {
        fail('牠躲開了！等下次探頭。')
        return
      }
      input.push([ms, ...coords])
      st.pointer = coords
      st.step = input.length
    }
    change(st, '')
    accept()
  }
  function pourStart() {
    if (heldAt === null) heldAt = st.elapsed
  }
  function pourEnd() {
    if (heldAt === null || finished) return
    input = [Math.round(st.elapsed - heldAt)]
    heldAt = null
    st.reading = flourWeight(input[0])
    if (!accept())
      fail('秤到 ' + st.reading + ' 克，目標 ' + flourTarget(opt.seed) + ' 克。按住重秤。')
  }
  function coords(e) {
    const b = canvas.getBoundingClientRect()
    return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height]
  }
  const rotation = ([x, y]) => (Math.atan2(y * H - 158, x * W - 300) * 180) / Math.PI
  let rotating = false
  canvas.onpointerdown = (e) => {
    if (finished || !active()) return
    e.preventDefault()
    canvas.focus({ preventScroll: true })
    canvas.setPointerCapture(e.pointerId)
    const pt = coords(e)
    st.pointer = pt
    if (key === 'flour') pourStart()
    else if (key === 'leak') {
      const r = Math.hypot(pt[0] * W - 300, pt[1] * H - 158)
      if (r < 32 || r > 94) {
        fail('從紅色輪緣開始轉。')
        return
      }
      rotating = true
      previous = null
      st.reading = 0
      st.step = 0
      turn(rotation(pt))
    } else if (key === 'mouse') {
      hit(0, pt)
    } else if (key === 'duel') {
      if (Math.hypot((pt[0] * W - 300) / 77, (pt[1] * H - 160) / 65) <= 1) hit(0)
      else fail('把手放在中央的麵團上，再跟著光圈拍下。')
    } else {
      const i = Math.max(0, Math.min(2, Math.floor(pt[0] * 3)))
      const inColumn = Math.abs(pt[0] * W - binX(i)) < (key === 'repair' ? 47 : 78)
      if (inColumn && pt[1] > 0.25 && pt[1] < 0.88) hit(i, pt)
    }
  }
  canvas.onpointermove = (e) => {
    if (rotating && !finished && active()) turn(rotation(coords(e)))
  }
  canvas.onpointerup = () => {
    rotating = false
    if (key === 'flour' && active()) pourEnd()
  }
  canvas.onpointercancel = () => {
    rotating = false
    heldAt = null
  }
  canvas.onkeydown = (e) => {
    if (![' ', '1', '2', '3', 'ArrowRight'].includes(e.key)) return
    e.preventDefault()
    if (e.repeat || finished || !active()) return
    if (key === 'flour' && e.key === ' ') pourStart()
    else if (key === 'duel' && e.key === ' ') hit(0)
    else if (key === 'leak' && e.key === 'ArrowRight') {
      if (previous === null) turn(0)
      turn(((previous + 45 + 540) % 360) - 180)
    } else if (['1', '2', '3'].includes(e.key) && !['flour', 'duel', 'leak'].includes(key))
      hit(Number(e.key) - 1)
  }
  canvas.onkeyup = (e) => {
    if (e.key === ' ' && key === 'flour' && active()) pourEnd()
  }
  function frame(now) {
    if (!canvas.isConnected || !canvas.offsetWidth || finished) return
    if (active()) st.elapsed += Math.min(120, now - last)
    last = now
    if (heldAt !== null) st.reading = flourWeight(st.elapsed - heldAt)
    if (key === 'duel' && Math.floor(st.elapsed / beatPeriod(opt.seed)) > lastBeat) {
      lastBeat = Math.floor(st.elapsed / beatPeriod(opt.seed))
      beatSound?.()
    }
    canvas.dataset.reading = Math.round(st.reading)
    canvas.dataset.elapsed = Math.round(st.elapsed)
    canvas.dataset.activity = key
    paintActivity(canvas, key, opt, st)
    if (now - lastDraw > 260) {
      change(st)
      lastDraw = now
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  return st
}
