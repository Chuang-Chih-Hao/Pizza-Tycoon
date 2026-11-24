import {
  stations,
  skins,
  flavors,
  toppings,
  stages,
  stationFor,
  itemNames,
  near,
  eventPoint,
} from './world.js'
import { eligible, roleFor, roleNames, craftLabels, availableMath } from './brigade.js'
import { motions, gesturePath, motionOptions } from './gestures.js'
import { startMotion, paintMotion } from './operation.js'
import { drawDial, attachDial, AudioDesk } from './workbench.js'
const $ = (id) => document.getElementById(id),
  esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    )
const audio = new AudioDesk(),
  dlg = $('dialog'),
  modal = $('modal'),
  host = () => identity?.id === 'host'
let socket,
  identity,
  state,
  roomState = '',
  selected = 0,
  skin = 0,
  kitchen,
  dialogMode = '',
  bench = '',
  panelKey = '',
  cardsKey = '',
  rosterKey = '',
  nextVisit = null,
  walkKeys = new Set(),
  actionMemory = {},
  lastNews = 0,
  newsUntil = 0,
  fxId = 0,
  quality = localStorage.getItem('pizza-low') === '1',
  retry = 0,
  toastTimer,
  feedback = '',
  cutFx = 0
let lastCoach = 0,
  lastPlayerCount = 0,
  motion = null,
  seenView = '',
  observedId = '',
  motionReturn = null
const multi = () => state?.players.filter((p) => p.online).length > 1
function canLead(o, p, k) {
  return eligible(o, state.players, k).some((c) => c.id === p.id)
}
function stageLead(o) {
  return { 1: 'knead', 2: 'top', 3: 'bake', 5: 'cut' }[o.stage]
}
function liveQuestion(o, p) {
  return o?.tasks.find(
    (q) => q.station === bench && q.owner === p?.id && availableMath(o, q, multi()),
  )
}
function openMotion(op, data = {}) {
  const o = state.orders.find((v) => v.id === data.order),
    kind = op === 'event' ? state.event?.kind : op
  if (!motions[kind] || state.status !== 'playing') return
  const opt = {
    ...motionOptions(op, o, data.value),
    item: me()?.hand?.type || o?.item.type || 'base',
  }
  motionReturn = { mode: dialogMode, station: bench, op }
  const [title, instruction] = motions[kind]
  show(
    'motion',
    'HANDS-ON KITCHEN',
    '<h2>' +
      esc(title) +
      '</h2><p>' +
      esc(instruction) +
      '</p><canvas id="gesture" width="780" height="402" tabindex="0" aria-label="' +
      esc(instruction) +
      '"></canvas><div class="gestureline"><b id="gesturestep"></b><span>拖曳操作　·　鍵盤可用空白鍵抓放、方向鍵移動</span></div><p id="feedback" class="feedback"></p>',
  )
  motion = { kind, opt, step: 0, pointer: gesturePath(kind, opt)[0], pending: false }
  const progress = (st, msg) => {
    if (!motion) return
    motion.step = st.step
    motion.pointer = st.pointer
    $('gesturestep').textContent =
      Math.min(st.step, gesturePath(kind, opt).length) + ' / ' + gesturePath(kind, opt).length
    if (msg) {
      feedback = msg
      showFeedback()
    }
    viewNow()
  }
  progress(motion)
  motion.live = startMotion($('gesture'), kind, opt, progress, (trace) => {
    if (!motion) return
    motion.pending = true
    send(op, { ...data, trace })
    audio.play(kind === 'cut' ? 'cut' : kind === 'knead' ? 'knead' : 'place')
  })
  $('gesture').focus({ preventScroll: true })
}
function afterMotion(result) {
  if (dialogMode !== 'motion' || !motionReturn) return
  const back = motionReturn
  close()
  if (!result) {
    toast('工作狀態已更新，可再回工作桌重試。')
    return
  }
  if (
    back.mode === 'station' &&
    stations[back.station] &&
    !['flour', 'kit', 'pickup', 'unbake', 'serve', 'addkit'].includes(back.op)
  )
    openStation(back.station)
}
function viewNow() {
  const p = me()
  if (!p || !state || !['lobby', 'playing', 'paused', 'ended'].includes(state.status)) return
  const o = order(),
    q = dialogMode === 'station' ? liveQuestion(o, p) : null,
    dial = $('degrees'),
    rad = $('radius'),
    m = dialogMode === 'motion' ? motion : null
  const title = dlg.open
    ? modal.querySelector('h2')?.textContent
    : state.status === 'lobby'
      ? '開店準備'
      : state.status === 'ended'
        ? '打烊成果'
        : '廚房走道'
  const v = {
    page: dialogMode || state.status,
    station: bench,
    order: selected,
    task: q?.id || '',
    heading: title || '',
    draft: $('answer')?.value || '',
    angle: dial ? +dial.value : (m?.opt.angle ?? (q ? (360 * q.f[0]) / q.f[1] : 0)),
    rotation: m?.opt.rotation ?? q?.rotation ?? o?.rotation ?? 0,
    radius: rad ? +rad.value : o?.r || 0,
    feedback: $('feedback')?.textContent || '',
    controls: (dlg.open
      ? [...modal.querySelectorAll('button,select')]
          .filter((el) => !el.closest('details:not([open])'))
          .map((el) =>
            el.tagName === 'SELECT' ? el.selectedOptions[0]?.textContent : el.textContent,
          )
          .filter(Boolean)
          .slice(0, 7)
          .join('、')
      : $('mission')?.textContent || ''
    ).slice(0, 180),
    tool: m?.kind || '',
    step: m?.live?.step ?? m?.step ?? 0,
    pointer: (m?.live?.pointer ?? m?.pointer)?.map((v) => +v.toFixed(2)) || null,
    options: q?.options?.join('、') || '',
  }
  const key = JSON.stringify(v)
  if (key !== seenView && socket?.readyState === 1) {
    seenView = key
    send('view', { view: v })
  }
}
setInterval(viewNow, 250)

const phases = ['開店準備', '試營運', '正式營業', '營業高峰', '黃金時段', '最後出餐']
const skillName = {
  center: '圓心辨識',
  radiusLine: '半徑辨識',
  name: '扇形比例',
  angle: '圓心角',
  radius: '半徑與直徑',
  area: '扇形面積',
  arc: '扇形弧長',
  inverse: '反推角度',
  compare: '面積比較',
  grams: '配料用量',
}
const evNames = {
  mouse: '老鼠入侵',
  leak: '廚房漏水',
  delivery: '搶救補貨箱',
  repair: '石窯故障',
  duel: '主廚揉麵挑戰',
}
const fmt = (t) =>
  Math.floor(Math.max(0, t) / 60) + ':' + String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')
const me = () => state?.players.find((p) => p.id === identity?.id),
  order = () => state?.orders.find((o) => o.id === selected)
const btn = (label, cmd, primary = false) =>
  '<button data-cmd="' +
  esc(cmd) +
  '" class="' +
  (primary ? 'primary' : '') +
  '">' +
  esc(label) +
  '</button>'
