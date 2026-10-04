import type { RequirementContext, RequirementResult, V4Activity, V4LockStatus } from './types'

export function evaluateActivity(activity: V4Activity, ctx: RequirementContext): RequirementResult {
  if (activity.verified !== 'VERIFIED') return { status: 'UNVERIFIED', open: false, missing: ['Doğrulama bekliyor'] }
  const missing: string[] = []
  const classes = new Set<V4LockStatus>()

  if (ctx.mode === 'F2P' && !activity.f2p) {
    missing.push('Members gerekli')
    classes.add('MEMBERS_LOCKED')
  }
  for (const req of activity.requirements.skills ?? []) {
    const current = ctx.levels[req.skill] ?? 1
    if (current < req.level) {
      missing.push(`${req.skill} ${req.level} gerekli (mevcut ${current})`)
      classes.add('LEVEL_LOCKED')
    }
  }
  for (const q of activity.requirements.quests ?? []) if (!(ctx.unlocks[`quest:${q}`] || ctx.unlocks[q])) { missing.push(`Quest: ${q}`); classes.add('QUEST_LOCKED') }
  for (const a of activity.requirements.areas ?? []) if (!(ctx.unlocks[`area:${a}`] || ctx.unlocks[a])) { missing.push(`Bölge: ${a}`); classes.add('ACCESS_LOCKED') }
  // Tradeable/ordinary equipment is not a permanent account unlock. It is shown as an advisory
  // ("buy/bring this") and must not turn an otherwise accessible activity into LOCKED.
  for (const g of activity.requirements.gear ?? []) if (!(ctx.unlocks[`gear:${g}`] || ctx.unlocks[g])) missing.push(`Ekipman edin: ${g}`)
  for (const d of activity.requirements.diary ?? []) if (!(ctx.unlocks[`diary:${d}`] || ctx.unlocks[d])) { missing.push(`Diary: ${d}`); classes.add('ACCESS_LOCKED') }
  for (const m of activity.requirements.minigame ?? []) if (!(ctx.unlocks[`minigame:${m}`] || ctx.unlocks[m])) { missing.push(`Unlock: ${m}`); classes.add('ACCESS_LOCKED') }

  if (!classes.size) return { status: 'OPEN', open: true, missing }
  const status: V4LockStatus = classes.size > 1 ? 'MULTIPLE_REQUIREMENTS' : [...classes][0]
  return { status, open: false, missing }
}
