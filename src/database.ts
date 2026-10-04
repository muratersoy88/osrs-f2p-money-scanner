import { coreActivities } from './activities/core'
import { f2pGatheringActivities } from './activities/f2pGathering'
import { f2pProcessingActivities } from './activities/f2pProcessing'
import { f2pMagicCombatActivities } from './activities/f2pMagicCombat'
import { f2pCookingActivities } from './activities/f2pCooking'
import { f2pJewelleryActivities } from './activities/f2pJewellery'
import { f2pRunecraftActivities } from './activities/f2pRunecraft'
import { f2pSmithingEquipmentActivities } from './activities/f2pSmithingEquipment'
import { p2pCraftingActivities } from './activities/p2pCrafting'
import { p2pFletchingActivities } from './activities/p2pFletching'
import { p2pHerbloreActivities } from './activities/p2pHerblore'
import { p2pCookingActivities } from './activities/p2pCooking'
import { p2pSmithingActivities } from './activities/p2pSmithing'
import { p2pMiningActivities } from './activities/p2pMining'
import { p2pFishingActivities } from './activities/p2pFishing'
import { p2pWoodcuttingActivities } from './activities/p2pWoodcutting'
import { p2pFarmingActivities } from './activities/p2pFarming'
import { p2pHunterThievingActivities } from './activities/p2pHunterThieving'
import { f2pCombatActivities } from './activities/f2pCombat'
import { p2pSlayerCombatActivities } from './activities/p2pSlayerCombat'
import { p2pBossCombatActivities } from './activities/p2pBossCombat'
import type { V4Activity } from './types'

const all = [...coreActivities, ...f2pGatheringActivities, ...f2pProcessingActivities, ...f2pCookingActivities, ...f2pJewelleryActivities, ...f2pRunecraftActivities, ...f2pSmithingEquipmentActivities, ...f2pMagicCombatActivities, ...p2pCraftingActivities, ...p2pFletchingActivities, ...p2pHerbloreActivities, ...p2pCookingActivities, ...p2pSmithingActivities, ...p2pMiningActivities, ...p2pFishingActivities, ...p2pWoodcuttingActivities, ...p2pFarmingActivities, ...p2pHunterThievingActivities, ...f2pCombatActivities, ...p2pSlayerCombatActivities, ...p2pBossCombatActivities]
const seen = new Set<string>()
export const V4_ACTIVITY_DATABASE: V4Activity[] = all.filter(a => !seen.has(a.id) && !!seen.add(a.id))
export const VERIFIED_V4_ACTIVITIES = V4_ACTIVITY_DATABASE.filter(a => a.verified === 'VERIFIED')
export const NEEDS_VERIFICATION_V4_ACTIVITIES = V4_ACTIVITY_DATABASE.filter(a => a.verified === 'NEEDS_VERIFICATION')
export const VERIFIED_F2P_ACTIVITIES = VERIFIED_V4_ACTIVITIES.filter(a => a.f2p)
