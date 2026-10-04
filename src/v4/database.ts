import { coreActivities } from './activities/core'
import { f2pGatheringActivities } from './activities/f2pGathering'
import { f2pProcessingActivities } from './activities/f2pProcessing'
import { f2pMagicCombatActivities } from './activities/f2pMagicCombat'
import type { V4Activity } from './types'

const all = [...coreActivities, ...f2pGatheringActivities, ...f2pProcessingActivities, ...f2pMagicCombatActivities]
const seen = new Set<string>()
export const V4_ACTIVITY_DATABASE: V4Activity[] = all.filter(a => !seen.has(a.id) && !!seen.add(a.id))
export const VERIFIED_V4_ACTIVITIES = V4_ACTIVITY_DATABASE.filter(a => a.verified === 'VERIFIED')
export const NEEDS_VERIFICATION_V4_ACTIVITIES = V4_ACTIVITY_DATABASE.filter(a => a.verified === 'NEEDS_VERIFICATION')
export const VERIFIED_F2P_ACTIVITIES = VERIFIED_V4_ACTIVITIES.filter(a => a.f2p)
