export type VerificationStatus = 'VERIFIED' | 'NEEDS_VERIFICATION'
export type AccessMode = 'F2P' | 'MEMBER'
export type V4ActivityKind = 'PROCESSING' | 'GATHERING' | 'COMBAT' | 'MAGIC' | 'UTILITY'
export type V4RiskType = 'SAFE' | 'DEATH_RISK' | 'WILDERNESS' | 'PVP' | 'HIGH_REQUIREMENT'
export type V4LockStatus = 'OPEN' | 'LEVEL_LOCKED' | 'QUEST_LOCKED' | 'MEMBERS_LOCKED' | 'ACCESS_LOCKED' | 'GEAR_LOCKED' | 'MULTIPLE_REQUIREMENTS' | 'UNVERIFIED'
export type V4Attention = 'HIGH' | 'MEDIUM' | 'LOW' | 'AFK'

export type SkillRequirement = { skill: string; level: number }
export type ActivityRequirements = {
  skills?: SkillRequirement[]
  quests?: string[]
  areas?: string[]
  gear?: string[]
  diary?: string[]
  minigame?: string[]
}

export type EconomyChain = {
  acquire?: string[]
  process?: string[]
  finalProduct?: string[]
  sell?: string[]
}

export type V4Activity = {
  id: string
  name: string
  kind: V4ActivityKind
  category: string
  skills: string[]
  f2p: boolean
  members: boolean
  verified: VerificationStatus
  source: string
  lastVerified: string
  requirements: ActivityRequirements
  attention: V4Attention
  afkWindowSeconds?: number
  riskType: V4RiskType
  competitionRisk?: 'LOW' | 'MEDIUM' | 'HIGH'
  tags: string[]
  items?: string[]
  notes?: string
  chain?: EconomyChain
}

export type RequirementContext = {
  mode: AccessMode
  levels: Record<string, number>
  unlocks: Record<string, boolean>
}

export type RequirementResult = {
  status: V4LockStatus
  open: boolean
  missing: string[]
}
