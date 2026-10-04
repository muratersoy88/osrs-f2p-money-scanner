import { coreActivities } from './activities/core'
import type { V4Activity } from './types'

export const V4_ACTIVITY_DATABASE: V4Activity[] = [...coreActivities]
export const VERIFIED_V4_ACTIVITIES = V4_ACTIVITY_DATABASE.filter(a => a.verified === 'VERIFIED')
export const NEEDS_VERIFICATION_V4_ACTIVITIES = V4_ACTIVITY_DATABASE.filter(a => a.verified === 'NEEDS_VERIFICATION')
