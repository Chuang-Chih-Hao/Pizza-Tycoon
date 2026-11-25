export function drawDial(
  canvas,
  {
    deg = 90,
    rot = 0,
    r = 10,
    kind = 'cut',
    chosen = '',
    flavor = 1,
    split = 0,
    gold = 0,
    raw = false,
    knife = null,
    target = null,
  } = {},
) {
  const ctx = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height,
    scale = w / 360
  ctx.save()
  ctx.scale(scale, scale)
  const x = 180,
    y = 135,
    rad = kind === 'radius' || kind === 'dough' ? 48 + 4 * r : 96
  ctx.clearRect(0, 0, 360, h / scale)
  const a = ((rot - 90) * Math.PI) / 180,
    b = a + (deg * Math.PI) / 180
  const circle = (cx, cy, rr, fill) => {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(cx, cy, rr, 0, Math.PI * 2)
    ctx.fill()
  }
  circle(x + 3, y + 6, rad + 3, '#c4b590')
  circle(x, y, rad + 4, raw ? '#e5bc8d' : '#ae6336')
  circle(x, y, rad, raw ? '#f3d7b1' : '#ebaa5f')
  if (kind === 'dough' || kind === 'radius') {
    circle(x, y, rad, '#efd6ab')
    for (let i = 0; i < 16; i++) {
      const t = i * 2.4,
        rr = rad * (0.23 + 0.63 * Math.sqrt(i / 16))
      circle(x + Math.cos(t) * rr, y + Math.sin(t) * rr, 1.6, '#d8b78a')
    }
  } else {
    circle(x, y, rad * 0.905, '#b85434')
    circle(x, y, rad * 0.85, raw ? '#ffe7ba' : '#f6c86b')
    for (let i = 0; i < 26; i++) {
      const t = i * 2.4,
        rr = rad * (0.16 + 0.59 * Math.sqrt(i / 26)),
        cx = x + Math.cos(t) * rr,
        cy = y + Math.sin(t) * rr
      circle(
        cx,
        cy,
        rad * (i % 3 ? 0.065 : 0.085),
        ['#fff0ae', '#b74932', '#b6a184', '#efae37', '#ed9263', '#e5a92e'][flavor] || '#b44832',
      )
      if (i % 3 === 0) {
        ctx.save()
        ctx.translate(cx + 3, cy - 4)
        ctx.rotate(t)
        ctx.fillStyle = '#63874c'
        ctx.beginPath()
        ctx.ellipse(0, 0, 5, 2.5, 0, 0, 7)
        ctx.fill()
        ctx.restore()
      }
    }
  }
  if (!['dough', 'radius'].includes(kind)) {
    ctx.save()
    const mid = (a + b) / 2
    ctx.translate(Math.cos(mid) * split, Math.sin(mid) * split)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.arc(x, y, rad, a, b, false)
    ctx.closePath()
    ctx.fillStyle = gold ? '#efb62171' : '#fff3aa71'
    ctx.fill()
    ctx.strokeStyle = '#355948'
    ctx.lineWidth = 2.6
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, rad, a, b)
    ctx.strokeStyle = chosen === '弧' ? '#367d71' : '#bc5636'
    ctx.lineWidth = 6
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 26, a, b)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#426d5c'
    ctx.stroke()
    ctx.restore()
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + rad * Math.cos(b), y + rad * Math.sin(b))
    ctx.lineWidth = chosen === '半徑' ? 6 : 3
    ctx.strokeStyle = '#365f52'
    ctx.stroke()
    if (kind === 'cut') {
      circle(x + rad * Math.cos(b), y + rad * Math.sin(b), 8, '#fff4c8')
      ctx.strokeStyle = '#365f52'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = '#314d42'
      ctx.textAlign = 'center'
      ctx.font = 'bold 15px sans-serif'
      ctx.fillText(deg + '°', x + 48 * Math.cos((a + b) / 2), y + 48 * Math.sin((a + b) / 2))
    }
  }
  if (Number.isFinite(target)) {
    const end = a + (target * Math.PI) / 180
    ctx.save()
    ctx.strokeStyle = '#1b608c'
    ctx.lineWidth = 4
    ctx.setLineDash([7, 5])
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (rad + 7) * Math.cos(end), y + (rad + 7) * Math.sin(end))
    ctx.stroke()
    ctx.setLineDash([])
    circle(x + (rad + 8) * Math.cos(end), y + (rad + 8) * Math.sin(end), 4, '#1b608c')
    ctx.restore()
  }
  if (knife !== null) {
    const u = Math.min(1, knife * 1.75)
    ctx.save()
    ctx.translate(x + Math.cos(b) * rad * u, y + Math.sin(b) * rad * u)
    ctx.rotate(b + 0.3)
    ctx.fillStyle = '#79533b'
    ctx.fillRect(-31, -4, 25, 8)
    circle(0, 0, 10, '#a9b9b2')
    circle(0, 0, 3, '#58665d')
    ctx.restore()
  }
  circle(x, y, chosen === '圓心' ? 8 : 5, '#294d40')
  if (kind === 'radius' || kind === 'dough') {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + rad, y)
    ctx.strokeStyle = '#47725e'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = '#324c41'
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText(kind === 'radius' ? 'r = ?' : 'r = ' + r + ' cm', x + 7, y - 7)
  }
  ctx.restore()
}
export function attachDial(canvas, opts, onChange) {
  const click = (e) => {
    const rect = canvas.getBoundingClientRect(),
      x = ((e.clientX - rect.left) * 360) / rect.width - 180,
      y = ((e.clientY - rect.top) * canvas.height) / (canvas.width / 360) / rect.height - 135
    if (opts.kind === 'cut') {
      const angle = ((Math.atan2(y, x) * 180) / Math.PI + 90 - (opts.rot || 0) + 720) % 360
      onChange(Math.min(359, Math.max(1, Math.round(angle))))
    } else if (['center', 'radiusLine'].includes(opts.kind)) {
      const dist = Math.hypot(x, y)
      const theta = ((opts.rot - 90) * Math.PI) / 180
      const local = (((Math.atan2(y, x) - theta) * 180) / Math.PI + 720) % 360
      const border = Math.min(local, 360 - local, Math.abs(local - opts.deg))
      if (dist < 13) onChange('圓心')
      else if (Math.abs(dist - 96) < 14 && local <= opts.deg + 4) onChange('弧')
      else if (dist < 102 && dist > 12 && border < 12) onChange('半徑')
    }
  }
  canvas.onpointerdown = (e) => {
    canvas.setPointerCapture(e.pointerId)
    click(e)
  }
  canvas.onpointermove = (e) => {
    if (e.buttons === 1 && opts.kind === 'cut') click(e)
  }
}
export class AudioDesk {
  constructor() {
    let saved = {}
    try {
      saved = JSON.parse(localStorage.getItem('pizza-audio') || '{}')
    } catch {}
    this.v = { music: 0, fx: 18, ...saved }
    this.step = 0
    this.active = false
  }
  wake() {
    try {
      this.ctx ??= new AudioContext()
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
      if (!this.timer)
        this.timer = setInterval(() => {
          if (!this.active || !this.v.music || document.hidden) return
          const notes = [48, 55, 60, 64, 53, 57, 60, 65, 55, 59, 62, 67, 50, 57, 62, 65]
          this.tone(
            440 * 2 ** ((notes[this.step++ % notes.length] - 69) / 12),
            0.19,
            'sine',
            this.v.music * 0.0009,
          )
        }, 370)
    } catch {}
  }
  tone(freq, dur, type, vol, delay = 0) {
    if (!this.ctx || !vol) return
    const t = this.ctx.currentTime + delay,
      osc = this.ctx.createOscillator(),
      g = this.ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + dur + 0.01)
  }
  play(k) {
    const notes = {
      step: [95],
      knead: [155, 122],
      top: [310, 400],
      cut: [670, 380],
      sale: [590, 780, 980],
      right: [510, 700],
      event: [366, 290, 366],
      upgrade: [390, 500, 650, 780],
      gold: [430, 540, 650, 860, 1060],
      arrival: [700, 550],
      oven: [850, 850],
      place: [270],
      box: [210, 320],
    }[k] || [360]
    notes.forEach((n, i) =>
      this.tone(
        n,
        k === 'step' ? 0.05 : 0.13,
        k === 'cut' ? 'triangle' : 'sine',
        this.v.fx * (k === 'step' ? 0.00016 : 0.0011),
        i * 0.083,
      ),
    )
  }
  set(k, v) {
    this.v[k] = +v
    localStorage.setItem('pizza-audio', JSON.stringify(this.v))
  }
}
