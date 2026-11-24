// The same eligibility rule drives station prompts and the authoritative server.
export const craftSteps = ['knead', 'top', 'bake', 'cut']
export const roleNames = ['餅皮', '配料', '爐火', '刀工']
export const craftLabels = { knead: '擀餅皮', top: '鋪配料', bake: '入爐', cut: '切片' }
export function eligible(order, players, step) {
  const live = players.filter((p) => p.online)
  if (live.length <= 1) return live
  if (order.leads[step] && live.some((p) => p.id === order.leads[step]))
    return live.filter((p) => p.id === order.leads[step])
  const prior = craftSteps
    .slice(0, craftSteps.indexOf(step))
    .map((k) => order.leads[k])
    .filter(Boolean)
  const fresh = live.filter((p) => !prior.includes(p.id))
  return fresh.length ? fresh : live.filter((p) => p.id !== prior.at(-1))
}
export function roleFor(order, players, id) {
  const ids = players.filter((p) => p.online).map((p) => p.id)
  return ids.length
    ? (ids.indexOf(id) - ((order.id - 1) % ids.length) + ids.length) % ids.length
    : 0
}
export function availableMath(o, q, multi) {
  if (q.done || (o.creative && !o.label)) return false
  return (
    (multi || o.stage === { dough: 1, top: 2, cut: 5 }[q.station]) &&
    o.stage <= { dough: 1, top: 2, cut: 5 }[q.station]
  )
}
