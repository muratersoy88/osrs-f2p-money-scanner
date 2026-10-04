import type { RequirementContext, V4Activity, V4RiskType } from './types'
import { evaluateActivity } from './requirements'

export type EvaluatedActivity = { activity: V4Activity; access: ReturnType<typeof evaluateActivity> }
export type UnlockBucket = '+1 level' | '+5 level' | '+10 level' | 'Long-term'

export function evaluateDatabase(db: V4Activity[], ctx: RequirementContext): EvaluatedActivity[] {
  return db.map(activity => ({ activity, access: evaluateActivity(activity, ctx) }))
}

export function safeOpenActivities(db: V4Activity[], ctx: RequirementContext) {
  return evaluateDatabase(db, ctx).filter(x => x.access.open && x.activity.verified === 'VERIFIED' && !['WILDERNESS','PVP'].includes(x.activity.riskType))
}

export function combatNetGpHour(a: V4Activity) {
  const c = a.combat
  if (!c) return null
  if (typeof c.netGpPerHour === 'number') return c.netGpPerHour
  if (typeof c.lootGpPerHour === 'number') return c.lootGpPerHour - (c.supplyCostPerHour ?? 0)
  return null
}

export function rankCombat(db: V4Activity[], ctx: RequirementContext, safeOnly = true) {
  return evaluateDatabase(db, ctx)
    .filter(x => x.access.open && x.activity.verified === 'VERIFIED' && x.activity.kind === 'COMBAT')
    .filter(x => !safeOnly || !['WILDERNESS','PVP'].includes(x.activity.riskType))
    .map(x => ({ ...x, netGpHour: combatNetGpHour(x.activity) }))
    .sort((a,b)=>(b.netGpHour ?? -Infinity)-(a.netGpHour ?? -Infinity))
}

export function nextUnlocks(db: V4Activity[], ctx: RequirementContext) {
  return evaluateDatabase(db, ctx)
    .filter(x => x.activity.verified === 'VERIFIED' && !x.access.open)
    .map(x => {
      const missingSkills = (x.activity.requirements.skills ?? []).map(req => ({...req,current:ctx.levels[req.skill] ?? 1,delta:Math.max(0,req.level-(ctx.levels[req.skill] ?? 1))})).filter(r=>r.delta>0)
      const maxDelta = missingSkills.reduce((m,r)=>Math.max(m,r.delta),0)
      const bucket: UnlockBucket = maxDelta <= 1 ? '+1 level' : maxDelta <= 5 ? '+5 level' : maxDelta <= 10 ? '+10 level' : 'Long-term'
      return {...x, missingSkills, maxDelta, bucket}
    })
    .filter(x => x.missingSkills.length > 0)
    .sort((a,b)=>a.maxDelta-b.maxDelta || a.access.missing.length-b.access.missing.length)
}

export function readyAfterSimpleRequirements(db: V4Activity[], ctx: RequirementContext) {
  return evaluateDatabase(db, ctx)
    .filter(x => x.activity.verified === 'VERIFIED')
    .filter(x => {
      const skillMissing=(x.activity.requirements.skills ?? []).some(r => (ctx.levels[r.skill] ?? 1) < r.level)
      const hardMissing=x.access.missing.some(m => m.startsWith('Members') || m.startsWith('Quest:') || m.startsWith('Bölge:') || m.startsWith('Diary:') || m.startsWith('Unlock:'))
      const gearMissing=x.access.missing.some(m => m.startsWith('Ekipman edin:'))
      return !skillMissing && !hardMissing && gearMissing
    })
    .sort((a,b)=>a.activity.name.localeCompare(b.activity.name))
}

export function questUnlockValue(db: V4Activity[], ctx: RequirementContext) {
  const map = new Map<string,{quest:string,count:number,activities:string[]}>()
  for (const a of db) {
    if (a.verified !== 'VERIFIED') continue
    for (const q of a.requirements.quests ?? []) {
      if (ctx.unlocks[`quest:${q}`] || ctx.unlocks[q]) continue
      const cur=map.get(q) ?? {quest:q,count:0,activities:[]}
      cur.count++; cur.activities.push(a.name); map.set(q,cur)
    }
  }
  return [...map.values()].sort((a,b)=>b.count-a.count || a.quest.localeCompare(b.quest))
}

export function itemChains(db: V4Activity[], query: string) {
  const q=query.trim().toLowerCase(); if(!q) return []
  return db.filter(a => [a.name,...(a.items??[]),...a.tags].join(' ').toLowerCase().includes(q) && a.chain)
}

export function riskLabel(r: V4RiskType) { return r.replaceAll('_',' ') }