const row = (a, b) => '<div class="fact"><span>' + esc(a) + '</span><b>' + esc(b) + '</b></div>'
function toast(s) {
  $('toast').textContent = s
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => ($('toast').textContent = ''), 3600)
}
function show(mode, title, html) {
  dialogMode = mode
  modal.innerHTML = html
  $('eyebrow').textContent = title
  walkKeys.clear()
  if (me() && state.status === 'playing') send('move', { x: 0, z: 0 })
  if (!dlg.open) {
    dlg.showModal()
    $('close').focus({ preventScroll: true })
  }
}
function close() {
  if (dialogMode === 'station' && me() && state.status === 'playing') send('study')
  if (dlg.open) dlg.close()
  dialogMode = ''
  motion = null
  motionReturn = null
  bench = ''
  panelKey = ''
  feedback = ''
  walkKeys.clear()
}
$('close').onclick = close
dlg.addEventListener('cancel', (e) => {
  e.preventDefault()
  close()
})
dlg.addEventListener('click', (e) => {
  if (
    e.target === dlg &&
    !(
      e.clientX > dlg.getBoundingClientRect().left &&
      e.clientX < dlg.getBoundingClientRect().right &&
      e.clientY > dlg.getBoundingClientRect().top &&
      e.clientY < dlg.getBoundingClientRect().bottom
    )
  )
    close()
})
function send(op, extra = {}) {
  if (socket?.readyState !== 1) {
    if (op !== 'move') toast('正在重新連線，請稍候。')
    return
  }
  socket.send(JSON.stringify({ op, nonce: crypto.randomUUID(), ...extra }))
}
function connect() {
  socket = new WebSocket(
    (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/play',
  )
  socket.onopen = () => {
    retry = 0
    $('net').innerHTML = '<i></i>已連線'
    let saved
    try {
      saved = JSON.parse(sessionStorage.getItem('golden-room'))
    } catch {}
    if (saved) send('restore', saved)
  }
  socket.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.type === 'session') {
      identity = { id: m.id, code: m.code, token: m.token }
      sessionStorage.setItem('golden-room', JSON.stringify(identity))
      if (['join', 'host'].includes(dialogMode)) close()
    }
    if (m.type === 'state') {
      state = m.state
      render()
    }
    if (m.type === 'error') {
      if (dialogMode === 'motion' && motion?.pending) afterMotion(false)
      if (m.op === 'restore') {
        sessionStorage.removeItem('golden-room')
        identity = null
        state = null
        render()
      }
      if (dlg.open) {
        feedback = m.message
        showFeedback()
      } else toast(m.message)
    }
    if (m.type === 'ack') {
      if (dialogMode === 'motion' && motion?.pending && motionReturn?.op === m.op) afterMotion(true)
      if (m.help) {
        feedback = m.help
        showFeedback()
        if (m.ok) toast(m.help)
      }
      if (m.op === 'cut') {
        cutFx = performance.now() + 650
        audio.play('cut')
        const c = $('dial')
        if (c && order()) {
          const opt = actionMemory[bench + '-' + selected] ?? {}
          const started = performance.now(),
            last = order()
          const animate = (now) => {
            if (!c.isConnected) return
            const u = Math.min(1, (now - started) / 600)
            drawDial(c, {
              deg: +opt.value || 90,
              rot:
                (last.rotation +
                  (last.gold ? last.cuts.slice(0, -1).reduce((a, b) => a + b, 0) : 0)) %
                360,
              flavor: last.flavor,
              split: Math.max(0, u - 0.45) * 19,
              knife: u,
            })
            if (u < 1) requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
        }
        setTimeout(() => {
          panelKey = ''
          refreshBench()
        }, 670)
      } else if (['place', 'knead', 'top', 'box'].includes(m.op)) audio.play(m.op)
    }
  }
  socket.onclose = (e) => {
    $('net').textContent = '重新連線中'
    if (e.code === 4001) {
      $('net').textContent = '房間已在另一個視窗開啟'
      return
    }
    setTimeout(connect, Math.min(5000, 600 * 2 ** retry++))
  }
}
function showFeedback() {
  queueMicrotask(viewNow)
  if ($('feedback')) $('feedback').textContent = feedback
  else if (feedback) toast(feedback)
}
function initScene() {
  import('./scene.js')
    .then(({ Kitchen }) => {
      kitchen = new Kitchen($('heroScene'), pickWorld)
      kitchen.quality(quality)
      render()
    })
    .catch((err) => {
      console.error(err)
      $('heroScene').textContent = '3D 廚房需要啟用瀏覽器硬體加速。'
      toast('3D 場景初始化失敗，請檢查 WebGL 設定。')
    })
}
function hostForm() {
  audio.wake()
  show(
    'host',
    'TEACHER',
    '<h2>老師開店</h2><p>建立一間教室，將六位數房間代碼分享給學生。老師可以觀察廚房、調整節奏與查看學習紀錄。</p><div class="tools">' +
      btn('建立房間', 'create', true) +
      '</div><p id="feedback" class="feedback"></p>',
  )
}
function joinForm() {
  audio.wake()
  show(
    'join',
    'CHEF CHECK-IN',
    '<h2>加入廚房</h2><form id="joinform"><div class="formgrid"><label>房間代碼<input id="joincode" aria-label="房間代碼" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required autofocus></label><label>廚師暱稱<input id="nickname" maxlength="14" required autocomplete="off"></label></div><p>選擇廚師外觀</p><div class="avatars">' +
      skins
        .map(
          (s, i) =>
            '<button type="button" data-skin="' +
            i +
            '" style="--c:' +
            s[1] +
            '" class="' +
            (i === skin ? 'selected' : '') +
            '">' +
            s[0] +
            '</button>',
        )
        .join('') +
      '</div><button class="primary">進入廚房</button><p id="feedback" class="feedback"></p></form>',
  )
  $('joinform').onsubmit = (e) => {
    e.preventDefault()
    send('join', { code: $('joincode').value.trim(), name: $('nickname').value.trim(), skin })
  }
}
$('student').onclick = joinForm
$('teacher').onclick = hostForm
function audioPanel() {
  audio.wake()
  show(
    'settings',
    'PREFERENCES',
    '<h2>聲音與顯示</h2><div class="board">' +
      ['music', 'fx']
        .map(
          (k, i) =>
            '<label>' +
            (i ? '操作音效' : '背景音樂') +
            '<input type="range" min="0" max="100" data-volume="' +
            k +
            '" value="' +
            audio.v[k] +
            '"></label>',
        )
        .join('') +
      '<div class="tools">' +
      btn('全部靜音', 'mute') +
      '</div></div><label><input id="low" type="checkbox" ' +
      (quality ? 'checked' : '') +
      '> 低畫質（降低更新頻率並關閉陰影）</label>',
  )
  $('low').onchange = (e) => {
    quality = e.target.checked
    localStorage.setItem('pizza-low', quality ? '1' : '0')
    kitchen?.quality(quality)
  }
  modal
    .querySelectorAll('[data-volume]')
    .forEach((el) => (el.oninput = () => audio.set(el.dataset.volume, el.value)))
}
$('sound').onclick = audioPanel
function teacherSettings(lobby) {
  const s = state.settings
  return (
    '<div class="formgrid">' +
    (lobby
      ? '<label>營業時間（分鐘）<input id="minutes" type="number" value="' +
        s.minutes +
        '" min="3" max="60"></label>'
      : '') +
    '<label>題目難度<select id="difficulty">' +
    [
      ['auto', '依表現調整'],
      ['basic', '基礎練習'],
      ['challenge', '進階挑戰'],
    ]
      .map(
        ([a, b]) =>
          '<option value="' +
          a +
          '" ' +
          (a === s.difficulty ? 'selected' : '') +
          '>' +
          b +
          '</option>',
      )
      .join('') +
    '</select></label><label>訂單速度<select id="pace">' +
    [
      [0.5, '慢速'],
      [1, '標準'],
      [2, '熱鬧'],
    ]
      .map(
        ([a, b]) =>
          '<option value="' + a + '" ' + (a === s.pace ? 'selected' : '') + '>' + b + '</option>',
      )
      .join('') +
    '</select></label></div><div class="tools"><label><input id="events" type="checkbox" ' +
    (s.events ? 'checked' : '') +
    '> 隨機事件</label><label><input id="hints" type="checkbox" ' +
    (s.hints ? 'checked' : '') +
    '> 公式提示</label>' +
    btn('儲存設定', 'settings') +
    '</div>'
  )
}
function saveSettings() {
  const v = {
    difficulty: $('difficulty').value,
    events: $('events').checked,
    hints: $('hints').checked,
    pace: +$('pace').value,
  }
  if ($('minutes')) v.minutes = +$('minutes').value
  send('settings', { value: v })
}
function roster() {
  return (
    state.players
      .map(
        (p) =>
          '<div class="playerrow"><b><i style="background:' +
          skins[p.skin][1] +
          '"></i>' +
          esc(p.name) +
          '</b><span>' +
          (!p.online
            ? '離線'
            : state.status === 'lobby'
              ? p.ready
                ? '已準備'
                : '待準備'
              : esc(p.action) + (p.hand ? ' · #' + p.hand.id + ' ' + itemNames[p.hand.type] : '')) +
          '</span></div>',
      )
      .join('') || '<p class="dim">等待學生加入……</p>'
  )
}
function knownTerms(o) {
  const asking = (k) => o.tasks.some((q) => !q.done && q.kind === k)
  const size = asking('radius') ? '直徑 ' + 2 * o.r + ' 公分' : '半徑 ' + o.r + ' 公分'
  const shape = asking('name') ? (360 * o.f[0]) / o.f[1] + '° 切片' : o.f[2]
  return { size, shape }
}
function learningGoal(o, p) {
  if (!o || !p) return null
  const station = stationFor[o.stage]
  return o.tasks.find((q) => q.owner === p.id && availableMath(o, q, multi()))
}
function targetFor(o, p) {
  if (!o || !p) return null
  const st = stationFor[o.stage],
    held = p.hand
  if (p.cargo) return 'fridge'
  if (held) {
    const itemOrder = state.orders.find((v) => v.id === held.id)
    return held.type === 'kit' ? 'top' : stationFor[itemOrder?.stage ?? 0]
  }
  const role = roleFor(o, state.players, p.id)
  if (multi() && o.stage <= 2) {
    if (role === 1 && o.kits < o.kitNeed && !o.kit) return 'fridge'
    if (role === 2 && !o.preheated) return 'oven'
  }
  const task = learningGoal(o, p)
  if (task) return task.station
  if (o.stage === 3 && multi() && !o.preheated) return 'oven'
  if (o.stage === 0) return 'pantry'
  if (
    o.stage <= 2 &&
    o.kits < o.kitNeed &&
    !o.kit &&
    o.item.loc !== st &&
    (!stations[o.item.loc] || (o.stage === 2 && o.kits === 0))
  )
    return 'fridge'
  if (o.stage === 2 && !o.kit && o.kits < o.kitNeed && multi() && role === 1) return 'fridge'
  if (o.stage === 2 && o.item.loc === 'top' && o.kits < o.kitNeed)
    return o.kit?.loc === 'floor' ? 'floorKit' : o.kit ? 'top' : 'fridge'
  if (o.item.loc === 'floor') return 'floorItem'
  if (stations[o.item.loc] && o.item.loc !== st) return o.item.loc
  return st
}
function mission(o, p) {
  if (!o) return '等待下一位顧客進店。'
  if (!p) return '點選左側訂單查看全班合作進度。'
  const t = targetFor(o, p),
    q = learningGoal(o, p)
  if (p.cargo) return '搬著補貨箱到冰箱旁，按「處理事件」完成配送。'
  if (t === 'oven' && !o.preheated && o.stage <= 3 && multi() && !p.hand)
    return '石窯可提前點火。轉動溫控鈕，為隊友預熱。'
  const lead = stageLead(o)
  if (lead && multi() && !canLead(o, p, lead) && !p.hand && !q && t === stationFor[o.stage])
    return (
      '輪到 ' +
      eligible(o, state.players, lead)
        .map((c) => c.name)
        .join('、') +
      ' ' +
      craftLabels[lead] +
      '。可支援搬運或選另一張訂單。'
    )
  if (q && t === q.station && !p.hand)
    return '輪到你了！到' + stations[q.station].name + '完成「' + skillName[q.kind] + '」。'
  if (p.hand)
    return (
      '將 #' +
      p.hand.id +
      ' ' +
      itemNames[p.hand.type] +
      '送到' +
      (stations[t]?.name || '工作桌') +
      '。'
    )
  if (t === 'fridge')
    return '到冰箱領取 #' + o.id + ' 的配料籃（已送 ' + o.kits + '/' + o.kitNeed + '）。'
  if (t === 'floorItem' || t === 'floorKit') return '拾起地上的物品，繼續這張訂單。'
  if (o.stage === 4)
    return state.t - o.bakeStart >= o.duration
      ? '披薩烤好了！到石窯取出。'
      : '爐火已點燃。可以先幫其他訂單備料。'
  if (stations[o.item.loc] && o.item.loc !== stationFor[o.stage] && o.stage > 0)
    return '到' + stations[o.item.loc].name + '取走 #' + o.id + ' ' + itemNames[o.item.type] + '。'
  if (o.item.loc === p.id || stations[o.item.loc])
    return '到' + (stations[t]?.name ?? '工作區') + '，' + stages[o.stage] + '。'
  return '隊友正在搬運主餐。可準備配料，或支援其他訂單。'
}
function render() {
  const inRoom = !!(identity && state),
    lobby = inRoom && state.status === 'lobby',
    play = inRoom && !lobby
  document.documentElement.classList.toggle('in-kitchen', play)
  $('home').hidden = inRoom
  $('lobby').hidden = !lobby
  $('play').hidden = !play
  if (!inRoom) {
    kitchen?.setHost($('heroScene'))
    kitchen?.sync(null, null, null)
    return
  }
  if (lobby) {
    $('roomcode').textContent = state.code
    const key = JSON.stringify(state.players.map((p) => [p.name, p.ready, p.online]))
    if (key !== rosterKey) {
      $('roster').innerHTML = roster()
      rosterKey = key
    }
    if (roomState !== 'lobby') {
      roomState = 'lobby'
      $('lobbycontrols').innerHTML = host()
        ? teacherSettings(true) + '<div class="tools">' + btn('開始營業', 'start', true) + '</div>'
        : '<button id="ready" data-cmd="ready"></button>'
    }
    if ($('ready')) $('ready').textContent = me()?.ready ? '已準備・取消' : '我準備好了'
    return
  }
  if (!state.orders.some((o) => o.id === selected))
    selected = (state.orders.find((o) => o.gold) || state.orders[0])?.id ?? 0
  const o = order(),
    p = me(),
    goal = targetFor(o, p)
  kitchen?.setHost($('gameScene'))
  kitchen?.sync(state, identity.id, stations[goal] ? goal : null)
  audio.active = state.status === 'playing'
  if (lastPlayerCount < state.players.length && roomState === 'playing') audio.play('arrival')
  lastPlayerCount = state.players.length
  const personal = state.orders.find((v) => learningGoal(v, p))
  $('mytask').hidden = !p || !personal || state.status !== 'playing'
  if (personal) $('mytask').textContent = '我的數學任務 · #' + personal.id
  if (p?.coach && p.coach.id !== lastCoach) {
    lastCoach = p.coach.id
    toast('老師：' + p.coach.message)
  }
  $('phase').textContent =
    state.status === 'ended' ? '已打烊' : state.status === 'paused' ? '暫停' : phases[state.phase]
  $('clock').textContent = fmt(state.limit - state.t)
  $('sales').textContent = '$ ' + state.revenue
  $('level').textContent = 'Lv. ' + (state.upgrades.length + 1)
  $('teacherpanel').hidden = !host()
  $('results').hidden = state.status !== 'ended'
  $('drop').hidden = !p?.hand
  $('go').hidden = !p || !o || state.status !== 'playing'
  $('shopgo').hidden = !p || state.status !== 'playing'
  $('eventgo').hidden = !state.event || !p
  $('held').textContent = p
    ? '手持 · ' + (p.cargo ? '補貨箱' : itemNames[p.hand?.type] || '空手')
    : '老師觀察席 · 房號 ' + state.code
  $('mission').textContent = mission(o, p)
  const key =
    state.orders
      .map((o) => [
        o.id,
        o.stage,
        o.press,
        o.kits,
        o.gold,
        o.label,
        o.tasks.filter((q) => q.done).length,
      ])
      .join('|') +
    '-' +
    selected
  if (key !== cardsKey) {
    cardsKey = key
    $('orderlist').innerHTML =
      state.orders
        .map(
          (a) =>
            '<button class="ticket ' +
            (a.id === selected ? 'active' : '') +
            '" data-order="' +
            a.id +
            '"><span>#' +
            String(a.id).padStart(2, '0') +
            ' · ' +
            esc(a.customer) +
            '</span><b>' +
            esc(a.gold ? '黃金拼盤' : a.label || (a.vip ? 'VIP ' : '') + flavors[a.flavor]) +
            '</b><small>' +
            esc(a.gold ? '多口味合作單' : knownTerms(a).shape + ' · ' + knownTerms(a).size) +
            '</small><small>' +
            stages[a.stage] +
            '</small><i class="meter"><i style="width:' +
            ((a.stage + 1) / 9) * 100 +
            '%"></i></i></button>',
        )
        .join('') || '<small>等待下一張訂單</small>'
  }
  const team = roster()
  if ($('team').innerHTML !== team) $('team').innerHTML = team
  if (state.newsId !== lastNews) {
    lastNews = state.newsId
    newsUntil = Date.now() + 5500
  }
  $('banner').textContent =
    state.status === 'paused'
      ? '暫停營業'
      : state.status === 'ended'
        ? '營業結束 · 黃金披薩' + state.golden
        : state.event
          ? '廚房事件　' +
            evNames[state.event.kind] +
            '　' +
            state.event.step +
            '/' +
            state.event.need +
            '　·　剩 ' +
            Math.max(0, Math.ceil(state.event.until - state.t)) +
            ' 秒'
          : Date.now() < newsUntil
            ? state.notice
            : ''
  $('gameScene').closest('.field').dataset.event = state.event?.kind || ''
  $('banner').dataset.event = state.event?.kind || ''
  for (const ev of state.feedback)
    if (ev.id > fxId) {
      fxId = ev.id
      audio.play(ev.type)
    }
  if (dialogMode === 'station') refreshBench()
  if (dialogMode === 'event') eventPanel(false)
  if (dialogMode === 'motion' && motionReturn?.op === 'event' && !state.event) close()
  if (dialogMode === 'admin') updateAdmin()
  if (state.status === 'ended' && roomState !== 'ended') {
    close()
    toast('本次營業結束，可以查看學習成果。')
  }
  if (nextVisit && p && state.status === 'playing') {
    const v = nextVisit,
      pt = v.pt()
    if (pt && near(p, pt)) {
      nextVisit = null
      send('move', { x: 0, z: 0 })
      v.open()
    }
  }
  roomState = state.status
}
function focusOrder(id) {
  if (!state.orders.some((o) => o.id === id)) return
  selected = id
  panelKey = ''
  feedback = ''
  nextVisit = null
  render()
}
function visit(key, pt, open) {
  const p = me()
  if (!p) return
  if (dlg.open) close()
  if (near(p, pt())) {
    open()
    return
  }
  nextVisit = { key, pt, open }
  send('walk', { x: pt().x, z: pt().z })
}
function pickWorld(key, data) {
  if (!state || !me() || state.status !== 'playing') return
  if (key === 'floor') {
    nextVisit = null
    send('walk', data)
    return
  }
  if (key === 'dropItem') {
    focusOrder(data.order)
    return gotoFloor(data.kit)
  }
  if (key === 'event') {
    return gotoEvent()
  }
  if (stations[key]) {
    if (data?.order) focusOrder(data.order)
    visit(
      key,
      () => stations[key],
      () => openStation(key),
    )
  }
}
function gotoFloor(kit) {
  const o = order(),
    it = kit ? o?.kit : o?.item
  if (it?.loc !== 'floor') return
  visit(
    'floor',
    () => ({ x: it.x, z: it.z, w: 0.1, d: 0.1 }),
    () => openMotion('pickup', { order: o.id, value: kit ? 'kit' : 'main' }),
  )
}
function gotoEvent() {
  if (state.event)
    visit(
      'event',
      () => (state.event ? eventPoint(state.event, state.t, me()) : null),
      () => eventPanel(true),
    )
}
$('go').onclick = () => {
  let p = me()
  if (p?.hand && p.hand.id !== selected) focusOrder(p.hand.id)
  const t = targetFor(order(), p)
  if (t?.startsWith('floor')) gotoFloor(t === 'floorKit')
  else if (t) pickWorld(t)
}
$('mytask').onclick = () => {
  const v = state.orders.find((o) => learningGoal(o, me()))
  if (v) {
    focusOrder(v.id)
    pickWorld(learningGoal(v, me()).station)
  }
}
$('eventgo').onclick = gotoEvent
$('shopgo').onclick = () => pickWorld('upgrade')
$('drop').onclick = () => openMotion('drop')
$('plus').onclick = () => {
  if (kitchen) {
    kitchen.zoom = Math.min(1.6, kitchen.zoom + 0.12)
    kitchen.resize()
  }
}
$('minus').onclick = () => {
  if (kitchen) {
    kitchen.zoom = Math.max(0.75, kitchen.zoom - 0.12)
    kitchen.resize()
  }
}
function look() {
  const p = me()
  if (!p) return
  const t = targetFor(order(), p)
  if (stations[t] && near(p, stations[t])) return openStation(t)
  if (state.event && near(p, eventPoint(state.event, state.t, me()))) return eventPanel(true)
  const closest = Object.entries(stations)
    .filter(([, s]) => near(p, s))
    .sort(
      (a, b) => Math.hypot(p.x - a[1].x, p.z - a[1].z) - Math.hypot(p.x - b[1].x, p.z - b[1].z),
    )[0]
  if (closest) return openStation(closest[0])
  if (t?.startsWith('floor')) return gotoFloor(t === 'floorKit')
  toast('先靠近設備，或按「前往工作區」。')
}
const moving = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']
function sendMovement() {
  const one = (...keys) => (keys.some((k) => walkKeys.has(k)) ? 1 : 0)
  const side = one('d', 'arrowright') - one('a', 'arrowleft'),
    down = one('s', 'arrowdown') - one('w', 'arrowup')
  send('move', {
    x: 0.821 * side + 0.571 * down,
    z: -0.571 * side + 0.821 * down,
    run: one('shift'),
  })
}
window.addEventListener('keydown', (e) => {
  if (!me() || state.status !== 'playing' || e.target.matches('input,select,textarea')) return
  const k = e.key.toLowerCase()
  if (dlg.open) {
    if (k === ' ' && !e.repeat && dialogMode === 'station' && e.target.tagName !== 'BUTTON') {
      e.preventDefault()
      modal.querySelector('.primary')?.click()
    }
    return
  }
  if (moving.includes(k)) {
    e.preventDefault()
    if (!walkKeys.has(k)) {
      walkKeys.add(k)
      nextVisit = null
      sendMovement()
    }
  }
  if (!e.repeat) {
    if (k === 'e' || k === ' ') {
      e.preventDefault()
      look()
    }
    if (k === 'q' && me()?.hand) openMotion('drop')
  }
})
window.addEventListener('keyup', (e) => {
  if (walkKeys.delete(e.key.toLowerCase()) && me() && state.status === 'playing') sendMovement()
})
window.addEventListener('blur', () => {
  if (walkKeys.size) {
    walkKeys.clear()
    sendMovement()
  }
})
setInterval(() => {
  if (walkKeys.size && !dlg.open && state?.status === 'playing') {
    sendMovement()
    audio.play('step')
  }
}, 330)
const catalog = [
  ['oven', '快火石窯', 75, '加快烘烤並增加一個爐位'],
  ['fridge', '雙門冰箱', 95, '冰箱多放 8 份配料'],
  ['box', '金邊餐盒', 120, '每筆訂單收入提高 12 枚'],
  ['sign', '金色招牌', 160, '客人多等 60 秒'],
]
const dial = '<canvas id="dial" width="540" height="393" aria-label="互動披薩模型"></canvas>'
function openStation(k) {
  bench = k
  dialogMode = 'station'
  panelKey = ''
  feedback = ''
  refreshBench()
}
function ovenLabel(o) {
  if (state.t - o.bakeStart < o.duration)
    return '還有 ' + Math.ceil(o.duration - state.t + o.bakeStart) + ' 秒'
  return o.warming
    ? '學習保溫中'
    : (o.hotAge || 0) < 40
      ? '剛剛好，可以出爐'
      : o.hotAge < 85
        ? '稍微過熟，盡快取出'
        : '焦香過頭，仍然可以出餐'
}
function inspector(o) {
  if (!o) return ''
  return (
    '<details><summary>客人條件與分工</summary>' +
    row('訂單', '#' + o.id + ' ' + o.customer) +
    row('口味', o.gold ? '起司、海鮮等分區' : flavors[o.flavor]) +
    row('尺寸', knownTerms(o).size) +
    row('需求', o.gold ? o.sectors.map((v) => v[2]).join(' ＋ ') : knownTerms(o).shape) +
    row('已送配料', o.kits + ' / ' + o.kitNeed) +
    row('顧客心情', state.t - o.born < o.patience ? '耐心等候' : '期待上菜') +
    (o.quality ? row('火候', o.quality) : '') +
    row('最近經手', o.lastBy || '準備中') +
    o.tasks
      .map((q) =>
        row(
          skillName[q.kind],
          q.done
            ? '已完成'
            : (state.players.find((p) => p.id === q.owner)?.name ?? '等候分配') +
                ' · ' +
                stations[q.station].name,
        ),
      )
      .join('') +
    '</details>'
  )
}
function taskUI(q) {
  const precision = ['arc', 'area', 'grams'].includes(q.kind)
    ? '以 3.14 計算，必要時四捨五入到小數點後兩位。'
    : ''
  const entry = q.options
    ? '<div class="row">' + q.options.map((v) => btn(v, 'ans:' + v)).join('') + '</div>'
    : '<form id="answerform"><label>你的答案<input id="answer" autocomplete="off" required placeholder="' +
      (q.kind === 'name' ? '例如 1/2 或 0.5' : '輸入數值') +
      '"></label><span class="dim">' +
      esc(q.unit) +
      '</span> <button class="primary">確認答案</button></form>'
  return (
    '<div class="board"><b>' +
    esc(q.prompt) +
    '</b>' +
    dial +
    '<p class="dim">' +
    (q.kind === 'center' || q.kind === 'radiusLine'
      ? '點選圖上的位置，也可用下方按鈕選擇。'
      : precision) +
    '</p>' +
    entry +
    (state.settings.hints ? '<div class="tools">' + btn('給我提示', 'hint') + '</div>' : '') +
    '</div>'
  )
}
function artOptions(o, q, memory) {
  let f = o.gold ? o.sectors[Math.min(o.cutIndex, o.sectors.length - 1)] : o.f
  if (q) f = q.f
  const prev = o.gold ? o.cuts.reduce((a, b) => a + b, 0) : 0
  return {
    kind: q?.kind ?? (bench === 'cut' ? 'cut' : 'dough'),
    r: bench === 'dough' && !q ? +(memory.radius ?? 6) : o.r,
    deg: q ? (360 * f[0]) / f[1] : +(memory.value ?? 30),
    rot: ((o.rotation || 0) + prev) % 360,
    flavor: o.gold ? o.goldFlavors[Math.min(o.cutIndex, o.goldFlavors.length - 1)] : o.flavor,
    gold: o.gold,
  }
}
function refreshBench() {
  if (dialogMode !== 'station' || !state || performance.now() < cutFx) return
  const o = order(),
    p = me()
  if (!p || !stations[bench]) return
  const q = liveQuestion(o, p)
  const beat = o?.stage === 4 ? state.t - o.bakeStart : 0
  const deps = [
    bench,
    selected,
    o?.stage,
    o?.press,
    o?.kits,
    o?.item.loc,
    o?.kit?.loc,
    o?.label,
    o?.ingredientsPlaced,
    o?.quality,
    o?.cutIndex,
    o?.preheated,
    state.players
      .filter((p) => p.online)
      .map((p) => p.id)
      .join(),
    JSON.stringify(o?.leads),
    o?.tasks.map((t) => [t.id, t.attempts, t.hints, t.done, t.owner].join()).join(),
    p.hand?.id,
    p.hand?.type,
    p.coach?.id,
    bench === 'upgrade' ? state.money : '',
    state.upgrades.join(),
    o?.stage === 4 && beat >= o?.duration,
    state.status,
  ]
  const key = deps.join('~')
  if (panelKey === key) {
    if ($('bakeprog')) {
      $('bakeprog').value = beat
      $('baketime').textContent = ovenLabel(o)
    }
    return
  }
  panelKey = key
  const memory = (actionMemory[bench + '-' + selected] ??= {})
  const title = stations[bench].name
  let body = '<h2>' + title + '</h2>'
  if (bench === 'upgrade') {
    body +=
      '<p>可用公款 $' +
      state.money +
      '　累計營業額 $' +
      state.revenue +
      '</p>' +
      catalog
        .map(
          ([id, n, c, txt]) =>
            '<div class="fact"><span><b>' +
            n +
            '</b><br>' +
            txt +
            '</span>' +
            (state.upgrades.includes(id) ? '<b>已升級</b>' : btn('$' + c + ' 購買', 'buy:' + id)) +
            '</div>',
        )
        .join('')
  } else if (!o) body += '<p>等候下一張訂單。</p>'
  else {
    body +=
      '<div class="dim">訂單 #' +
      o.id +
      ' · ' +
      esc(o.gold ? '黃金拼盤' : o.label || flavors[o.flavor]) +
      ' · ' +
      esc(knownTerms(o).shape) +
      ' · ' +
      esc(knownTerms(o).size) +
      '</div>'
    const next = stationFor[o.stage],
      here = o.item.loc === bench,
      held = p.hand?.id === o.id ? p.hand.type : null
    if (q) body += taskUI(q)
    const others = o.tasks.filter(
      (t) => !t.done && t.station === bench && t.owner !== p.id && next === bench,
    )
    if (others.length)
      body +=
        '<p>' +
        others
          .map(
            (t) =>
              '等候 ' +
              esc(state.players.find((u) => u.id === t.owner)?.name) +
              ' 完成' +
              skillName[t.kind],
          )
          .join('、') +
        '</p>'
    let ops = []
    if (multi()) {
      const lead = stageLead(o)
      body +=
        '<div class="passnote">本單開店分工 · ' +
        roleNames[roleFor(o, state.players, p.id)] +
        '。' +
        (lead
          ? '當前可接棒：' +
            esc(
              eligible(o, state.players, lead)
                .map((c) => c.name)
                .join('、'),
            ) +
            '（' +
            craftLabels[lead] +
            '）'
          : '可自由支援搬運、備料與預熱。') +
        '</div>'
    }
    if (bench === 'oven' && o.stage <= 3 && !o.preheated)
      ops.push(btn('轉動溫控鈕預熱', 'preheat', true))
    if (bench === 'oven' && held === 'raw' && !canLead(o, p, 'bake'))
      ops.push(btn('將木鏟放到爐邊交棒', 'place', true))
    if (bench === 'pantry' && o.stage === 0 && !p.hand) ops.push(btn('拿取麵粉', 'flour', true))
    if (bench === 'fridge' && !p.hand && o.stage <= 2 && o.kits < o.kitNeed && !o.kit)
      ops.push(btn('領取本單配料籃 · 庫存 ' + state.stock, 'kit', true))
    if (bench === 'top' && held === 'kit') ops.push(btn('放入配料籃', 'addkit', true))
    if (next === bench && [1, 2, 5].includes(o.stage) && held === o.item.type)
      ops.push(btn('放上工作桌', 'place', true))
    if (here && o.stage > 0 && o.stage !== 4 && next !== bench && !p.hand)
      ops.push(btn('拿起' + itemNames[o.item.type], 'pickup', true))
    if (o.creative && !o.label && bench === 'dough' && o.stage === 1)
      body +=
        '<div class="board"><b>設計本店的創意披薩</b><label>名稱<input id="designname" maxlength="18" value="主廚特製"></label><label>半徑<select id="designradius">' +
        [6, 8, 10, 12].map((v) => '<option>' + v + '</option>').join('') +
        '</select></label><label>角度<select id="designdeg">' +
        [60, 90, 120, 180, 240, 270].map((v) => '<option>' + v + '</option>').join('') +
        '</select></label><label>口味<select id="designflavor">' +
        flavors.map((v, i) => '<option value="' + i + '">' + v + '</option>').join('') +
        '</select></label><div class="tools">' +
        toppings
          .map(
            (v) =>
              '<label><input type="checkbox" name="ingredients" value="' +
              v +
              '">' +
              v +
              '</label>',
          )
          .join('') +
        '</div>' +
        btn('採用配方', 'design') +
        '</div>'
    if (!q && !others.length) {
      if (
        bench === 'dough' &&
        canLead(o, p, 'knead') &&
        o.stage === 1 &&
        here &&
        (!o.creative || o.label)
      ) {
        body +=
          '<div class="board"><b>把餅皮擀到半徑 ' +
          o.r +
          ' 公分</b>' +
          dial +
          '<label>餅皮半徑<input id="radius" type="range" min="4" max="14" step="1" value="' +
          (memory.radius ?? 6) +
          '"></label><div class="dim">揉麵進度 ' +
          o.press +
          ' / 3</div></div>'
        ops.push(btn('按壓揉麵', 'knead', true))
      }
      if (bench === 'top' && canLead(o, p, 'top') && o.stage === 2 && here && o.kits >= o.kitNeed) {
        const flavor = o.gold ? o.goldFlavors[o.ingredients.length] : o.flavor
        body +=
          '<div class="board"><b>在' +
          esc(o.gold ? o.sectors[o.ingredients.length][2] : o.f[2]) +
          '區域鋪上' +
          flavors[flavor] +
          '配料</b><div class="tools">' +
          flavors.map((v, i) => btn(v, 'top:' + i)).join('') +
          '</div></div>'
      }
      if (bench === 'cut' && canLead(o, p, 'cut') && o.stage === 5 && here) {
        const f = o.gold ? o.sectors[o.cutIndex] : o.f
        body +=
          '<div class="board"><b>沿起始半徑順時針切出' +
          f[2] +
          '</b>' +
          dial +
          '<label>刀線角度（°）<input id="degrees" type="number" min="1" max="359" value="' +
          (memory.value ?? 30) +
          '"></label><p class="dim">拖曳圓周上的刀線，或輸入精確角度。</p></div>'
        ops.push(btn('落刀切片', 'cut', true))
      }
    }
    if (
      bench === 'oven' &&
      o.stage === 3 &&
      canLead(o, p, 'bake') &&
      (held === 'raw' || (here && !p.hand))
    )
      ops.push(btn('送入石窯', 'bake', true))
    if (bench === 'oven' && o.stage === 4) {
      body +=
        '<div class="board"><b id="baketime">' +
        ovenLabel(o) +
        '</b><progress id="bakeprog" value="' +
        beat +
        '" max="' +
        o.duration +
        '"></progress></div>'
      if (beat >= o.duration && !p.hand) ops.push(btn('取出熱披薩', 'unbake', true))
    }
    if (bench === 'box' && o.stage === 6 && held === 'slice')
      ops.push(btn('折盒裝入披薩', 'box', true))
    if (bench === 'serve' && o.stage === 7 && held === 'boxed')
      ops.push(btn('交付 #' + o.id + ' 給' + o.customer, 'serve', true))
    body += '<div class="tools">' + ops.join('') + '</div>'
    if (!ops.length && !q) body += '<p>' + esc(mission(o, p)) + '</p>'
    body += inspector(o)
  }
  if (p.coach) body += '<p class="passnote">老師指引：' + esc(p.coach.message) + '</p>'
  body += '<p id="feedback" class="feedback"></p>'
  show('station', 'KITCHEN WORKSTATION', body)
  showFeedback()
  if (q && state.status === 'playing') send('study', { order: o.id, task: q.id })
  if (o && $('dial')) {
    const opts = artOptions(o, q, memory),
      c = $('dial')
    drawDial(c, opts)
    attachDial(c, opts, (v) => {
      if (q) {
        send('answer', { order: o.id, task: q.id, value: v })
      } else {
        memory.value = v
        opts.deg = v
        if ($('degrees')) $('degrees').value = v
        drawDial(c, opts)
      }
    })
    if ($('degrees'))
      $('degrees').oninput = (e) => {
        memory.value = e.target.value
        opts.deg = Math.max(0, Math.min(360, +e.target.value))
        drawDial(c, opts)
      }
    if ($('radius'))
      $('radius').oninput = (e) => {
        memory.radius = e.target.value
        opts.r = +e.target.value
        drawDial(c, opts)
      }
  }
  if ($('answerform'))
    $('answerform').onsubmit = (e) => {
      e.preventDefault()
      send('answer', { order: o.id, task: q.id, value: $('answer').value })
    }
}
setInterval(() => {
  if (dialogMode !== 'station' || state?.status !== 'playing') return
  const o = order(),
    q = o?.tasks.find(
      (q) => availableMath(o, q, multi()) && q.station === bench && q.owner === identity.id,
    )
  if (q) send('study', { order: o.id, task: q.id })
}, 10000)
function eventPanel(force) {
  const e = state.event
  if (!e) {
    if (dialogMode === 'event') {
      close()
      toast('事件結束。')
    }
    return
  }
  const key = e.kind + '-' + e.step + '-' + !!me().cargo
  if (!force && panelKey === key) {
    if ($('beat')) $('beat').style.left = (Math.sin(state.t * 3) + 1) * 50 + '%'
    return
  }
  panelKey = key
  const dlgText = {
    mouse: '追到老鼠身邊後，伸手攔住牠。',
    leak: '在水漬旁拖地。隊友可以一起幫忙。',
    delivery: me().cargo ? '把補貨箱搬到冷藏收貨點。' : '到前方收貨區搶救一箱食材。',
    repair: '選取自己的亮燈線路，把插頭拖回對應的插座。',
    duel: '握住擀麵棍，推過彎道，與其他廚師合力完成接力。',
  }[e.kind]
  const op =
    e.kind === 'repair'
      ? [0, 1, 2]
          .map((a) =>
            btn(
              (e.sequence[me().skin % 3] === a ? '亮燈 · ' : '') + ['紅', '黃', '綠'][a],
              'event:' + a,
              e.sequence[me().skin % 3] === a,
            ),
          )
          .join('')
      : btn(
          {
            mouse: '攔住老鼠',
            leak: '拖地一次',
            delivery: me().cargo ? '送達補貨箱' : '搬起補貨箱',
            duel: '按壓麵團',
          }[e.kind],
          'event:go',
          true,
        )
  show(
    'event',
    'KITCHEN EVENT',
    '<h2>' +
      evNames[e.kind] +
      '</h2><p>' +
      dlgText +
      '</p>' +
      row('合作進度', e.step + ' / ' + e.need) +
      '<p class="dim">已出手：' +
      esc(
        state.players
          .filter((p) => e.contributions[p.id])
          .map((p) => p.name)
          .join('、') || '等你們接棒',
      ) +
      '</p>' +
      '<div class="tools">' +
      op +
      btn('追蹤事件位置', 'track') +
      '</div><p id="feedback" class="feedback"></p>',
  )
  showFeedback()
}
function admin() {
  show(
    'admin',
    'TEACHER CONSOLE',
    '<h2>店務管理</h2><div id="adminstate"></div><div class="tools">' +
      btn('暫停', 'pause') +
      btn('繼續', 'resume') +
      btn('延長 2 分鐘', 'extend') +
      btn('全班提示', 'tip') +
      '</div><details><summary>營業與教學設定</summary>' +
      teacherSettings(false) +
      '</details><div class="tools"><select id="special">' +
      Object.entries(evNames)
        .map(([v, n]) => '<option value="' + v + '">' + n + '</option>')
        .join('') +
      '</select>' +
      btn('發起事件', 'trigger') +
      btn('黃金訂單', 'gold') +
      '</div><details open><summary>學生畫面與作答</summary><label class="stack">跟看廚師<select id="watchchef"></select></label><div id="classlive"></div><canvas id="watchcanvas" width="780" height="402" hidden></canvas><div class="coachline"><input id="coachtext" maxlength="120" placeholder="傳給這位學生的提示"><button data-cmd="coach">傳送指引</button></div></details><div class="tools">' +
      btn('查看學習紀錄', 'report') +
      btn('提前打烊', 'endconfirm') +
      '</div><p id="feedback" class="feedback"></p>',
  )
  updateAdmin()
}
function updateAdmin() {
  if (!$('classlive')) return
  $('adminstate').textContent =
    (state.status === 'paused' ? '暫停中' : '營業中') +
    ' · ' +
    fmt(state.limit - state.t) +
    ' · 房間 ' +
    state.code
  const select = $('watchchef')
  if (!select) return
  const choices = state.players
    .map(
      (p) =>
        '<option value="' +
        esc(p.id) +
        '">' +
        esc(p.name) +
        (p.online ? '' : ' · 離線') +
        '</option>',
    )
    .join('')
  if (select.innerHTML !== choices) {
    select.innerHTML = choices
    select.value = state.players.some((p) => p.id === observedId)
      ? observedId
      : state.players[0]?.id || ''
  }
  select.onchange = () => {
    observedId = select.value
    updateAdmin()
  }
  const p = state.players.find((p) => p.id === select.value)
  if (!p) return
  const v = p.view || {},
    o = state.orders.find((o) => o.id === v.order),
    q = o?.tasks.find((q) => q.id === v.task)
  const html =
    '<div class="watchpage"><strong>' +
    esc(v.heading || '等候畫面同步') +
    '</strong> ' +
    esc(p.online ? '在線' : '已離線') +
    row('房內位置／訂單', (stations[v.station]?.name || '廚房') + (o ? ' · #' + o.id : '')) +
    (q
      ? '<p><b>' +
        esc(q.prompt) +
        '</b></p>' +
        row('已知條件', knownTerms(o).size + ' · ' + knownTerms(o).shape) +
        row('輸入中', v.draft || '尚未輸入') +
        row('作答／提示', q.attempts + ' 次／' + q.hints + ' 次') +
        row('選項', v.options || q.unit || '輸入數字')
      : '') +
    (v.tool
      ? row('工具進度', motions[v.tool][0] + ' · ' + v.step + '/' + gesturePath(v.tool).length)
      : '') +
    (v.controls ? row('可用操作', v.controls) : '') +
    (v.feedback ? row('畫面回饋', v.feedback) : '') +
    (state.orders.some((o) => o.tasks.some((q) => q.owner === p.id && !q.done))
      ? '<details><summary>已分配的其他題目</summary>' +
        state.orders
          .flatMap((o) =>
            o.tasks
              .filter((t) => t.owner === p.id && !t.done && t.id !== q?.id)
              .map((t) => '<p>#' + o.id + ' ' + esc(t.prompt) + '</p>'),
          )
          .join('') +
        '</details>'
      : '') +
    row('老師上一則指引', p.coach?.message || '尚無') +
    row('最近操作結果', p.lastResult || '尚無') +
    row('最近畫面更新', '營業第 ' + fmt(p.viewAt || 0)) +
    '</div>'
  const card = $('classlive')
  if (card.dataset.rendered !== html) {
    card.innerHTML = html
    card.dataset.rendered = html
  }
  const canvas = $('watchcanvas')
  canvas.hidden = !v.tool && !q && !(v.station === 'cut' || v.station === 'dough')
  if (v.tool)
    paintMotion(
      canvas,
      v.tool,
      { angle: v.angle, rotation: v.rotation, item: p.hand?.type || o?.item.type },
      { step: v.step, pointer: v.pointer, t: performance.now() },
    )
  else if (!canvas.hidden)
    drawDial(canvas, {
      deg: v.angle || 30,
      rot: v.rotation,
      r: v.radius || 10,
      kind: q?.kind || (v.station === 'cut' ? 'cut' : 'dough'),
      flavor: o?.flavor,
    })
}
function report() {
  const list = host() ? state.players : [me()].filter(Boolean)
  show(
    'report',
    'SERVICE REPORT',
    '<h2>本店營業成果</h2>' +
      row('累計營業額 ／ 公款', '$' + state.revenue + ' ／ $' + state.money) +
      row(
        '完成訂單 ／ 平均評價',
        state.delivered +
          ' 份 ／ ' +
          (state.delivered
            ? (state.satisfaction / state.delivered).toFixed(1) + ' 星'
            : '尚無評價'),
      ) +
      row('店鋪目標', '$' + state.goal) +
      row(
        '店鋪等級 ／ 救援事件',
        'Lv.' + (state.upgrades.length + 1) + ' ／ ' + state.finishedEvents + ' 件',
      ) +
      row(
        '升級設備',
        catalog
          .filter((a) => state.upgrades.includes(a[0]))
          .map((a) => a[1])
          .join('、') || '尚未升級',
      ) +
      row('招牌食譜', state.recipes.join('、') || '尚未解鎖') +
      row('黃金披薩', state.golden) +
      list
        .map((p) => {
          const st = p.stats,
            weak = Object.entries(st.types)
              .filter(([, v]) => v.wrong > 0)
              .sort((a, b) => b[1].wrong - a[1].wrong)
          return (
            '<details><summary>' +
            esc(p.name) +
            ' · ' +
            (st.events > 2 ? '食材救援王' : st.correct > 3 ? '精準數學廚師' : '合作廚師') +
            '</summary>' +
            row('已接觸 ／ 完成', st.seen + ' ／ ' + st.correct) +
            row('首次正確率', st.seen ? Math.round((st.first / st.seen) * 100) + '%' : '未作答') +
            row(
              '首答錯後完成率',
              st.seen > st.first
                ? Math.round((100 * st.retried) / (st.seen - st.first)) + '%'
                : '無需重試',
            ) +
            row('提示 ／ 料理 ／ 救援', st.hints + ' ／ ' + st.cooking + ' ／ ' + st.events) +
            row('建議複習', weak.length ? skillName[weak[0][0]] : '繼續探索其他題型') +
            '<table><tr><th>題型</th><th>首答正確</th><th>答錯次數</th></tr>' +
            Object.entries(skillName)
              .map(
                ([k, n]) =>
                  '<tr><td>' +
                  n +
                  '</td><td>' +
                  (st.types[k]?.seen ? st.types[k].first + '/' + st.types[k].seen : '未接觸') +
                  '</td><td>' +
                  (st.types[k]?.wrong || '—') +
                  '</td></tr>',
              )
              .join('') +
            '</table></details>'
          )
        })
        .join('') +
      (host() ? btn('匯出學習 CSV', 'csv') : '') +
      '<div class="tools">' +
      btn('回到廚房', 'close') +
      (state.status === 'ended' ? btn('返回首頁', 'leave') : '') +
      '</div>',
  )
}
function csv() {
  const rows = [
    ['廚師', '題型', '已作答', '首次正確', '完成', '答錯次數', '提示', '料理貢獻', '事件貢獻'],
  ]
  for (const p of state.players)
    for (const [k, n] of Object.entries(skillName)) {
      const a = p.stats.types[k] || {}
      rows.push([
        p.name,
        n,
        a.seen || 0,
        a.first || 0,
        a.correct || 0,
        a.wrong || 0,
        a.hints || 0,
        p.stats.cooking,
        p.stats.events,
      ])
    }
  const escapeCell = (v) =>
    '"' +
    String(v)
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"'
  const url = URL.createObjectURL(
    new Blob(['\ufeff' + rows.map((r) => r.map(escapeCell).join(',')).join('\r\n')], {
      type: 'text/csv;charset=utf-8',
    }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = 'GoldenSlice-' + state.code + '.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
$('results').onclick = report
$('teacherpanel').onclick = admin
document.addEventListener('click', (e) => {
  const b = e.target.closest('button')
  if (!b) return
  audio.wake()
  if (b.dataset.order) {
    focusOrder(+b.dataset.order)
    return
  }
  if (b.dataset.skin != null) {
    skin = Number(b.dataset.skin)
    modal
      .querySelectorAll('[data-skin]')
      .forEach((x) => x.classList.toggle('selected', +x.dataset.skin === skin))
    return
  }
  const raw = b.dataset.cmd
  if (!raw) return
  const [c, v] = raw.split(':')
  const o = order()
  const q = o?.tasks.find((q) => q.station === bench && q.owner === identity?.id && !q.done)
  if (c === 'create') return send(c)
  if (c === 'settings') {
    saveSettings()
    toast('已送出設定。')
    return
  }
  if (c === 'start') {
    saveSettings()
    send('start')
    return
  }
  if (['ready', 'pause', 'resume', 'extend', 'gold', 'tip'].includes(c)) return send(c)
  if (c === 'coach') {
    const value = $('coachtext').value.trim()
    if (value) {
      send('coach', { who: $('watchchef').value, value })
      $('coachtext').value = ''
    }
    return
  }
  if (c === 'trigger') return send('event', { value: $('special').value })
  if (c === 'endconfirm') {
    show(
      'endconfirm',
      'CLOSE SERVICE',
      '<h2>現在打烊？</h2><p>本房間會結算目前的營業額與學習紀錄。</p><div class="tools">' +
        btn('繼續營業', 'admin') +
        btn('確定打烊', 'end', true) +
        '</div>',
    )
    return
  }
  if (c === 'end') {
    send('end')
    close()
    return
  }
  if (c === 'admin') return admin()
  if (c === 'report') return report()
  if (c === 'csv') return csv()
  if (c === 'close') return close()
  if (c === 'leave') {
    sessionStorage.removeItem('golden-room')
    location.reload()
    return
  }
  if (c === 'mute') {
    audio.set('music', 0)
    audio.set('fx', 0)
    return audioPanel()
  }
  if (c === 'buy') return openMotion('upgrade', { value: v })
  if (c === 'track') {
    close()
    gotoEvent()
    return
  }
  if (c === 'event') {
    if (!state.event) return close()
    if (!near(me(), eventPoint(state.event, state.t, me()))) {
      close()
      gotoEvent()
      return
    }
    return openMotion('event', { eventId: state.event.start, value: v === 'go' ? null : +v })
  }
  if (!o) return
  if (c === 'design')
    return send(c, {
      order: o.id,
      label: $('designname').value,
      radius: +$('designradius').value,
      deg: +$('designdeg').value,
      flavor: +$('designflavor').value,
      ingredients: [...modal.querySelectorAll('[name="ingredients"]:checked')].map((x) => x.value),
    })
  if (c === 'ans' || c === 'hint')
    return send(c === 'ans' ? 'answer' : 'hint', { task: q?.id, order: o.id, value: v })
  const extra =
    c === 'top'
      ? { value: +v }
      : c === 'knead'
        ? { radius: +$('radius').value }
        : c === 'cut'
          ? { value: +$('degrees').value }
          : {}
  if (motions[c]) return openMotion(c, { order: o.id, ...extra })
  send(c, { order: o.id, ...extra })
})
connect()
initScene()
