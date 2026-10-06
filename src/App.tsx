import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { V4_ACTIVITY_DATABASE } from './v4/database'
import { evaluateActivity } from './v4/requirements'
import { rankCombat, nextUnlocks as v4NextUnlocks, questUnlockValue, itemChains, readyAfterSimpleRequirements } from './v4/planner'
import { V5_CATALOGUE, V5_PAGES, V5_CANONICAL_MANIFEST } from './v5'
import type { V5Edit, V5PageId } from './v5'

const API = 'https://prices.runescape.wiki/api/v1/osrs'

type AccountMode = 'F2P' | 'MEMBER'
type RecipeKind = 'normal' | 'alchemy'
type MethodPurpose = 'MONEY' | 'SKILL + PROFIT' | 'XP'
type AttentionLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'AFK'
type ActivityType = 'Processing' | 'Gathering' | 'Cooking' | 'Combat'
type CompetitionRisk = 'LOW' | 'MEDIUM' | 'HIGH'
type PlayerMode = 'ACTIVE' | 'NORMAL' | 'CHILL'
type BondScenario = 'EXPECTED' | 'CONSERVATIVE'
type ProgressionPriority = 'PROFIT' | 'BALANCED' | 'PROGRESSION'
type Measurement = { date:string; skillLevel:number; quantity:number; minutes:number; itemsPerHour:number; buyPrice?:number; sellPrice?:number; profit?:number; xp?:number; successful?:number; failed?:number; burnt?:number; outputs?:Record<string,number> }

type MethodUserData = {
  actualItemsPerHour?: number
  measuredQuantity?: number
  measuredMinutes?: number
  actualBuyCost?: number
  actualSellPrice?: number
  purpose?: MethodPurpose
  itemsPerRun?: number
  attentionLevel?: AttentionLevel
  actualSuccessByLevel?: Record<string, { total: number; successful: number; burnt: number; rate: number }>
  targetBuyPrice?: number
  averageSecondsBetweenInteractions?: number
}

type Ingredient = {
  name: string
  qty: number
}

type Recipe = {
  name: string
  category: string
  skill: string
  level: number
  xp: number
  inputs: Ingredient[]
  output?: string
  outputQty?: number
  fee?: number
  f2p: boolean
  itemsPerHour: number
  kind?: RecipeKind
  alchItem?: string
  alchType?: 'high' | 'low'
  success?: (levels: Record<string, number>) => number
  note?: string
  verifiedF2P?: boolean
  activityType?: ActivityType
  attentionLevel?: AttentionLevel
  questRequirement?: string
  accessRequirement?: string
  equipment?: string
  regionRequirement?: string
  diaryRequirement?: string
  minigameRequirement?: string
  verifiedP2P?: boolean
  cooking?: { noBurnLevel: number; burntItem?: string; afkSecondsPerRun?: number }
}

const DEFAULT_LEVELS: Record<string, number> = {
  Attack: 20,
  Strength: 27,
  Defence: 20,
  Hitpoints: 24,
  Prayer: 11,
  Magic: 25,
  Runecraft: 1,
  Crafting: 35,
  Mining: 31,
  Smithing: 30,
  Fishing: 50,
  Cooking: 28,
  Firemaking: 13,
  Woodcutting: 11,
  Ranged: 1,
  Agility: 1,
  Herblore: 1,
  Thieving: 1,
  Fletching: 1,
  Slayer: 1,
  Farming: 1,
  Construction: 1,
  Hunter: 1,
  Sailing: 1,
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n))

const xpForLevel = (level:number) => { let points=0; for(let l=1;l<level;l++) points += Math.floor(l + 300*Math.pow(2,l/7)); return Math.floor(points/4) }
const weightedSpeed = (list:Measurement[]) => { const q=list.reduce((a,m)=>a+(m.quantity||0),0); const mins=list.reduce((a,m)=>a+(m.minutes||0),0); return q>0&&mins>0?q/mins*60:null }

const wineSuccess = (levels: Record<string, number>) => {
  const level = levels.Cooking || 1
  if (level < 35) return 0.6
  if (level >= 68) return 1
  return clamp(0.6 + ((level - 35) / 33) * 0.4, 0.6, 1)
}

/*
  Plain pizza burn chance is level-dependent.
  We deliberately use a conservative linear estimate between unlock and
  no-burn level rather than pretending to have an exact tick-perfect formula.
*/
const pizzaSuccess = (levels: Record<string, number>) => {
  const level = levels.Cooking || 1
  if (level >= 68) return 1
  if (level <= 35) return 0.65
  return clamp(0.65 + ((level - 35) / 33) * 0.35, 0.65, 1)
}


const cookingSuccessEstimate = (level: number, required: number, noBurn: number) => {
  if (level >= noBurn) return 1
  if (level <= required) return 0.55
  const progress = (level - required) / Math.max(1, noBurn - required)
  return clamp(0.55 + progress * 0.45, 0.55, 1)
}

const RECIPES: Recipe[] = [
  // ---------------- TANNING ----------------
  {
    name: 'Cowhide → Leather',
    category: 'Tanning',
    skill: 'Crafting',
    level: 1,
    xp: 0,
    inputs: [{ name: 'Cowhide', qty: 1 }],
    output: 'Leather',
    fee: 1,
    f2p: true,
    itemsPerHour: 2000,
    note: 'Al Kharid Tanner — 1 gp fee',
  },
  {
    name: 'Cowhide → Hard leather',
    category: 'Tanning',
    skill: 'Crafting',
    level: 1,
    xp: 0,
    inputs: [{ name: 'Cowhide', qty: 1 }],
    output: 'Hard leather',
    fee: 3,
    f2p: true,
    itemsPerHour: 2000,
    note: 'Al Kharid Tanner — 3 gp fee',
  },

  // ---------------- GOLD ----------------
  {
    name: 'Gold ring',
    category: 'Crafting',
    skill: 'Crafting',
    level: 5,
    xp: 15,
    inputs: [{ name: 'Gold bar', qty: 1 }],
    output: 'Gold ring',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Gold necklace',
    category: 'Crafting',
    skill: 'Crafting',
    level: 6,
    xp: 20,
    inputs: [{ name: 'Gold bar', qty: 1 }],
    output: 'Gold necklace',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Gold amulet (u)',
    category: 'Crafting',
    skill: 'Crafting',
    level: 8,
    xp: 30,
    inputs: [{ name: 'Gold bar', qty: 1 }],
    output: 'Gold amulet (u)',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'String gold amulet',
    category: 'Crafting',
    skill: 'Crafting',
    level: 1,
    xp: 4,
    inputs: [
      { name: 'Gold amulet (u)', qty: 1 },
      { name: 'Ball of wool', qty: 1 },
    ],
    output: 'Gold amulet',
    f2p: true,
    itemsPerHour: 1600,
  },

  // ---------------- SAPPHIRE ----------------
  {
    name: 'Cut sapphire',
    category: 'Gem Cutting',
    skill: 'Crafting',
    level: 20,
    xp: 50,
    inputs: [{ name: 'Uncut sapphire', qty: 1 }],
    output: 'Sapphire',
    f2p: true,
    itemsPerHour: 2500,
  },
  {
    name: 'Sapphire ring',
    category: 'Crafting',
    skill: 'Crafting',
    level: 20,
    xp: 40,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Sapphire', qty: 1 },
    ],
    output: 'Sapphire ring',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Sapphire necklace',
    category: 'Crafting',
    skill: 'Crafting',
    level: 22,
    xp: 55,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Sapphire', qty: 1 },
    ],
    output: 'Sapphire necklace',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Sapphire amulet (u)',
    category: 'Crafting',
    skill: 'Crafting',
    level: 24,
    xp: 65,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Sapphire', qty: 1 },
    ],
    output: 'Sapphire amulet (u)',
    f2p: true,
    itemsPerHour: 1100,
  },

  // ---------------- EMERALD ----------------
  {
    name: 'Cut emerald',
    category: 'Gem Cutting',
    skill: 'Crafting',
    level: 27,
    xp: 67.5,
    inputs: [{ name: 'Uncut emerald', qty: 1 }],
    output: 'Emerald',
    f2p: true,
    itemsPerHour: 2500,
  },
  {
    name: 'Emerald ring',
    category: 'Crafting',
    skill: 'Crafting',
    level: 27,
    xp: 55,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Emerald', qty: 1 },
    ],
    output: 'Emerald ring',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Emerald necklace',
    category: 'Crafting',
    skill: 'Crafting',
    level: 29,
    xp: 60,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Emerald', qty: 1 },
    ],
    output: 'Emerald necklace',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Emerald amulet (u)',
    category: 'Crafting',
    skill: 'Crafting',
    level: 31,
    xp: 70,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Emerald', qty: 1 },
    ],
    output: 'Emerald amulet (u)',
    f2p: true,
    itemsPerHour: 1100,
  },

  // ---------------- RUBY ----------------
  {
    name: 'Cut ruby',
    category: 'Gem Cutting',
    skill: 'Crafting',
    level: 34,
    xp: 85,
    inputs: [{ name: 'Uncut ruby', qty: 1 }],
    output: 'Ruby',
    f2p: true,
    itemsPerHour: 2500,
  },
  {
    name: 'Ruby ring',
    category: 'Crafting',
    skill: 'Crafting',
    level: 34,
    xp: 70,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Ruby', qty: 1 },
    ],
    output: 'Ruby ring',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Ruby necklace',
    category: 'Crafting',
    skill: 'Crafting',
    level: 40,
    xp: 75,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Ruby', qty: 1 },
    ],
    output: 'Ruby necklace',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Ruby amulet (u)',
    category: 'Crafting',
    skill: 'Crafting',
    level: 50,
    xp: 85,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Ruby', qty: 1 },
    ],
    output: 'Ruby amulet (u)',
    f2p: true,
    itemsPerHour: 1100,
  },

  // ---------------- DIAMOND ----------------
  {
    name: 'Cut diamond',
    category: 'Gem Cutting',
    skill: 'Crafting',
    level: 43,
    xp: 107.5,
    inputs: [{ name: 'Uncut diamond', qty: 1 }],
    output: 'Diamond',
    f2p: true,
    itemsPerHour: 2500,
  },
  {
    name: 'Diamond ring',
    category: 'Crafting',
    skill: 'Crafting',
    level: 43,
    xp: 85,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Diamond', qty: 1 },
    ],
    output: 'Diamond ring',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Diamond necklace',
    category: 'Crafting',
    skill: 'Crafting',
    level: 56,
    xp: 90,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Diamond', qty: 1 },
    ],
    output: 'Diamond necklace',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Diamond amulet (u)',
    category: 'Crafting',
    skill: 'Crafting',
    level: 70,
    xp: 100,
    inputs: [
      { name: 'Gold bar', qty: 1 },
      { name: 'Diamond', qty: 1 },
    ],
    output: 'Diamond amulet (u)',
    f2p: true,
    itemsPerHour: 1100,
  },

  // ---------------- SILVER ----------------
  {
    name: 'Silver bar → Unstrung symbol',
    category: 'Silver',
    skill: 'Crafting',
    level: 16,
    xp: 50,
    inputs: [{ name: 'Silver bar', qty: 1 }],
    output: 'Unstrung symbol',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Unstrung symbol → Unblessed symbol',
    category: 'Silver',
    skill: 'Crafting',
    level: 16,
    xp: 4,
    inputs: [
      { name: 'Unstrung symbol', qty: 1 },
      { name: 'Ball of wool', qty: 1 },
    ],
    output: 'Unblessed symbol',
    f2p: true,
    itemsPerHour: 1600,
  },
  {
    name: 'Unblessed symbol → Holy symbol',
    category: 'Silver',
    skill: 'Prayer',
    level: 31,
    xp: 0,
    inputs: [{ name: 'Unblessed symbol', qty: 1 }],
    output: 'Holy symbol',
    f2p: true,
    itemsPerHour: 1000,
    note: 'Brother Jered blessing',
  },
  {
    name: 'Silver bar → Tiara',
    category: 'Silver',
    skill: 'Crafting',
    level: 23,
    xp: 52.5,
    inputs: [{ name: 'Silver bar', qty: 1 }],
    output: 'Tiara',
    f2p: true,
    itemsPerHour: 1100,
  },

  // ---------------- WOOL / LEATHER ----------------
  {
    name: 'Wool → Ball of wool',
    category: 'Crafting',
    skill: 'Crafting',
    level: 1,
    xp: 2.5,
    inputs: [{ name: 'Wool', qty: 1 }],
    output: 'Ball of wool',
    f2p: true,
    itemsPerHour: 900,
  },
  {
    name: 'Leather → Leather gloves',
    category: 'Leather',
    skill: 'Crafting',
    level: 1,
    xp: 13.8,
    inputs: [{ name: 'Leather', qty: 1 }],
    output: 'Leather gloves',
    f2p: true,
    itemsPerHour: 1700,
  },
  {
    name: 'Leather → Leather boots',
    category: 'Leather',
    skill: 'Crafting',
    level: 7,
    xp: 16.3,
    inputs: [{ name: 'Leather', qty: 1 }],
    output: 'Leather boots',
    f2p: true,
    itemsPerHour: 1700,
  },
  {
    name: 'Leather → Leather cowl',
    category: 'Leather',
    skill: 'Crafting',
    level: 9,
    xp: 18.5,
    inputs: [{ name: 'Leather', qty: 1 }],
    output: 'Leather cowl',
    f2p: true,
    itemsPerHour: 1700,
  },
  {
    name: 'Leather → Leather vambraces',
    category: 'Leather',
    skill: 'Crafting',
    level: 11,
    xp: 22,
    inputs: [{ name: 'Leather', qty: 1 }],
    output: 'Leather vambraces',
    f2p: true,
    itemsPerHour: 1700,
  },
  {
    name: 'Leather → Leather body',
    category: 'Leather',
    skill: 'Crafting',
    level: 14,
    xp: 25,
    inputs: [{ name: 'Leather', qty: 1 }],
    output: 'Leather body',
    f2p: true,
    itemsPerHour: 1700,
  },
  {
    name: 'Leather → Leather chaps',
    category: 'Leather',
    skill: 'Crafting',
    level: 18,
    xp: 27,
    inputs: [{ name: 'Leather', qty: 1 }],
    output: 'Leather chaps',
    f2p: true,
    itemsPerHour: 1700,
  },
  {
    name: 'Hard leather → Hardleather body',
    category: 'Leather',
    skill: 'Crafting',
    level: 28,
    xp: 35,
    inputs: [{ name: 'Hard leather', qty: 1 }],
    output: 'Hardleather body',
    f2p: true,
    itemsPerHour: 1700,
  },

  // ---------------- FOOD PROCESSING ----------------
  {
    name: 'Pot of flour + water → Pastry dough',
    category: 'Food',
    skill: 'Cooking',
    level: 1,
    xp: 0,
    inputs: [
      { name: 'Pot of flour', qty: 1 },
      { name: 'Jug of water', qty: 1 },
    ],
    output: 'Pastry dough',
    f2p: true,
    itemsPerHour: 1800,
  },
  {
    name: 'Pastry dough + dish → Pie shell',
    category: 'Food',
    skill: 'Cooking',
    level: 1,
    xp: 0,
    inputs: [
      { name: 'Pastry dough', qty: 1 },
      { name: 'Pie dish', qty: 1 },
    ],
    output: 'Pie shell',
    f2p: true,
    itemsPerHour: 1800,
  },
  {
    name: 'Chocolate bar → Chocolate dust',
    category: 'Food',
    skill: 'Cooking',
    level: 1,
    xp: 0,
    inputs: [{ name: 'Chocolate bar', qty: 1 }],
    output: 'Chocolate dust',
    f2p: true,
    itemsPerHour: 2700,
  },
  {
    name: 'Plain pizza → Anchovy pizza',
    category: 'Food',
    skill: 'Cooking',
    level: 55,
    xp: 39,
    inputs: [
      { name: 'Plain pizza', qty: 1 },
      { name: 'Anchovies', qty: 1 },
    ],
    output: 'Anchovy pizza',
    f2p: true,
    itemsPerHour: 2500,
  },
  {
    name: 'Grapes + Jug of water → Jug of wine',
    category: 'Food',
    skill: 'Cooking',
    level: 35,
    xp: 200,
    inputs: [
      { name: 'Grapes', qty: 1 },
      { name: 'Jug of water', qty: 1 },
    ],
    output: 'Jug of wine',
    f2p: true,
    itemsPerHour: 2400,
    success: wineSuccess,
    note: '35 Cooking ≈60% success; 68 = 100%',
  },
  {
    name: 'Uncooked pizza → Plain pizza',
    category: 'Food',
    skill: 'Cooking',
    level: 35,
    xp: 143,
    inputs: [{ name: 'Uncooked pizza', qty: 1 }],
    output: 'Plain pizza',
    f2p: true,
    itemsPerHour: 1200,
    success: pizzaSuccess,
    note: 'Range cooking; 68 Cooking = no burn',
  },
  {
    name: 'Plain pizza → Meat pizza',
    category: 'Food',
    skill: 'Cooking',
    level: 45,
    xp: 26,
    inputs: [
      { name: 'Plain pizza', qty: 1 },
      { name: 'Cooked meat', qty: 1 },
    ],
    output: 'Meat pizza',
    f2p: true,
    itemsPerHour: 2500,
  },
  {
    name: 'Uncooked berry pie → Redberry pie',
    category: 'Food',
    skill: 'Cooking',
    level: 10,
    xp: 78,
    inputs: [{ name: 'Uncooked berry pie', qty: 1 }],
    output: 'Redberry pie',
    f2p: true,
    itemsPerHour: 1200,
    success: (levels) => {
      const l = levels.Cooking || 1
      if (l >= 45) return 1
      return clamp(0.65 + ((l - 10) / 35) * 0.35, 0.65, 1)
    },
    note: 'Range cooking; burn chance included',
  },

  // ---------------- RAW FISH COOKING (F2P) ----------------
  ...[
    ['Raw shrimps → Shrimps', 1, 30, 'Raw shrimps', 'Shrimps', 34],
    ['Raw sardine → Sardine', 1, 40, 'Raw sardine', 'Sardine', 35],
    ['Raw herring → Herring', 5, 50, 'Raw herring', 'Herring', 41],
    ['Raw anchovies → Anchovies', 1, 30, 'Raw anchovies', 'Anchovies', 34],
    ['Raw trout → Trout', 15, 70, 'Raw trout', 'Trout', 50],
    ['Raw pike → Pike', 20, 80, 'Raw pike', 'Pike', 64],
    ['Raw salmon → Salmon', 25, 90, 'Raw salmon', 'Salmon', 58],
    ['Raw tuna → Tuna', 30, 100, 'Raw tuna', 'Tuna', 63],
    ['Raw lobster → Lobster', 40, 120, 'Raw lobster', 'Lobster', 74],
    ['Raw swordfish → Swordfish', 45, 140, 'Raw swordfish', 'Swordfish', 80],
  ].map(([name, level, xp, raw, cooked, noBurn]) => ({
    name: name as string,
    category: 'Cooking',
    skill: 'Cooking',
    level: level as number,
    xp: xp as number,
    inputs: [{ name: raw as string, qty: 1 }],
    output: cooked as string,
    f2p: true,
    verifiedF2P: true,
    activityType: 'Cooking' as ActivityType,
    attentionLevel: 'LOW' as AttentionLevel,
    itemsPerHour: 1100,
    cooking: { noBurnLevel: noBurn as number, burntItem: `Burnt ${(cooked as string).toLowerCase()}`, afkSecondsPerRun: 65 },
    equipment: 'Range (F2P)',
    accessRequirement: 'F2P range; bank proximity affects real speed',
    note: `Burn estimate scales with Cooking level; no-burn target ~${noBurn} on standard range. Actual success measurement overrides estimate at the measured level.`,
  })),

  // ---------------- SMELTING ----------------
  {
    name: 'Iron ore → Iron bar',
    category: 'Smelting',
    skill: 'Smithing',
    level: 15,
    xp: 12.5,
    inputs: [{ name: 'Iron ore', qty: 1 }],
    output: 'Iron bar',
    f2p: true,
    itemsPerHour: 900,
    success: () => 0.5,
    note: 'F2P normal furnace: 50% success',
  },
  {
    name: 'Iron + 2 Coal → Steel bar',
    category: 'Smelting',
    skill: 'Smithing',
    level: 30,
    xp: 17.5,
    inputs: [
      { name: 'Iron ore', qty: 1 },
      { name: 'Coal', qty: 2 },
    ],
    output: 'Steel bar',
    f2p: true,
    itemsPerHour: 750,
  },
  {
    name: 'Mithril + 4 Coal → Mithril bar',
    category: 'Smelting',
    skill: 'Smithing',
    level: 50,
    xp: 30,
    inputs: [
      { name: 'Mithril ore', qty: 1 },
      { name: 'Coal', qty: 4 },
    ],
    output: 'Mithril bar',
    f2p: true,
    itemsPerHour: 600,
  },
  {
    name: 'Adamantite + 6 Coal → Adamantite bar',
    category: 'Smelting',
    skill: 'Smithing',
    level: 70,
    xp: 37.5,
    inputs: [
      { name: 'Adamantite ore', qty: 1 },
      { name: 'Coal', qty: 6 },
    ],
    output: 'Adamantite bar',
    f2p: true,
    itemsPerHour: 500,
  },
  {
    name: 'Runite + 8 Coal → Runite bar',
    category: 'Smelting',
    skill: 'Smithing',
    level: 85,
    xp: 50,
    inputs: [
      { name: 'Runite ore', qty: 1 },
      { name: 'Coal', qty: 8 },
    ],
    output: 'Runite bar',
    f2p: true,
    itemsPerHour: 450,
  },

  // ---------------- BAR → EQUIPMENT ----------------
  {
    name: 'Steel bars → Steel platebody',
    category: 'Smithing',
    skill: 'Smithing',
    level: 48,
    xp: 187.5,
    inputs: [{ name: 'Steel bar', qty: 5 }],
    output: 'Steel platebody',
    f2p: true,
    itemsPerHour: 900,
  },
  {
    name: 'Mithril bars → Mithril platebody',
    category: 'Smithing',
    skill: 'Smithing',
    level: 68,
    xp: 250,
    inputs: [{ name: 'Mithril bar', qty: 5 }],
    output: 'Mithril platebody',
    f2p: true,
    itemsPerHour: 900,
  },
  {
    name: 'Adamantite bars → Adamant platebody',
    category: 'Smithing',
    skill: 'Smithing',
    level: 88,
    xp: 312.5,
    inputs: [{ name: 'Adamantite bar', qty: 5 }],
    output: 'Adamant platebody',
    f2p: true,
    itemsPerHour: 900,
  },
  {
    name: 'Runite bars → Rune platebody',
    category: 'Smithing',
    skill: 'Smithing',
    level: 99,
    xp: 375,
    inputs: [{ name: 'Runite bar', qty: 5 }],
    output: 'Rune platebody',
    f2p: true,
    itemsPerHour: 900,
  },
  {
    name: 'Steel bars → Steel 2h sword',
    category: 'Smithing',
    skill: 'Smithing',
    level: 35,
    xp: 75,
    inputs: [{ name: 'Steel bar', qty: 2 }],
    output: 'Steel 2h sword',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Mithril bars → Mithril 2h sword',
    category: 'Smithing',
    skill: 'Smithing',
    level: 64,
    xp: 100,
    inputs: [{ name: 'Mithril bar', qty: 2 }],
    output: 'Mithril 2h sword',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Adamantite bars → Adamant 2h sword',
    category: 'Smithing',
    skill: 'Smithing',
    level: 84,
    xp: 125,
    inputs: [{ name: 'Adamantite bar', qty: 2 }],
    output: 'Adamant 2h sword',
    f2p: true,
    itemsPerHour: 1100,
  },
  {
    name: 'Runite bars → Rune 2h sword',
    category: 'Smithing',
    skill: 'Smithing',
    level: 99,
    xp: 150,
    inputs: [{ name: 'Runite bar', qty: 2 }],
    output: 'Rune 2h sword',
    f2p: true,
    itemsPerHour: 1100,
  },

  // ---------------- F2P HIGH ALCH ----------------
  {
    name: 'High Alch — Rune platebody',
    category: 'Alchemy',
    skill: 'Magic',
    level: 55,
    xp: 65,
    inputs: [],
    f2p: true,
    itemsPerHour: 1200,
    kind: 'alchemy',
    alchItem: 'Rune platebody',
    alchType: 'high',
    note: 'Fire staff assumed; Nature rune included',
  },
  {
    name: 'High Alch — Rune platelegs',
    category: 'Alchemy',
    skill: 'Magic',
    level: 55,
    xp: 65,
    inputs: [],
    f2p: true,
    itemsPerHour: 1200,
    kind: 'alchemy',
    alchItem: 'Rune platelegs',
    alchType: 'high',
    note: 'Fire staff assumed; Nature rune included',
  },
  {
    name: 'High Alch — Rune 2h sword',
    category: 'Alchemy',
    skill: 'Magic',
    level: 55,
    xp: 65,
    inputs: [],
    f2p: true,
    itemsPerHour: 1200,
    kind: 'alchemy',
    alchItem: 'Rune 2h sword',
    alchType: 'high',
    note: 'Fire staff assumed; Nature rune included',
  },
  {
    name: 'High Alch — Adamant platebody',
    category: 'Alchemy',
    skill: 'Magic',
    level: 55,
    xp: 65,
    inputs: [],
    f2p: true,
    itemsPerHour: 1200,
    kind: 'alchemy',
    alchItem: 'Adamant platebody',
    alchType: 'high',
    note: 'Fire staff assumed; Nature rune included',
  },
  {
    name: 'High Alch — Adamant platelegs',
    category: 'Alchemy',
    skill: 'Magic',
    level: 55,
    xp: 65,
    inputs: [],
    f2p: true,
    itemsPerHour: 1200,
    kind: 'alchemy',
    alchItem: 'Adamant platelegs',
    alchType: 'high',
    note: 'Fire staff assumed; Nature rune included',
  },
  {
    name: 'High Alch — Green d’hide body',
    category: 'Alchemy',
    skill: 'Magic',
    level: 55,
    xp: 65,
    inputs: [],
    f2p: true,
    itemsPerHour: 1200,
    kind: 'alchemy',
    alchItem: 'Green d\'hide body',
    alchType: 'high',
    note: 'Fire staff assumed; Nature rune included',
  },

  // ---------------- LOW ALCH ----------------
  {
    name: 'Low Alch — Rune 2h sword',
    category: 'Alchemy',
    skill: 'Magic',
    level: 21,
    xp: 31,
    inputs: [],
    f2p: true,
    itemsPerHour: 1200,
    kind: 'alchemy',
    alchItem: 'Rune 2h sword',
    alchType: 'low',
    note: 'Usually poor economics; shown for comparison',
  },

  // ---------------- VERIFIED MEMBER METHODS ----------------
  {
    name: 'Enchant sapphire ring → Ring of recoil', category: 'Members', skill: 'Magic', level: 7, xp: 17.5,
    inputs: [{ name: 'Sapphire ring', qty: 1 }, { name: 'Cosmic rune', qty: 1 }], output: 'Ring of recoil',
    f2p: false, verifiedP2P: true, itemsPerHour: 1200, activityType: 'Processing', attentionLevel: 'HIGH', equipment: 'Staff of water recommended', note: 'Members-only jewellery enchant.'
  },
  {
    name: 'Steel bar → Cannonballs', category: 'Members', skill: 'Smithing', level: 35, xp: 25.6,
    inputs: [{ name: 'Steel bar', qty: 1 }], output: 'Cannonball', outputQty: 4,
    f2p: false, verifiedP2P: true, itemsPerHour: 600, activityType: 'Processing', attentionLevel: 'AFK', questRequirement: 'Dwarf Cannon', equipment: 'Ammo mould', note: 'Long low-attention smithing cycle; 4 cannonballs per steel bar.'
  },
  {
    name: 'Logs → Arrow shafts', category: 'Members', skill: 'Fletching', level: 1, xp: 5,
    inputs: [{ name: 'Logs', qty: 1 }], output: 'Arrow shaft', outputQty: 15,
    f2p: false, verifiedP2P: true, itemsPerHour: 1100, activityType: 'Processing', attentionLevel: 'LOW', equipment: 'Knife', note: 'Members Fletching processing.'
  },
  {
    name: 'Oak logs → Oak shortbow (u)', category: 'Members', skill: 'Fletching', level: 20, xp: 33.3,
    inputs: [{ name: 'Oak logs', qty: 1 }], output: 'Oak shortbow (u)',
    f2p: false, verifiedP2P: true, itemsPerHour: 1500, activityType: 'Processing', attentionLevel: 'LOW', equipment: 'Knife'
  },
  {
    name: 'Willow logs → Willow longbow (u)', category: 'Members', skill: 'Fletching', level: 40, xp: 83.3,
    inputs: [{ name: 'Willow logs', qty: 1 }], output: 'Willow longbow (u)',
    f2p: false, verifiedP2P: true, itemsPerHour: 1500, activityType: 'Processing', attentionLevel: 'LOW', equipment: 'Knife'
  },

]

type GatheringActivity = {
  name: string
  skill: 'Fishing' | 'Mining' | 'Woodcutting'
  requiredLevel: number
  f2p: boolean
  verifiedF2P: boolean
  item: string
  secondaryItem?: string
  primaryShare?: number
  secondaryXpPerSuccess?: number
  xpPerSuccess: number
  theoreticalItemsPerHour: number
  attentionLevel: AttentionLevel
  bankingMethod: string
  questRequirement?: string
  accessRequirement?: string
  competitionRisk: CompetitionRisk
  notes?: string
  verifiedP2P?: boolean
  regionRequirement?: string
  equipment?: string
  afkWindow?: number
}

const GATHERING: GatheringActivity[] = [
  { name: 'Mine Copper ore', skill: 'Mining', requiredLevel: 1, f2p: true, verifiedF2P: true, item: 'Copper ore', xpPerSuccess: 17.5, theoreticalItemsPerHour: 700, attentionLevel: 'MEDIUM', bankingMethod: 'Bank', competitionRisk: 'MEDIUM', notes: 'Single-resource ore; route and competition strongly affect speed.' },
  { name: 'Mine Tin ore', skill: 'Mining', requiredLevel: 1, f2p: true, verifiedF2P: true, item: 'Tin ore', xpPerSuccess: 17.5, theoreticalItemsPerHour: 700, attentionLevel: 'MEDIUM', bankingMethod: 'Bank', competitionRisk: 'MEDIUM' },
  { name: 'Mine Iron ore', skill: 'Mining', requiredLevel: 15, f2p: true, verifiedF2P: true, item: 'Iron ore', xpPerSuccess: 35, theoreticalItemsPerHour: 900, attentionLevel: 'HIGH', bankingMethod: 'Bank', competitionRisk: 'HIGH', notes: 'F2P iron spots can be heavily contested.' },
  { name: 'Mine Coal', skill: 'Mining', requiredLevel: 30, f2p: true, verifiedF2P: true, item: 'Coal', xpPerSuccess: 50, theoreticalItemsPerHour: 350, attentionLevel: 'MEDIUM', bankingMethod: 'Bank', competitionRisk: 'HIGH' },
  { name: 'Mine Mithril ore', skill: 'Mining', requiredLevel: 55, f2p: true, verifiedF2P: true, item: 'Mithril ore', xpPerSuccess: 80, theoreticalItemsPerHour: 180, attentionLevel: 'MEDIUM', bankingMethod: 'Bank', competitionRisk: 'HIGH' },
  { name: 'Mine Adamantite ore', skill: 'Mining', requiredLevel: 70, f2p: true, verifiedF2P: true, item: 'Adamantite ore', xpPerSuccess: 95, theoreticalItemsPerHour: 100, attentionLevel: 'MEDIUM', bankingMethod: 'Bank', competitionRisk: 'HIGH' },
  { name: 'Net fish Shrimps / Anchovies', skill: 'Fishing', requiredLevel: 15, f2p: true, verifiedF2P: true, item: 'Raw shrimps', secondaryItem: 'Raw anchovies', primaryShare: 0.5, xpPerSuccess: 10, secondaryXpPerSuccess: 40, theoreticalItemsPerHour: 420, attentionLevel: 'LOW', bankingMethod: 'Bank', competitionRisk: 'LOW', notes: 'Mixed catch; 50/50 planning mix until a personal measured mix is added.' },
  { name: 'Bait fish Sardine / Herring', skill: 'Fishing', requiredLevel: 10, f2p: true, verifiedF2P: true, item: 'Raw sardine', secondaryItem: 'Raw herring', primaryShare: 0.5, xpPerSuccess: 20, secondaryXpPerSuccess: 30, theoreticalItemsPerHour: 380, attentionLevel: 'LOW', bankingMethod: 'Bank', competitionRisk: 'LOW', notes: 'Mixed catch; bait consumption is not deducted from GP/h yet, so treat GP/h as gross gathering value.' },
  { name: 'Fly fish Trout / Salmon', skill: 'Fishing', requiredLevel: 30, f2p: true, verifiedF2P: true, item: 'Raw trout', secondaryItem: 'Raw salmon', primaryShare: 0.5, xpPerSuccess: 50, secondaryXpPerSuccess: 70, theoreticalItemsPerHour: 520, attentionLevel: 'LOW', bankingMethod: 'Bank or drop', accessRequirement: 'Fly fishing rod + feathers', competitionRisk: 'LOW', notes: 'Mixed catch; 50/50 planning mix. Feather cost not deducted in gathering value.' },
  { name: 'Harpoon Tuna / Swordfish', skill: 'Fishing', requiredLevel: 50, f2p: true, verifiedF2P: true, item: 'Raw tuna', secondaryItem: 'Raw swordfish', primaryShare: 0.5, xpPerSuccess: 80, secondaryXpPerSuccess: 100, theoreticalItemsPerHour: 240, attentionLevel: 'LOW', bankingMethod: 'Karamja → deposit/bank route', accessRequirement: 'Harpoon; Karamja F2P fishing spot', competitionRisk: 'LOW', notes: 'Mixed catch; 50/50 planning mix.' },
  { name: 'Fish Lobster (Karamja)', skill: 'Fishing', requiredLevel: 40, f2p: true, verifiedF2P: true, item: 'Raw lobster', xpPerSuccess: 90, theoreticalItemsPerHour: 220, attentionLevel: 'LOW', bankingMethod: 'Karamja → deposit/bank route', accessRequirement: 'Lobster pot; Karamja F2P fishing spot', competitionRisk: 'LOW', notes: 'Low-attention pure catch; travel/banking reduces realised GP/h.' },
  { name: 'Chop Normal logs', skill: 'Woodcutting', requiredLevel: 1, f2p: true, verifiedF2P: true, item: 'Logs', xpPerSuccess: 25, theoreticalItemsPerHour: 650, attentionLevel: 'LOW', bankingMethod: 'Bank', competitionRisk: 'LOW' },
  { name: 'Chop Oak logs', skill: 'Woodcutting', requiredLevel: 15, f2p: true, verifiedF2P: true, item: 'Oak logs', xpPerSuccess: 37.5, theoreticalItemsPerHour: 500, attentionLevel: 'LOW', bankingMethod: 'Bank', competitionRisk: 'LOW' },
  { name: 'Chop Willow logs', skill: 'Woodcutting', requiredLevel: 30, f2p: true, verifiedF2P: true, item: 'Willow logs', xpPerSuccess: 67.5, theoreticalItemsPerHour: 420, attentionLevel: 'LOW', bankingMethod: 'Bank', competitionRisk: 'LOW' },
  { name: 'Chop Yew logs', skill: 'Woodcutting', requiredLevel: 60, f2p: true, verifiedF2P: true, item: 'Yew logs', xpPerSuccess: 175, theoreticalItemsPerHour: 160, attentionLevel: 'AFK', bankingMethod: 'Bank', competitionRisk: 'MEDIUM' },
  { name: 'Chop Magic logs', skill: 'Woodcutting', requiredLevel: 75, f2p: false, verifiedF2P: false, verifiedP2P: true, item: 'Magic logs', xpPerSuccess: 250, theoreticalItemsPerHour: 110, attentionLevel: 'AFK', bankingMethod: 'Bank', competitionRisk: 'LOW', regionRequirement: 'Members world', equipment: 'Axe', afkWindow: 75, notes: 'Members gathering; slow catches but long idle windows.' },
  { name: 'Fish Sharks', skill: 'Fishing', requiredLevel: 76, f2p: false, verifiedF2P: false, verifiedP2P: true, item: 'Raw shark', xpPerSuccess: 110, theoreticalItemsPerHour: 140, attentionLevel: 'AFK', bankingMethod: 'Bank', competitionRisk: 'LOW', regionRequirement: 'Members fishing area', equipment: 'Harpoon', afkWindow: 70 },
  { name: 'Mine Amethyst', skill: 'Mining', requiredLevel: 92, f2p: false, verifiedF2P: false, verifiedP2P: true, item: 'Amethyst', xpPerSuccess: 240, theoreticalItemsPerHour: 90, attentionLevel: 'AFK', bankingMethod: 'Bank', competitionRisk: 'LOW', regionRequirement: 'Mining Guild members area', equipment: 'Pickaxe', afkWindow: 60 },

]

const recipeId = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const defaultItemsPerRun = (r: Recipe) => {
  // Common F2P inventory loops. User can override every value from the UI.
  if (r.name === 'Iron + 2 Coal → Steel bar') return 9
  if (
    r.category === 'Crafting' &&
    (r.name.includes('ring') || r.name.includes('necklace') || r.name.includes('amulet'))
  ) return 13

  if (r.kind === 'alchemy') return 27

  const slotsPerProcess = Math.max(
    1,
    r.inputs.reduce((sum, i) => sum + i.qty, 0)
  )
  return Math.max(1, Math.floor(28 / slotsPerProcess))
}

const loadMethodData = (): Record<string, MethodUserData> => {
  try {
    const saved = localStorage.getItem('osrs-method-data-v22')
    const parsed = saved ? JSON.parse(saved) : {}
    const steelId = recipeId('Iron + 2 Coal → Steel bar')
    if (!parsed[steelId] || parsed[steelId].actualItemsPerHour === 491) {
      parsed[steelId] = { ...(parsed[steelId] || {}), actualItemsPerHour: 453, measuredQuantity: 800, measuredMinutes: 106 }
    }
    const sapphireId = recipeId('Sapphire amulet (u)')
    if (!parsed[sapphireId] || !(parsed[sapphireId].actualItemsPerHour > 0)) parsed[sapphireId] = { ...(parsed[sapphireId] || {}), actualItemsPerHour: 880 }
    const anchovyId = recipeId('Raw anchovies → Anchovies')
    if (!parsed[anchovyId]) parsed[anchovyId] = { actualItemsPerHour: 1080, measuredQuantity: 504, measuredMinutes: 28, actualSuccessByLevel: { '28': { total:504, successful:495, burnt:9, rate:495/504 } } }
    return parsed
  } catch {
    return {
      [recipeId('Iron + 2 Coal → Steel bar')]: { actualItemsPerHour: 453, measuredQuantity: 800, measuredMinutes: 106 },
      [recipeId('Sapphire amulet (u)')]: { actualItemsPerHour: 880 },
      [recipeId('Raw anchovies → Anchovies')]: { actualItemsPerHour: 1080, measuredQuantity: 504, measuredMinutes: 28, actualSuccessByLevel: { '28': { total:504, successful:495, burnt:9, rate:495/504 } } },
    }
  }
}

const fmt = (n: number | null | undefined, digits = 0) => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}

const geTax = (price: number) =>
  Math.min(5_000_000, Math.floor(price * 0.02))


type V4TheoryEstimate = { id:string; gpHour:number; note:string }
const V4_THEORY_ESTIMATES: V4TheoryEstimate[] = [
  {id:'p2p-clean-ranarr',gpHour:650000,note:'Herb cleaning — margin/volume sensitive'},
  {id:'p2p-clean-toadflax',gpHour:520000,note:'Herb cleaning — margin/volume sensitive'},
  {id:'p2p-clean-snapdragon',gpHour:480000,note:'Herb cleaning — margin/volume sensitive'},
  {id:'p2p-string-yew-long',gpHour:360000,note:'Bow stringing planning estimate'},
  {id:'p2p-string-magic-long',gpHour:330000,note:'Bow stringing planning estimate'},
  {id:'p2p-fletch-yew-long',gpHour:240000,note:'Unstrung bow planning estimate'},
  {id:'p2p-fletch-magic-long',gpHour:220000,note:'Unstrung bow planning estimate'},
  {id:'p2p-mine-gem-rocks',gpHour:420000,note:'Mixed gem output; route dependent'},
  {id:'p2p-amethyst',gpHour:310000,note:'AFK high-level Mining estimate'},
  {id:'p2p-motherlode',gpHour:120000,note:'Pay-dirt mix varies by level'},
  {id:'p2p-mine-pure-essence',gpHour:45000,note:'Low-level member Mining estimate'},
  {id:'p2p-fish-karambwan',gpHour:260000,note:'AFK Fishing estimate'},
  {id:'p2p-fish-anglerfish',gpHour:210000,note:'AFK Fishing estimate'},
  {id:'p2p-fish-monkfish',gpHour:150000,note:'Fishing estimate'},
  {id:'p2p-fish-shark',gpHour:130000,note:'Fishing estimate'},
  {id:'p2p-wc-magic',gpHour:170000,note:'Woodcutting estimate'},
  {id:'p2p-wc-redwood',gpHour:140000,note:'AFK Woodcutting estimate'},
  {id:'combat-gargoyles',gpHour:550000,note:'Slayer loot less routine supplies'},
  {id:'combat-abyssal-demons',gpHour:500000,note:'Slayer loot planning estimate'},
  {id:'combat-skeletal-wyverns',gpHour:650000,note:'Loot less routine supplies'},
  {id:'combat-kraken',gpHour:850000,note:'Task-only boss planning estimate'},
]

export default function App() {
  const [mapping, setMapping] = useState<any[]>([])
  const [prices, setPrices] = useState<Record<string, any>>({})
  const [volumes, setVolumes] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [updated, setUpdated] = useState<Date | null>(null)
  const [error, setError] = useState('')

  const [mode, setMode] = useState<AccountMode>(
    (localStorage.getItem('osrs-mode') as AccountMode) || 'F2P'
  )

  const [gp, setGp] = useState(
    Number(localStorage.getItem('osrs-current-gp') || 200000)
  )

  const [quantity, setQuantity] = useState(
    Number(localStorage.getItem('osrs-quantity') || 500)
  )

  const [levels, setLevels] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('osrs-levels-v2')
      return saved
        ? { ...DEFAULT_LEVELS, ...JSON.parse(saved) }
        : DEFAULT_LEVELS
    } catch {
      return DEFAULT_LEVELS
    }
  })

  const [availableOnly, setAvailableOnly] = useState(false)
  const [showMembers, setShowMembers] = useState(true)
  const [profitFilter, setProfitFilter] = useState('All')
  const [skillFilter, setSkillFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [sort, setSort] = useState('profit')
  const [targetHours, setTargetHours] = useState(1)
  const [methodData, setMethodData] = useState<Record<string, MethodUserData>>(loadMethodData)
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null)
  const [activityTypeFilter, setActivityTypeFilter] = useState('All')
  const [attentionFilter, setAttentionFilter] = useState('All')
  const [purposeFilter, setPurposeFilter] = useState('All')
  const [noLossOnly, setNoLossOnly] = useState(false)
  const [planningFactor, setPlanningFactor] = useState(() => Number(localStorage.getItem('osrs-planning-factor-v24') || 50))
  const [gatheringData, setGatheringData] = useState<Record<string, MethodUserData>>(() => {
    try {
      const parsed=JSON.parse(localStorage.getItem('osrs-gathering-data-v24') || '{}')
      const baitId=`gather-${recipeId('Bait fish Sardine / Herring')}`
      if(!parsed[baitId]) parsed[baitId]={actualItemsPerHour:557,measuredQuantity:130,measuredMinutes:14}
      return parsed
    } catch { return {[`gather-${recipeId('Bait fish Sardine / Herring')}`]:{actualItemsPerHour:557,measuredQuantity:130,measuredMinutes:14}} }
  })
  const [editingGatheringId, setEditingGatheringId] = useState<string | null>(null)
  const [membershipDaysRemaining] = useState(() => Number(localStorage.getItem('osrs-member-days-v25') || 14))
  const [bondReserve, setBondReserve] = useState(() => Number(localStorage.getItem('osrs-bond-reserve-v25') || 2000000))
  const [emergencyBuffer, setEmergencyBuffer] = useState(() => Number(localStorage.getItem('osrs-emergency-buffer-v44') || 500000))
  const [bondHoursBudget, setBondHoursBudget] = useState(() => Number(localStorage.getItem('osrs-bond-hours-budget-v44') || 40))
  const [bondActiveDays, setBondActiveDays] = useState(() => Number(localStorage.getItem('osrs-bond-active-days-v44') || 10))
  const [dailyMaxHours, setDailyMaxHours] = useState(() => Number(localStorage.getItem('osrs-daily-max-hours-v44') || 4))
  const [bondScenario, setBondScenario] = useState<BondScenario>(() => (localStorage.getItem('osrs-bond-scenario-v44') as BondScenario) || 'CONSERVATIVE')
  const [progressionPriority, setProgressionPriority] = useState<ProgressionPriority>(() => (localStorage.getItem('osrs-progression-priority-v44') as ProgressionPriority) || 'BALANCED')
  const [playerMode, setPlayerMode] = useState<PlayerMode>(() => (localStorage.getItem('osrs-player-mode-v25') as PlayerMode) || 'NORMAL')
  const [geSlots] = useState(() => Number(localStorage.getItem('osrs-ge-slots-v25') || 3))
  const [requirements, setRequirements] = useState<Record<string,boolean>>(() => { try{return JSON.parse(localStorage.getItem('osrs-requirements-v25')||'{}')}catch{return{}} })
  const [v4Search, setV4Search] = useState('')
  const [v4ShowLocked, setV4ShowLocked] = useState(true)
  const [v4ViewAll, setV4ViewAll] = useState(false)
  const [v4KindFilter, setV4KindFilter] = useState('ALL')
  const [v4PlannerItem, setV4PlannerItem] = useState('')
  const [activeTab, setActiveTab] = useState<'dashboard'|'smart'|'skills'|'money'|'planner'|'database'|'coverage'>('dashboard')
  const [v5Page,setV5Page]=useState<V5PageId>('melee')
  const [v5Search,setV5Search]=useState('')
  const [v5ShowLocked,setV5ShowLocked]=useState(true)
  const [v5Edits,setV5Edits]=useState<Record<string,V5Edit>>(()=>{try{return JSON.parse(localStorage.getItem('osrs-v5-edits')||'{}')}catch{return{}}})
  const [v5Editing,setV5Editing]=useState<string|null>(null)
  const [v5BuyTargets,setV5BuyTargets]=useState<Record<string,number>>(()=>{
    try {
      const globalSaved=JSON.parse(localStorage.getItem('osrs-v5-global-buy-targets')||'{}')
      if(Object.keys(globalSaved).length) return globalSaved
      const legacy=JSON.parse(localStorage.getItem('osrs-v5-buy-targets')||'{}') as Record<string,Record<string,number>>
      const migrated:Record<string,number>={}
      Object.values(legacy).forEach(activity=>Object.entries(activity||{}).forEach(([item,price])=>{if(migrated[item]===undefined&&Number(price)>0)migrated[item]=Number(price)}))
      return migrated
    } catch { return {} }
  })

  type SmartProfile='FAST'|'BALANCED'|'PATIENT'
  type OrderSide='BUY'|'SELL'
  type OrderStatus='OPEN'|'PARTIAL'|'FILLED'|'CANCELLED'
  type OrderHistoryRow={id:string;date:string;item:string;side:OrderSide;quantity:number;orderPrice:number;filledQuantity:number;fillHours:number|null;status:OrderStatus;averageFillPrice:number|null}
  type TsPoint={timestamp:number;avgHighPrice:number|null;avgLowPrice:number|null;highPriceVolume:number;lowPriceVolume:number}
  const [smartProfile,setSmartProfile]=useState<SmartProfile>(()=>(localStorage.getItem('osrs-smart-profile-v56') as SmartProfile)||'PATIENT')
  const [smartQty,setSmartQty]=useState(()=>Number(localStorage.getItem('osrs-smart-qty-v56')||500))
  const [smartQtyPreset,setSmartQtyPreset]=useState('500')
  const [smartItem,setSmartItem]=useState('')
  const [smartSearch,setSmartSearch]=useState('')
  const [smartSeries,setSmartSeries]=useState<Record<string,TsPoint[]>>({})
  const [smartLoading,setSmartLoading]=useState<Record<string,boolean>>({})
  const [smartError,setSmartError]=useState('')
  const [smartRecipeId,setSmartRecipeId]=useState('')
  const [orderHistory,setOrderHistory]=useState<OrderHistoryRow[]>(()=>{try{return JSON.parse(localStorage.getItem('osrs-order-history-v56')||'[]')}catch{return[]}})
  const [historyDraft,setHistoryDraft]=useState({item:'',side:'BUY' as OrderSide,quantity:500,orderPrice:0,filledQuantity:0,fillHours:'',status:'FILLED' as OrderStatus,averageFillPrice:''})

  const [v5AccessFilter,setV5AccessFilter]=useState('ALL')
  const [v5KindFilter,setV5KindFilter]=useState('ALL')
  const [v5AttentionFilter,setV5AttentionFilter]=useState('ALL')
  const [v5DataFilter,setV5DataFilter]=useState('ALL')
  const [v5ProfitFilter,setV5ProfitFilter]=useState('ALL')
  const [v5Sort,setV5Sort]=useState('GP_DESC')
  const [v5MoneySkill,setV5MoneySkill]=useState('ALL')
  const [v5MoneyKind,setV5MoneyKind]=useState('ALL')
  const [v5MoneyAttention,setV5MoneyAttention]=useState('ALL')
  const [v5MoneyData,setV5MoneyData]=useState('ALL')
  const [v5MoneySearch,setV5MoneySearch]=useState('')
  const [v5IncludeUnverified,setV5IncludeUnverified]=useState(false)
  const [v4Page, setV4Page] = useState(1)
  const V4_PAGE_SIZE = 30
  const [measurementHistory, setMeasurementHistory] = useState<Record<string,Measurement[]>>(() => {
    try {
      const saved=JSON.parse(localStorage.getItem('osrs-measurement-history-v25')||'{}')
      if(Object.keys(saved).length) return saved
      return {
        [recipeId('Iron + 2 Coal → Steel bar')]: [{date:new Date().toISOString(),skillLevel:30,quantity:800,minutes:106,itemsPerHour:453}],
        [recipeId('Raw anchovies → Anchovies')]: [{date:new Date().toISOString(),skillLevel:28,quantity:504,minutes:28,itemsPerHour:1080,successful:495,burnt:9}],
        [`gather-${recipeId('Bait fish Sardine / Herring')}`]: [{date:new Date().toISOString(),skillLevel:50,quantity:130,minutes:14,itemsPerHour:557,outputs:{'Raw herring':478,'Raw sardine':522}}]
      }
    } catch { return {} }
  })
  const [mixedSamples, setMixedSamples] = useState<Record<string,Record<string,number>>>(() => { try{return JSON.parse(localStorage.getItem('osrs-mixed-samples-v25')||JSON.stringify({[`gather-${recipeId('Bait fish Sardine / Herring')}`]:{'Raw herring':478,'Raw sardine':522}}))}catch{return{}} })
  const [selectedBondMethod, setSelectedBondMethod] = useState('')


  useEffect(()=>{localStorage.setItem('osrs-smart-profile-v56',smartProfile)},[smartProfile])
  useEffect(()=>{localStorage.setItem('osrs-smart-qty-v56',String(smartQty))},[smartQty])
  useEffect(()=>{localStorage.setItem('osrs-order-history-v56',JSON.stringify(orderHistory))},[orderHistory])

  const updateMethodData = (id: string, patch: Partial<MethodUserData>) => {
    setMethodData((old) => ({
      ...old,
      [id]: { ...(old[id] || {}), ...patch },
    }))
  }

  const addMeasurement = (id:string, m:Measurement) => setMeasurementHistory(old=>({...old,[id]:[...(old[id]||[]),m]}))
  const historySummary = (id:string) => { const list=measurementHistory[id]||[]; return {count:list.length,last:list[list.length-1],weighted:weightedSpeed(list)} }

  const clearActualSpeed = (id: string) => {
    setMethodData((old) => {
      const next = { ...old }
      const current = { ...(next[id] || {}) }
      delete current.actualItemsPerHour
      delete current.measuredQuantity
      delete current.measuredMinutes
      next[id] = current
      return next
    })
  }

  const clearActualPrices = (id: string) => {
    setMethodData((old) => {
      const next = { ...old }
      const current = { ...(next[id] || {}) }
      delete current.actualBuyCost
      delete current.actualSellPrice
      next[id] = current
      return next
    })
  }


  const downloadFullBackup = () => {
    const data:Record<string,string> = {}
    for (let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i)
      if (key && key.startsWith('osrs-')) data[key]=localStorage.getItem(key) ?? ''
    }
    const payload={backupVersion:1,appVersion:'V5.6',createdAt:new Date().toISOString(),data}
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})
    const url=URL.createObjectURL(blob)
    const link=document.createElement('a')
    link.href=url
    link.download=`osrs-economy-backup-${new Date().toISOString().slice(0,10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const restoreFullBackup = async (file:File) => {
    try {
      const parsed=JSON.parse(await file.text())
      if (!parsed || parsed.backupVersion!==1 || typeof parsed.data!=='object') throw new Error('invalid')
      const entries=Object.entries(parsed.data as Record<string,string>).filter(([k])=>k.startsWith('osrs-'))
      if (!entries.length) throw new Error('empty')
      if (!window.confirm(`${entries.length} OSRS ayarı/verisi geri yüklenecek. Devam?`)) return
      entries.forEach(([k,v])=>localStorage.setItem(k,String(v)))
      window.alert('Yedek geri yüklendi. Sayfa yeniden açılacak.')
      window.location.reload()
    } catch {
      window.alert('Geçersiz veya desteklenmeyen OSRS yedek dosyası.')
    }
  }

  const refresh = async () => {
    setLoading(true)
    setError('')

    try {
      const [m, p, v] = await Promise.all([
        fetch(`${API}/mapping`),
        fetch(`${API}/latest`),
        fetch(`${API}/24h`),
      ])

      if (!m.ok || !p.ok || !v.ok) throw new Error()

      const md = await m.json()
      const pd = await p.json()
      const vd = await v.json()

      setMapping(md)
      setPrices(pd.data || {})
      setVolumes(vd.data || {})
      setUpdated(new Date())
    } catch {
      setError('OSRS Wiki fiyatları alınamadı.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{localStorage.setItem('osrs-v5-edits',JSON.stringify(v5Edits))},[v5Edits])
  useEffect(()=>{
    // Backward-compatible measurement migration: preserve legacy stores and mirror known measurements to canonical IDs.
    setV5Edits(old=>{
      const next={...old}; let changed=false
      const mirror=(id:string,rate:number,note:string)=>{
        const cur=next[id]||{}
        if(!(cur.measuredRate&&cur.measuredRate>0)){next[id]={...cur,measuredRate:rate,note:cur.note||note};changed=true}
      }
      const sapphireLegacy=methodData[recipeId('Sapphire amulet (u)')]?.actualItemsPerHour
      const steelLegacy=methodData[recipeId('Iron + 2 Coal → Steel bar')]?.actualItemsPerHour
      mirror('econ-f2p-sapphire-amulet-u',sapphireLegacy&&sapphireLegacy>0?sapphireLegacy:880,'Gerçek kullanıcı ölçümü: 880/h')
      mirror('econ-f2p-steel-bar',steelLegacy&&steelLegacy>0?steelLegacy:453,'800 adet gerçek test ≈453/h')
      mirror('econ-f2p-uncooked-apple-pie',2278,'486 adet / 12:48 gerçek ölçüm')
      return changed?next:old
    })
    setMeasurementHistory(old=>{
      const next={...old};let changed=false
      const add=(id:string,m:Measurement)=>{if(!(next[id]?.length)){next[id]=[m];changed=true}}
      add('econ-f2p-sapphire-amulet-u',{date:new Date().toISOString(),skillLevel:24,quantity:880,minutes:60,itemsPerHour:880})
      add('econ-f2p-steel-bar',{date:new Date().toISOString(),skillLevel:30,quantity:800,minutes:106,itemsPerHour:453})
      add('econ-f2p-uncooked-apple-pie',{date:new Date().toISOString(),skillLevel:30,quantity:486,minutes:12.8,itemsPerHour:2278})
      return changed?next:old
    })
  // Run once: never delete or reset legacy measurements.
  },[])
  useEffect(()=>{localStorage.setItem('osrs-v5-global-buy-targets',JSON.stringify(v5BuyTargets))},[v5BuyTargets])

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    localStorage.setItem('osrs-current-gp', String(gp))
    localStorage.setItem('osrs-quantity', String(quantity))
    localStorage.setItem('osrs-levels-v2', JSON.stringify(levels))
    localStorage.setItem('osrs-mode', mode)
    localStorage.setItem('osrs-method-data-v22', JSON.stringify(methodData))
    localStorage.setItem('osrs-target-hours-v22', String(targetHours))
    localStorage.setItem('osrs-planning-factor-v24', String(planningFactor))
    localStorage.setItem('osrs-gathering-data-v24', JSON.stringify(gatheringData))
    localStorage.setItem('osrs-member-days-v25', String(membershipDaysRemaining))
    localStorage.setItem('osrs-bond-reserve-v25', String(bondReserve))
    localStorage.setItem('osrs-emergency-buffer-v44', String(emergencyBuffer))
    localStorage.setItem('osrs-bond-hours-budget-v44', String(bondHoursBudget))
    localStorage.setItem('osrs-bond-active-days-v44', String(bondActiveDays))
    localStorage.setItem('osrs-daily-max-hours-v44', String(dailyMaxHours))
    localStorage.setItem('osrs-bond-scenario-v44', bondScenario)
    localStorage.setItem('osrs-progression-priority-v44', progressionPriority)
    localStorage.setItem('osrs-player-mode-v25', playerMode)
    localStorage.setItem('osrs-ge-slots-v25', String(geSlots))
    localStorage.setItem('osrs-requirements-v25', JSON.stringify(requirements))
    localStorage.setItem('osrs-measurement-history-v25', JSON.stringify(measurementHistory))
    localStorage.setItem('osrs-mixed-samples-v25', JSON.stringify(mixedSamples))
  }, [gp, quantity, levels, mode, methodData, targetHours, planningFactor, gatheringData, membershipDaysRemaining, bondReserve, emergencyBuffer, bondHoursBudget, bondActiveDays, dailyMaxHours, bondScenario, progressionPriority, playerMode, geSlots, requirements, measurementHistory, mixedSamples])

  useEffect(() => {
    const savedHours = Number(localStorage.getItem('osrs-target-hours-v22'))
    if ([0.5, 1, 2, 3].includes(savedHours)) setTargetHours(savedHours)
  }, [])

  const items = useMemo(() => {
    const result: Record<string, any> = {}
    mapping.forEach((i) => {
      result[i.name.toLowerCase()] = i
    })
    return result
  }, [mapping])

  const getItem = (name: string) => items[name.toLowerCase()]

  const buy = (name: string): number | null => {
    const i = getItem(name)
    return i ? prices[i.id]?.high ?? null : null
  }

  const sell = (name: string): number | null => {
    const i = getItem(name)
    return i ? prices[i.id]?.low ?? null : null
  }

  const volume = (name: string): number | null => {
    const i = getItem(name)
    if (!i) return null
    const d = volumes[i.id]
    if (!d) return null
    return (d.highPriceVolume || 0) + (d.lowPriceVolume || 0)
  }

  const loadSmartSeries=async(itemName:string)=>{
    const item=getItem(itemName)
    if(!item||smartLoading[itemName]) return
    if(smartSeries[itemName]?.length) return
    setSmartLoading(old=>({...old,[itemName]:true}));setSmartError('')
    try{
      const res=await fetch(`${API}/timeseries?timestep=5m&id=${item.id}`)
      if(!res.ok) throw new Error(`Timeseries HTTP ${res.status}`)
      const json=await res.json()
      const cutoff=Math.floor(Date.now()/1000)-24*3600
      const pts=(json.data||[]).filter((x:any)=>x.timestamp>=cutoff).map((x:any)=>({
        timestamp:Number(x.timestamp),avgHighPrice:x.avgHighPrice??null,avgLowPrice:x.avgLowPrice??null,
        highPriceVolume:Number(x.highPriceVolume||0),lowPriceVolume:Number(x.lowPriceVolume||0)
      })) as TsPoint[]
      setSmartSeries(old=>({...old,[itemName]:pts}))
    }catch(e:any){setSmartError(e?.message||'24h zaman serisi alınamadı')}
    finally{setSmartLoading(old=>({...old,[itemName]:false}))}
  }

  const weightedQuantile=(pairs:{v:number;w:number}[],q:number)=>{
    const a=pairs.filter(x=>Number.isFinite(x.v)&&x.v>0&&x.w>0).sort((x,y)=>x.v-y.v)
    if(!a.length)return null
    const total=a.reduce((s,x)=>s+x.w,0);let run=0
    for(const x of a){run+=x.w;if(run>=total*q)return x.v}
    return a[a.length-1].v
  }
  const median=(vals:number[])=>{const a=[...vals].sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
  const smartAdvice=(itemName:string,profile:SmartProfile,qty:number)=>{
    const pts=smartSeries[itemName]||[]
    const raw=pts.flatMap(p=>[
      ...(p.avgHighPrice? [{v:p.avgHighPrice,w:Math.max(1,p.highPriceVolume)}]:[]),
      ...(p.avgLowPrice? [{v:p.avgLowPrice,w:Math.max(1,p.lowPriceVolume)}]:[])
    ])
    if(!raw.length)return null
    const vals=raw.map(x=>x.v),med=median(vals)!
    const deviations=vals.map(v=>Math.abs(v-med)),mad=median(deviations)||Math.max(1,med*.01)
    const filtered=raw.filter(x=>Math.abs(x.v-med)<=Math.max(3*mad,med*.08))
    const use=filtered.length>=Math.max(8,raw.length*.5)?filtered:raw
    const dailyVol=pts.reduce((s,p)=>s+p.highPriceVolume+p.lowPriceVolume,0)
    const low=Math.min(...use.map(x=>x.v)),high=Math.max(...use.map(x=>x.v))
    const vwap=use.reduce((s,x)=>s+x.v*x.w,0)/Math.max(1,use.reduce((s,x)=>s+x.w,0))
    // Profile semantics: FAST aims mainly <1h, BALANCED 1–6h, PATIENT exploits a real 6–24h window.
    // PATIENT deliberately samples deeper distribution tails instead of being BALANCED ± a few GP.
    const qBuy=profile==='FAST'?.62:profile==='BALANCED'?.38:.12
    const qSell=profile==='FAST'?.38:profile==='BALANCED'?.62:.88
    let recBuy=weightedQuantile(use,qBuy)!,recSell=weightedQuantile(use,qSell)!
    const pressure=dailyVol>0?qty/dailyVol:1
    const levelVolume=(price:number)=>use.filter(x=>Math.abs(x.v-price)/Math.max(1,price)<=.0125).reduce((s,x)=>s+x.w,0)
    const buyLevelVol=levelVolume(recBuy),sellLevelVol=levelVolume(recSell)
    const localPressureBuy=buyLevelVol>0?qty/buyLevelVol:1
    const localPressureSell=sellLevelVol>0?qty/sellLevelVol:1
    const impactBuy=Math.min(.15,Math.max(0,pressure-.0015)*.9+Math.max(0,localPressureBuy-.04)*.08)
    const impactSell=Math.min(.15,Math.max(0,pressure-.0015)*.9+Math.max(0,localPressureSell-.04)*.08)
    recBuy*=1+impactBuy;recSell*=1-impactSell
    const hist=orderHistory.filter(h=>h.item===itemName&&h.quantity>0&&qty/h.quantity>=.35&&qty/h.quantity<=3)
    const targetHours=profile==='FAST'?1:profile==='BALANCED'?6:18
    const historySignal=(side:OrderSide)=>{
      const hs=hist.filter(h=>h.side===side&&h.fillHours!==null)
      if(!hs.length)return {hours:null as number|null,success:0,count:0,price:null as number|null}
      let wSum=0,hSum=0,sSum=0
      let priceSum=0
      hs.forEach(h=>{
        const qtySimilarity=Math.max(.15,1-Math.abs(Math.log(Math.max(.01,qty/h.quantity)))/1.2)
        const fillRatio=Math.max(0,Math.min(1,h.filledQuantity/Math.max(1,h.quantity)))
        const statusFactor=h.status==='FILLED'?1:h.status==='PARTIAL'?.55:h.status==='CANCELLED'?.25:.35
        const executedPrice=h.averageFillPrice&&h.averageFillPrice>0?h.averageFillPrice:h.orderPrice
        const priceSimilarity=Math.max(.2,1-Math.abs(executedPrice-med)/Math.max(1,med))
        const w=qtySimilarity*priceSimilarity*(.35+.65*fillRatio)*statusFactor
        wSum+=w;hSum+=(h.fillHours||0)*w;priceSum+=executedPrice*w
        sSum+=(h.status==='FILLED'?1:h.status==='PARTIAL'?fillRatio:0)*w
      })
      return {hours:wSum?hSum/wSum:null,success:wSum?sSum/wSum:0,count:hs.length,price:wSum?priceSum/wSum:null as number|null}
    }
    const buyHist=historySignal('BUY'),sellHist=historySignal('SELL')
    const historyWeight=(count:number)=>Math.min(.65,count/10*.65) // 1–2 orders have deliberately small influence.
    const nudgePrice=(price:number,signal:{hours:number|null;success:number;count:number;price:number|null},side:OrderSide)=>{
      if(signal.hours===null)return price
      const w=historyWeight(signal.count)
      const timeDelta=(signal.hours-targetHours)/Math.max(1,targetHours)
      const failurePenalty=(1-signal.success)
      const historicalPriceDelta=signal.price===null?0:(signal.price-price)/Math.max(1,price)
      const evidencePull=Math.max(-.08,Math.min(.08,historicalPriceDelta))*w*.45
      const nudge=Math.min(.10,Math.abs(timeDelta)*.025+failurePenalty*.035)*w
      const timeAdjusted=side==='BUY'
        ?((timeDelta>0||failurePenalty>.35)?price*(1+nudge):price*(1-nudge))
        :((timeDelta>0||failurePenalty>.35)?price*(1-nudge):price*(1+nudge))
      return timeAdjusted*(1+evidencePull)
    }
    recBuy=nudgePrice(recBuy,buyHist,'BUY');recSell=nudgePrice(recSell,sellHist,'SELL')
    const avgBuyHours=buyHist.hours,avgSellHours=sellHist.hours
    const completed=hist.filter(h=>h.status==='FILLED'&&h.fillHours!==null)
    recBuy=Math.max(1,Math.round(recBuy));recSell=Math.max(1,Math.round(recSell))
    const samples=pts.length
    let score=0
    score+=samples>=180?2:samples>=60?1:0
    score+=dailyVol>=Math.max(10000,qty*20)?2:dailyVol>=Math.max(1000,qty*5)?1:0
    score+=Math.min(buyLevelVol,sellLevelVol)>=qty*8?1:0
    score+=completed.length>=5?2:completed.length>=2?1:0
    if(pressure>.10||Math.max(localPressureBuy,localPressureSell)>.5)score-=1
    const confidence=score>=5?'HIGH':score>=3?'MEDIUM':'LOW'
    const fillRatio=dailyVol>0?qty/dailyVol:1
    const base=profile==='FAST'?0:profile==='BALANCED'?1:2
    const fillMeta=(hours:number|null,localPressure:number)=>{
      const volPenalty=fillRatio>.1?2:fillRatio>.03?1:0
      const levelPenalty=localPressure>.8?2:localPressure>.3?1:0
      const histPenalty=hours===null?0:hours>24?2:hours>12&&profile!=='PATIENT'?1:hours<1&&profile==='FAST'?-1:0
      const diff=Math.max(0,Math.min(4,base+volPenalty+levelPenalty+histPenalty))
      const ranges=profile==='FAST'
        ? ['<1 saat','1–6 saat','6–12 saat','12–24 saat','24 saat+']
        :profile==='BALANCED'
          ? ['1–6 saat','1–6 saat','6–12 saat','12–24 saat','24 saat+']
          :['6–12 saat','12–24 saat','12–24 saat','24 saat+','24 saat+']
      return {range:ranges[diff],difficulty:['ÇOK KOLAY','KOLAY','ORTA','ZOR','ÇOK ZOR'][diff]}
    }
    const buyFill=fillMeta(avgBuyHours,localPressureBuy),sellFill=fillMeta(avgSellHours,localPressureSell)
    const currentBuy=buy(itemName),currentSell=sell(itemName)
    return {item:itemName,profile,qty,recBuy,recSell,currentBuy,currentSell,low,high,vwap,median:weightedQuantile(use,.5),dailyVol,confidence,buyFill,sellFill,samples,filteredCount:raw.length-use.length,historyCount:hist.length,avgBuyHours,avgSellHours}
  }
  const selectedSmart=smartItem?smartAdvice(smartItem,smartProfile,smartQty):null
  const selectedSmartProfiles=smartItem?(['FAST','BALANCED','PATIENT'] as SmartProfile[]).map(p=>smartAdvice(smartItem,p,smartQty)).filter(Boolean):[]


  const addOrderHistory=()=>{
    if(!historyDraft.item||historyDraft.quantity<=0||historyDraft.orderPrice<=0)return
    const row:OrderHistoryRow={id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,date:new Date().toISOString(),item:historyDraft.item,side:historyDraft.side,quantity:historyDraft.quantity,orderPrice:historyDraft.orderPrice,filledQuantity:historyDraft.filledQuantity,fillHours:historyDraft.fillHours===''?null:Number(historyDraft.fillHours),status:historyDraft.status,averageFillPrice:historyDraft.averageFillPrice===''?null:Number(historyDraft.averageFillPrice)}
    setOrderHistory(old=>[row,...old])
  }

  const rows = useMemo(() => {
    return RECIPES.map((r) => {
      const id = recipeId(r.name)
      const userData = methodData[id] || {}
      const verifiedF2P = r.verifiedF2P !== false
      const membersLocked = mode === 'F2P' ? (!r.f2p || !verifiedF2P) : (!r.f2p && !r.verifiedP2P)
      const currentLevel = levels[r.skill] ?? 1
      const levelLocked = currentLevel < r.level
      const reqs = [r.questRequirement, r.accessRequirement, r.regionRequirement, r.diaryRequirement, r.minigameRequirement, r.equipment].filter(Boolean) as string[]
      const missingRequirements = mode === 'MEMBER' ? reqs.filter(x => !requirements[x]) : []
      const requirementLocked = missingRequirements.length > 0

      let status = '✓ AÇIK'
      if (mode === 'F2P' && !verifiedF2P) status = '🔒 F2P DOĞRULANMADI'
      else if (mode === 'MEMBER' && !r.f2p && !r.verifiedP2P) status = '🔒 P2P DOĞRULANMADI'
      else if (membersLocked) status = '🔒 MEMBERS'
      else if (levelLocked) status = `🔒 ${r.skill.toUpperCase()} ${r.level}`
      else if (requirementLocked) status = `🔒 ${missingRequirements.join(', ')}`

      const unlocked = !membersLocked && !levelLocked && !requirementLocked

      let inputCost = 0
      let outputPrice: number | null = null
      let outputNet: number | null = null
      let successRate = r.success ? r.success(levels) : 1
      const theoreticalSuccessRate = r.cooking ? cookingSuccessEstimate(currentLevel, r.level, r.cooking.noBurnLevel) : successRate
      const successAtLevel = userData.actualSuccessByLevel?.[String(currentLevel)]
      if (r.cooking) successRate = successAtLevel?.rate ?? theoreticalSuccessRate
      let dailyVolume: number | null = null
      let ingredientsText = ''
      let alchValue: number | null = null

      if (r.kind === 'alchemy') {
        const itemName = r.alchItem!
        const itemData = getItem(itemName)
        const itemBuy = buy(itemName)
        const nature = buy('Nature rune')

        if (itemBuy !== null && nature !== null && itemData) {
          inputCost = itemBuy + nature
          alchValue =
            r.alchType === 'high'
              ? itemData.highalch ?? null
              : itemData.lowalch ?? null

          outputPrice = alchValue
          outputNet = alchValue
          dailyVolume = volume(itemName)
          ingredientsText = `1× ${itemName} + 1× Nature rune`
        }
      } else {
        let valid = true

        const ingredientParts: string[] = []

        for (const input of r.inputs) {
          const p = buy(input.name)
          ingredientParts.push(`${input.qty}× ${input.name}`)

          if (p === null) valid = false
          else inputCost += p * input.qty
        }

        inputCost += r.fee || 0
        ingredientsText = ingredientParts.join(' + ')

        const s = r.output ? sell(r.output) : null

        if (valid && s !== null) {
          outputPrice = s * (r.outputQty || 1)

          const taxPerOutput = geTax(s)
          outputNet =
            (s - taxPerOutput) * (r.outputQty || 1)

          dailyVolume = volume(r.output!)
        }
      }

      const wikiInputCost = inputCost
      const wikiOutputNet = outputNet

      if (userData.actualBuyCost !== undefined && userData.actualBuyCost > 0) {
        inputCost = userData.actualBuyCost
      }

      if (userData.actualSellPrice !== undefined && userData.actualSellPrice > 0) {
        if (r.kind === 'alchemy') {
          outputNet = userData.actualSellPrice
        } else {
          const actualTax = geTax(userData.actualSellPrice)
          outputNet = (userData.actualSellPrice - actualTax) * (r.outputQty || 1)
        }
      }

      const valid =
        outputNet !== null &&
        Number.isFinite(inputCost) &&
        inputCost > 0

      const isRawCooking = Boolean(r.cooking)
      // Raw cooking is evaluated per RAW attempt: failures consume the raw item and earn no XP.
      // Other legacy recipes retain the previous per-success economics.
      const effectiveCost = isRawCooking
        ? (valid ? inputCost : null)
        : (valid && successRate > 0 ? inputCost / successRate : null)
      const expectedXpPerItem = isRawCooking ? r.xp * successRate : r.xp
      const profit = isRawCooking
        ? (valid && outputNet !== null ? outputNet * successRate - inputCost : null)
        : (effectiveCost !== null && outputNet !== null ? outputNet - effectiveCost : null)
      const roi = profit !== null && effectiveCost !== null && effectiveCost > 0 ? (profit / effectiveCost) * 100 : null
      const profitPerXp = profit !== null && expectedXpPerItem > 0 ? profit / expectedXpPerItem : null

      const theoreticalItemsPerHour = isRawCooking ? r.itemsPerHour : r.itemsPerHour * successRate
      const hasActualSpeed =
        userData.actualItemsPerHour !== undefined &&
        userData.actualItemsPerHour > 0
      const effectiveItemsPerHour = hasActualSpeed
        ? userData.actualItemsPerHour!
        : theoreticalItemsPerHour
      const speedSource = hasActualSpeed ? 'GERÇEK' : 'TAHMİN'

      const planningItemsPerHour = hasActualSpeed ? effectiveItemsPerHour : effectiveItemsPerHour * clamp(planningFactor / 100, 0.1, 1)
      const gpHour = profit !== null ? profit * planningItemsPerHour : null
      const xpHour = expectedXpPerItem * planningItemsPerHour

      const qty = Math.max(1, Math.floor(quantity || 1))

      const attemptsForQty = isRawCooking ? qty : (successRate > 0 ? qty / successRate : qty)

      const capitalForQty =
        valid
          ? inputCost * attemptsForQty
          : null

      const profitForQty =
        profit !== null
          ? profit * qty
          : null

      const xpForQty = expectedXpPerItem * qty

      const maxByCapital =
        effectiveCost !== null && effectiveCost > 0
          ? Math.max(0, Math.floor(gp / effectiveCost))
          : 0

      const timePotentialQty = Math.max(0, Math.floor(planningItemsPerHour * targetHours))
      const timeLimitedQty = Math.min(timePotentialQty, maxByCapital)
      const timeCapital =
        effectiveCost !== null ? effectiveCost * timeLimitedQty : null
      const timeProfit = profit !== null ? profit * timeLimitedQty : null
      const timeXp = expectedXpPerItem * timeLimitedQty

      const autoPurpose: MethodPurpose =
        profit !== null && profit > 0 && r.xp > 0
          ? 'SKILL + PROFIT'
          : profit !== null && profit > 0
          ? 'MONEY'
          : 'XP'
      const purpose = userData.purpose || autoPurpose

      const itemsPerRun = Math.max(
        1,
        Math.floor(userData.itemsPerRun || defaultItemsPerRun(r))
      )
      const profitPerRun = profit !== null ? profit * itemsPerRun : null
      const xpPerRun = expectedXpPerItem * itemsPerRun
      const expectedSuccessfulPerRun = itemsPerRun * successRate
      const expectedBurntPerRun = isRawCooking ? itemsPerRun * (1 - successRate) : 0
      const afkSecondsPerRun = r.cooking?.afkSecondsPerRun ?? null
      const attentionLevel = userData.attentionLevel || r.attentionLevel || (r.activityType === 'Cooking' ? 'LOW' : 'MEDIUM')
      const activityType: ActivityType = r.activityType || (r.category === 'Cooking' || r.category === 'Food' ? 'Cooking' : 'Processing')
      const capitalPerRun = effectiveCost !== null ? effectiveCost * itemsPerRun : null

      const slotsPerAttempt =
        r.kind === 'alchemy'
          ? 2
          : Math.max(
              1,
              r.inputs.reduce((sum, i) => sum + i.qty, 0)
            )

      const inventoryProcesses =
        Math.max(1, Math.floor(28 / slotsPerAttempt))

      const inventoryProfit =
        profit !== null
          ? profit * inventoryProcesses
          : null

      return {
        ...r,
        currentLevel,
        membersLocked,
        levelLocked,
        requirementLocked,
        missingRequirements,
        unlocked,
        status,
        inputCost,
        effectiveCost,
        outputPrice,
        outputNet,
        profit,
        roi,
        profitPerXp,
        successRate,
        dailyVolume,
        id,
        userData,
        wikiInputCost,
        wikiOutputNet,
        theoreticalItemsPerHour,
        effectiveItemsPerHour,
        speedSource,
        planningItemsPerHour,
        gpHour,
        xpHour,
        capitalForQty,
        profitForQty,
        xpForQty,
        maxByCapital,
        timePotentialQty,
        timeLimitedQty,
        timeCapital,
        timeProfit,
        timeXp,
        purpose,
        itemsPerRun,
        profitPerRun,
        xpPerRun,
        expectedXpPerItem,
        expectedSuccessfulPerRun,
        expectedBurntPerRun,
        afkSecondsPerRun,
        theoreticalSuccessRate,
        successAtLevel,
        attentionLevel,
        activityType,
        verifiedF2P,
        capitalPerRun,
        inventoryProfit,
        ingredientsText,
        alchValue,
      }
    })
  }, [mapping, prices, volumes, levels, mode, quantity, methodData, gp, targetHours, planningFactor])

  const visibleRows = useMemo(() => {
    let result = [...rows]

    if (!showMembers && mode === 'F2P') {
      result = result.filter((r) => !r.membersLocked)
    }

    if (availableOnly) {
      result = result.filter((r) => r.unlocked)
    }

    if (profitFilter === 'Profit') {
      result = result.filter(
        (r) => r.unlocked && (r.profit ?? -Infinity) > 0
      )
    }

    if (profitFilter === 'Loss') {
      result = result.filter(
        (r) => r.unlocked && (r.profit ?? Infinity) < 0
      )
    }

    if (skillFilter !== 'All') {
      result = result.filter((r) => r.skill === skillFilter)
    }

    if (categoryFilter !== 'All') {
      result = result.filter((r) => r.category === categoryFilter)
    }

    if (activityTypeFilter !== 'All') result = result.filter((r) => r.activityType === activityTypeFilter)
    if (attentionFilter !== 'All') result = result.filter((r) => r.attentionLevel === attentionFilter)
    if (purposeFilter !== 'All') result = result.filter((r) => r.purpose === purposeFilter)
    if (noLossOnly) result = result.filter((r) => (r.profit ?? -Infinity) >= 0)

    /*
      CRITICAL:
      F2P account + members recipe can NEVER influence economic ranking.
      Members rows are always sent to the bottom.
    */
    result.sort((a, b) => {
      if (a.membersLocked !== b.membersLocked) {
        return a.membersLocked ? 1 : -1
      }

      if (a.unlocked !== b.unlocked) {
        return a.unlocked ? -1 : 1
      }

      if (sort === 'roi')
        return (b.roi ?? -Infinity) - (a.roi ?? -Infinity)

      if (sort === 'gph')
        return (b.gpHour ?? -Infinity) - (a.gpHour ?? -Infinity)

      if (sort === 'runprofit')
        return (b.profitPerRun ?? -Infinity) - (a.profitPerRun ?? -Infinity)

      if (sort === 'level')
        return a.level - b.level

      if (sort === 'volume')
        return (b.dailyVolume ?? -Infinity) - (a.dailyVolume ?? -Infinity)

      return (b.profit ?? -Infinity) - (a.profit ?? -Infinity)
    })

    return result
  }, [
    rows,
    showMembers,
    availableOnly,
    profitFilter,
    skillFilter,
    categoryFilter,
    activityTypeFilter,
    attentionFilter,
    purposeFilter,
    noLossOnly,
    sort,
    mode,
  ])

  const bondItem = mapping.find(
    (i) => i.name.toLowerCase() === 'old school bond'
  )

  const bond = bondItem
    ? prices[bondItem.id]?.high ??
      prices[bondItem.id]?.low ??
      null
    : null

  const bondProgress = bond
    ? Math.min((gp / bond) * 100, 100)
    : 0

  const missing = bond
    ? Math.max(bond - gp, 0)
    : null

  const categories = [
    'All',
    ...Array.from(new Set(RECIPES.map((r) => r.category))),
  ]

  const scoreProcessing = (candidates: any[]) => {
    if (!candidates.length) return []
    const maxPI = Math.max(...candidates.map(r => Math.max(r.profit ?? 0, 0)), 1)
    const maxPR = Math.max(...candidates.map(r => Math.max(r.profitPerRun ?? 0, 0)), 1)
    const maxROI = Math.max(...candidates.map(r => Math.max(r.roi ?? 0, 0)), 1)
    const maxVol = Math.max(...candidates.map(r => Math.log10((r.dailyVolume ?? 0) + 1)), 1)
    const maxXP = Math.max(...candidates.map(r => Math.max(r.xpPerRun ?? 0, 0)), 1)
    return candidates.map(r => ({ ...r, recommendationScore:
      (Math.max(r.profit ?? 0,0)/maxPI)*.30 + (Math.max(r.profitPerRun ?? 0,0)/maxPR)*.30 +
      (Math.max(r.roi ?? 0,0)/maxROI)*.20 + (Math.log10((r.dailyVolume ?? 0)+1)/maxVol)*.15 +
      (Math.max(r.xpPerRun ?? 0,0)/maxXP)*.05
    })).sort((a,b)=>b.recommendationScore-a.recommendationScore).slice(0,3)
  }

  const processingTop3 = useMemo(() => scoreProcessing(rows.filter(r => r.unlocked && (mode==='F2P'?r.verifiedF2P:(r.f2p?r.verifiedF2P:r.verifiedP2P)) && r.activityType !== 'Gathering' && r.profit !== null && r.profit > 0 && r.capitalPerRun !== null && r.capitalPerRun <= gp)), [rows, gp, mode])

  const gatheringRows = useMemo(() => GATHERING.map(a => {
    const id = `gather-${recipeId(a.name)}`
    const ud = gatheringData[id] || {}
    const level = levels[a.skill] ?? 1
    const memberOk = mode === 'MEMBER' && (a.f2p ? a.verifiedF2P : a.verifiedP2P)
    const f2pOk = mode === 'F2P' && a.f2p && a.verifiedF2P
    const gatherReqs=[a.questRequirement,a.accessRequirement,a.regionRequirement,a.equipment].filter(Boolean) as string[]
    const missingRequirements = mode==='MEMBER' ? gatherReqs.filter(x=>!requirements[x]) : []
    const unlocked = (f2pOk || memberOk) && level >= a.requiredLevel && missingRequirements.length===0
    const sellPrice = sell(a.item)
    const secondarySell = a.secondaryItem ? sell(a.secondaryItem) : null
    const primaryNet = sellPrice === null ? null : sellPrice - geTax(sellPrice)
    const secondaryNet = secondarySell === null ? null : secondarySell - geTax(secondarySell)
    const sample=mixedSamples[id]
    const sampleTotal=sample?Object.values(sample).reduce((x,y)=>x+y,0):0
    const share = a.secondaryItem && sampleTotal>0 ? ((sample[a.item]||0)/sampleTotal) : (a.primaryShare ?? 1)
    const netSell = primaryNet === null ? null : (a.secondaryItem && secondaryNet !== null ? primaryNet * share + secondaryNet * (1-share) : primaryNet)
    const xpPerItem = a.secondaryXpPerSuccess !== undefined ? a.xpPerSuccess * share + a.secondaryXpPerSuccess * (1-share) : a.xpPerSuccess
    const actual = ud.actualItemsPerHour && ud.actualItemsPerHour > 0 ? ud.actualItemsPerHour : null
    const effectiveItemsPerHour = actual ?? a.theoreticalItemsPerHour
    const planningItemsPerHour = actual ?? a.theoreticalItemsPerHour * clamp(planningFactor/100, .1, 1)
    const gpHour = netSell === null ? null : netSell * planningItemsPerHour
    const xpHour = xpPerItem * planningItemsPerHour
    return { ...a, id, userData: ud, currentLevel: level, unlocked, missingRequirements, sampleTotal, actualPrimaryShare:share, netSell, xpPerItem, effectiveItemsPerHour, planningItemsPerHour, gpHour, xpHour, speedSource: actual ? 'GERÇEK' : 'TAHMİN' }
  }), [gatheringData, levels, prices, mapping, planningFactor, mode, requirements, mixedSamples])

  const gatheringTop3 = useMemo(() => gatheringRows.filter(r => r.unlocked && r.netSell !== null).map(r => {
    const riskPenalty = r.competitionRisk === 'HIGH' ? .65 : r.competitionRisk === 'MEDIUM' ? .82 : 1
    const attentionBonus = r.attentionLevel === 'AFK' ? 1.12 : r.attentionLevel === 'LOW' ? 1.06 : 1
    return { ...r, gatherScore: Math.max(r.gpHour ?? 0,0) * riskPenalty * attentionBonus + r.xpHour * .05 }
  }).sort((a,b)=>b.gatherScore-a.gatherScore).slice(0,3), [gatheringRows])

  const afkTop3 = useMemo(() => {
    const proc = rows.filter(r => r.unlocked && (mode==='F2P'?r.verifiedF2P:(r.f2p?r.verifiedF2P:r.verifiedP2P)) && ['LOW','AFK'].includes(r.attentionLevel) && (r.profit ?? -Infinity) >= 0).map(r => ({ kind:'processing', ...r, afkScore: (r.afkSecondsPerRun ?? 20) + Math.max(r.xpPerRun ?? 0,0)/100 + Math.max(r.profitPerRun ?? 0,0)/1000 }))
    const gat = gatheringRows.filter(r => r.unlocked && ['LOW','AFK'].includes(r.attentionLevel)).map(r => ({ kind:'gathering', ...r, profitPerRun:null, xpPerRun:null, afkSecondsPerRun:null, profit:r.netSell, afkScore: (r.attentionLevel==='AFK'?100:60) + r.xpHour/1000 + Math.max(r.gpHour ?? 0,0)/10000 }))
    return [...proc, ...gat].sort((a,b)=>(b.afkScore??0)-(a.afkScore??0)).slice(0,3)
  }, [rows, gatheringRows])


  const bondTarget = (bond ?? 0) + bondReserve + emergencyBuffer
  const remainingSafeGp = bond ? Math.max(bondTarget - gp, 0) : 0
  const allOpenMethods = [
    ...rows.filter(r=>r.unlocked && (r.gpHour??0)>0).map(r=>({id:r.id,name:r.name,gpHour:r.gpHour??0,source:r.speedSource,attention:r.attentionLevel})),
    ...gatheringRows.filter(r=>r.unlocked && (r.gpHour??0)>0).map(r=>({id:r.id,name:r.name,gpHour:r.gpHour??0,source:r.speedSource,attention:r.attentionLevel}))
  ]
  const preferenceWeight=(m:any)=> playerMode==='ACTIVE' ? (m.gpHour*(m.attention==='HIGH'?1.08:1)) : playerMode==='CHILL' ? (m.gpHour*(m.attention==='AFK'?1.25:m.attention==='LOW'?1.12:.75)) : m.gpHour
  const bondSustainTop3=[...allOpenMethods].sort((a,b)=>preferenceWeight(b)-preferenceWeight(a)).slice(0,3)
  const chosenBondMethod=allOpenMethods.find(x=>x.id===selectedBondMethod) || bondSustainTop3[0]
  const realisticGpHour=chosenBondMethod?.gpHour || 0
  const requiredNetGp40=remainingSafeGp/40
  const requiredNetGp50=remainingSafeGp/50
  const requiredNetGpBudget=remainingSafeGp/Math.max(1,bondHoursBudget)
  const scenarioFactor=bondScenario==='CONSERVATIVE'?.80:1
  const sustainableGpHour=realisticGpHour*scenarioFactor
  const sustainableHours=sustainableGpHour>0?remainingSafeGp/sustainableGpHour:null
  const sustainabilityStatus = sustainableHours===null ? 'NO DATA'
    : sustainableHours>50 ? 'NOT SUSTAINABLE'
    : sustainableHours>40 ? 'BARELY SUSTAINABLE'
    : sustainableHours>20 ? 'SUSTAINABLE'
    : sustainableHours>=10 ? 'COMFORTABLE'
    : 'VERY COMFORTABLE'
  const planCapacityHours=Math.max(1,bondActiveDays)*Math.max(.25,dailyMaxHours)
  const expectedCompletionDays=sustainableGpHour>0?Math.ceil((remainingSafeGp/sustainableGpHour)/Math.max(.25,dailyMaxHours)):null
  const bufferDays=expectedCompletionDays===null?null:Math.max(0,14-expectedCompletionDays)
  const primaryMoneyMaker=bondSustainTop3[0]
  const lowAttentionBackup=[...allOpenMethods].filter(m=>['LOW','AFK'].includes(m.attention)).sort((x,y)=>y.gpHour-x.gpHour)[0]
  const marketBackup=[...allOpenMethods].filter(m=>m.id!==primaryMoneyMaker?.id && m.id!==lowAttentionBackup?.id).sort((x,y)=>y.gpHour-x.gpHour)[0]
  const measuredMethodCount=allOpenMethods.filter(m=>m.source==='GERÇEK').length
  const measurementCount=Object.values(measurementHistory).reduce((n,list)=>n+list.length,0)
  const measurementConfidence=measurementCount>=8?'HIGH':measurementCount>=4?'MEDIUM':'LOW'
  const v4RequirementNames = V4_ACTIVITY_DATABASE.flatMap(a => [...(a.requirements.quests ?? []), ...(a.requirements.areas ?? []), ...(a.requirements.diary ?? []), ...(a.requirements.minigame ?? [])])
  const requirementNames=Array.from(new Set([...RECIPES.flatMap(r=>[r.questRequirement,r.accessRequirement,r.regionRequirement,r.diaryRequirement,r.minigameRequirement,r.equipment]),...GATHERING.flatMap(a=>[a.questRequirement,a.accessRequirement,a.regionRequirement,a.equipment]),...v4RequirementNames].filter(Boolean))) as string[]
  const requirementGroups = useMemo(() => {
    const groups:{title:string;items:string[]}[] = [
      {title:'Quests',items:Array.from(new Set(V4_ACTIVITY_DATABASE.flatMap(a=>a.requirements.quests??[])))},
      {title:'Areas / Access',items:Array.from(new Set(V4_ACTIVITY_DATABASE.flatMap(a=>a.requirements.areas??[])))},
      {title:'Diaries',items:Array.from(new Set(V4_ACTIVITY_DATABASE.flatMap(a=>a.requirements.diary??[])))},
      {title:'Minigames',items:Array.from(new Set(V4_ACTIVITY_DATABASE.flatMap(a=>a.requirements.minigame??[])))},
    ]
    const grouped=new Set(groups.flatMap(g=>g.items))
    const legacy=requirementNames.filter(x=>!grouped.has(x))
    if(legacy.length) groups.push({title:'Legacy / Other',items:legacy})
    return groups.filter(g=>g.items.length)
  }, [requirementNames.join('|')])

  const nextUnlocks=rows.filter(r=>!r.unlocked && !r.membersLocked && r.levelLocked && (r.profit??0)>0).map(r=>({...r,levelsMissing:Math.max(0,r.level-r.currentLevel),xpMissing:Math.max(0,xpForLevel(r.level)-xpForLevel(r.currentLevel))})).sort((a,b)=>a.levelsMissing-b.levelsMissing).slice(0,5)



  const v5LiveEconomy=(a:(typeof V5_CATALOGUE)[number])=>{
    type Leg={name:string;qty:number;price:number|null}
    let inputs:Leg[]=[]
    let outputName:string|undefined=a.output
    let outputQty=1
    let liveEligible=false

    const addInputs=(parts:{name:string;qty:number}[])=>{inputs=parts.map(p=>({...p,price:buy(p.name)}));liveEligible=true}

    // V5.8 structured recipes: exact quantities override legacy string parsing.
    if(a.inputs?.length) addInputs(a.inputs)
    if(a.outputQty&&a.outputQty>0) outputQty=a.outputQty

    // Exact 1:1 / explicit V5 recipes.
    if(a.input&&a.output){
      const parts=a.input.split('+').map((s:string)=>s.trim()).filter(Boolean)
      addInputs(parts.map((name:string)=>({name,qty:1})))
    }

    // Generated smithing equipment: V5 text previously omitted the real bar quantity.
    const smith=a.name.match(/^Smith (Bronze|Iron|Steel|Mithril|Adamant|Rune) (.+)$/)
    if(smith){
      const barName=smith[1]==='Adamant'?'Adamantite bar':smith[1]==='Rune'?'Runite bar':`${smith[1]} bar`
      const form=smith[2]
      const qtyMap:Record<string,number>={dagger:1,axe:1,mace:1,'med helm':1,sword:1,'dart tips':1,nails:1,scimitar:2,arrowtips:1,limbs:1,longsword:2,'full helm':2,'throwing knives':1,'sq shield':2,warhammer:3,battleaxe:3,chainbody:3,kiteshield:3,claws:2,'2h sword':3,plateskirt:3,platelegs:3,platebody:5}
      if(qtyMap[form]){addInputs([{name:barName,qty:qtyMap[form]}]);outputName=`${smith[1]} ${form}`}
    }

    // Standard bar smelting recipes.
    const smelt=a.name.match(/^Smelt (Bronze|Iron|Silver|Steel|Gold|Mithril|Adamantite|Runite) bar$/)
    if(smelt){
      const recipes:Record<string,{name:string;qty:number}[]>={
        Bronze:[{name:'Copper ore',qty:1},{name:'Tin ore',qty:1}],
        Iron:[{name:'Iron ore',qty:1}],Silver:[{name:'Silver ore',qty:1}],
        Steel:[{name:'Iron ore',qty:1},{name:'Coal',qty:2}],Gold:[{name:'Gold ore',qty:1}],
        Mithril:[{name:'Mithril ore',qty:1},{name:'Coal',qty:4}],
        Adamantite:[{name:'Adamantite ore',qty:1},{name:'Coal',qty:6}],
        Runite:[{name:'Runite ore',qty:1},{name:'Coal',qty:8}]
      }
      addInputs(recipes[smelt[1]]||[]);outputName=`${smelt[1]} bar`
    }

    // Gathering outputs that are unambiguous item drops.
    if(a.kind==='GATHERING'){
      const prefixes=['Fish ','Mine ','Cut ']
      const p=prefixes.find(p=>a.name.startsWith(p))
      if(p){
        let candidate=a.name.slice(p.length)
        // Woodcutting activity names already contain "logs"; fishing/mining names are item names.
        outputName=candidate
        liveEligible=true
        inputs=[]
      }
    }

    // Firemaking is a live cost method: logs are consumed, no sell output.
    if(a.pages.includes('firemaking')&&a.input){
      addInputs([{name:a.input,qty:1}]);outputName=undefined
    }

    const inputCost=inputs.length&&inputs.every(x=>x.price!==null)
      ? inputs.reduce((n,x)=>n+(x.price||0)*x.qty,0)+(a.coinFee||0)
      : inputs.length?null:(a.coinFee||0)
    const outputPrice=outputName?sell(outputName):null
    const outputNet=outputPrice===null?null:outputPrice*outputQty-geTax(outputPrice)*outputQty
    const hasPrices=liveEligible&&inputCost!==null&&(!outputName||outputNet!==null)
    const profitEach=hasPrices?(outputNet??0)-(inputCost??0):null
    const inputText=inputs.map(x=>`${x.qty}× ${x.name}: ${x.price===null?'?':fmt(x.price)} GP`).join(' • ')
    const outputText=outputName?`${outputName}: ${outputPrice===null?'?':fmt(outputPrice)} GP${outputPrice!==null?` (net ${fmt(outputNet)} GP)`:''}`:'Tüketim / satış çıktısı yok'
    return {inputs,outputName,outputQty,inputCost,outputPrice,outputNet,profitEach,hasPrices,liveEligible,inputText,outputText}
  }

  const resolveEffectiveRate=(a:(typeof V5_CATALOGUE)[number],edit:V5Edit)=>{
    const history=measurementHistory[a.id]||[]
    const weighted=weightedSpeed(history)
    const measured=(edit.measuredRate&&edit.measuredRate>0)?edit.measuredRate:(weighted&&weighted>0?weighted:null)
    if(measured!==null)return {rate:measured,source:'MEASURED' as const}
    if(edit.levelAdjustedRate&&edit.levelAdjustedRate>0)return {rate:edit.levelAdjustedRate,source:'LEVEL MODEL' as const}
    const theory=(edit.theoryRate??a.theoryRate)
    if(a.quality==='VERIFIED'&&theory>0)return {rate:theory,source:'THEORY' as const}
    if(theory>0)return {rate:theory,source:'ESTIMATE' as const}
    return {rate:0,source:'ESTIMATE' as const}
  }

  const v5Rows=useMemo(()=>V5_CATALOGUE.map(a=>{
    const edit=v5Edits[a.id]||{}
    const current=Math.max(...a.skills.map(s=>levels[s]||1))
    const open=(!a.member||mode==='MEMBER')&&current>=a.level
    const resolved=resolveEffectiveRate(a,edit)
    const rate=resolved.rate
    const rateSource=resolved.source
    const economy=v5LiveEconomy(a)
    const theoryRate=edit.theoryRate??a.theoryRate
    const theoryGpHour=economy.profitEach!==null&&theoryRate>0?economy.profitEach*theoryRate:null
    const measuredRate=edit.measuredRate??(weightedSpeed(measurementHistory[a.id]||[])||null)
    const measuredGpHour=economy.profitEach!==null&&measuredRate!==null&&measuredRate>0?economy.profitEach*measuredRate:null
    const liveGp=economy.profitEach!==null&&rate>0?economy.profitEach*rate:null
    const targets=v5BuyTargets
    const targetInputCost=economy.inputs.length&&economy.inputs.every(x=>(targets[x.name]??x.price)!==null)
      ? economy.inputs.reduce((n,x)=>n+((targets[x.name]??x.price) as number)*x.qty,0)+(a.coinFee||0)
      : null
    const hasTarget=economy.inputs.some(x=>(targets[x.name]??0)>0)
    const targetProfitEach=hasTarget&&targetInputCost!==null&&economy.outputNet!==null?economy.outputNet-targetInputCost:null
    const targetGpHour=targetProfitEach!==null&&rate>0?targetProfitEach*rate:null
    const targetCapital=targetInputCost!==null?targetInputCost*Math.max(1,Math.floor(rate)):null
    // GP/h is DERIVED from current live profit × Effective Rate whenever both are available.
    // Only the explicit gpOverride field may intentionally replace that automatic value.
    // Old measuredGpHour/theoryGpHour edit fields are retained in localStorage for backward compatibility,
    // but must never freeze a live calculation after GE prices change.
    const manualGpOverride=edit.gpOverride
    const quality=a.quality||'NEEDS_VERIFICATION'
    const rankableQuality=quality==='VERIFIED'
    const automaticEffectiveGpHour=liveGp
    const gp=manualGpOverride??automaticEffectiveGpHour??(rankableQuality?a.theoryGpHour:0)
    const source=manualGpOverride!==undefined?'MANUAL OVERRIDE':rateSource

    const outputVolume24h=economy.outputName?volume(economy.outputName):null
    const batchSize=Math.max(1,smartQty)
    const batchVolumePct=outputVolume24h&&outputVolume24h>0?batchSize/outputVolume24h*100:null
    const inputCaps=economy.inputs.map(inp=>{
      const vol=volume(inp.name)
      const limit=Number(getItem(inp.name)?.limit||0)
      const volumeCap=vol&&vol>0?vol*.05/inp.qty:Infinity
      const limitCap=limit>0?limit*6/inp.qty:Infinity
      return Math.min(volumeCap,limitCap)
    })
    const sellHistory=economy.outputName?orderHistory.filter(h=>h.item.toLowerCase()===economy.outputName!.toLowerCase()&&h.side==='SELL'&&h.quantity>0):[]
    const sellEvidence=sellHistory.slice(-12)
    const histFillRatio=sellEvidence.length?sellEvidence.reduce((n,h)=>n+Math.max(0,Math.min(1,h.filledQuantity/Math.max(1,h.quantity))),0)/sellEvidence.length:null
    const histHours=sellEvidence.filter(h=>h.fillHours!==null)
    const avgSellFillHours=histHours.length?histHours.reduce((n,h)=>n+(h.fillHours||0),0)/histHours.length:null
    const historyWeight=Math.min(.7,sellEvidence.length/10*.7)
    const baseParticipation=.05
    const calibratedParticipation=histFillRatio===null?baseParticipation:Math.max(.015,Math.min(.15,baseParticipation*(1-historyWeight)+(baseParticipation*(.4+1.8*histFillRatio))*historyWeight))
    const outputMarketCap=outputVolume24h&&outputVolume24h>0?outputVolume24h*calibratedParticipation/Math.max(1,economy.outputQty):Infinity
    const marketCapacityPerDay=Math.min(outputMarketCap,...(inputCaps.length?inputCaps:[Infinity]))
    const productionCapacityPerDay=rate>0?rate*Math.max(1,dailyMaxHours):0
    const capacityFactor=productionCapacityPerDay>0&&Number.isFinite(marketCapacityPerDay)?Math.max(0,Math.min(1,marketCapacityPerDay/productionCapacityPerDay)):1
    const capacityBaseGpHour=manualGpOverride??automaticEffectiveGpHour??gp
    const capacityAdjustedGpHour=capacityBaseGpHour*capacityFactor
    const sustainableHoursPerDay=rate>0&&Number.isFinite(marketCapacityPerDay)?marketCapacityPerDay/rate:null
    const baseLiquidityScore=outputVolume24h===null?null:batchVolumePct!==null?(batchVolumePct<=1?100:batchVolumePct<=5?80:batchVolumePct<=15?60:batchVolumePct<=35?40:20):null
    const liquidityScore=baseLiquidityScore===null?null:Math.max(0,Math.min(100,baseLiquidityScore+(histFillRatio===null?0:(histFillRatio-.5)*30*historyWeight)-(avgSellFillHours!==null&&avgSellFillHours>24?15*historyWeight:0)))
    const liquidityLabel=liquidityScore===null?'DATA REQUIRED':liquidityScore>=80?'HIGH':liquidityScore>=50?'MEDIUM':'LOW'
    return {...a,edit,current,open,gp,rate,rateSource,source,quality,rankableQuality,economy,liveGp,automaticEffectiveGpHour,theoryGpHour,measuredGpHour,measuredRate,targets,hasTarget,targetInputCost,targetProfitEach,targetGpHour,targetCapital,manualGpOverride,outputVolume24h,batchSize,batchVolumePct,marketCapacityPerDay,productionCapacityPerDay,capacityFactor,capacityAdjustedGpHour,sustainableHoursPerDay,liquidityScore,liquidityLabel,calibratedParticipation,histFillRatio,avgSellFillHours}
  }),[mode,levels,v5Edits,v5BuyTargets,prices,mapping,volumes,measurementHistory,dailyMaxHours,smartQty,orderHistory])
  type SmartRecipeRow={
    id:string;name:string;skill:string;level:number;member:boolean;open:boolean;status:string;requirements:string[];
    inputs:{name:string;qty:number}[];outputName:string|null;outputQty:number;xpEach:number|null;
    rate:number|null;rateSource:'GERÇEK ÖLÇÜM'|'TEORİK'|'DATA REQUIRED';kind:'PROCESS'|'ALCHEMY';fixedOutputNet:number|null
  }
  const smartRecipes=useMemo(()=>{
    const byName=new Map<string,SmartRecipeRow>()
    // Legacy recipe engine has the strongest requirement model and the user's real measured speeds.
    rows.forEach(r=>{
      const isAlchemy=r.kind==='alchemy'
      const outputName=isAlchemy?null:(r.output||null)
      if(!isAlchemy&&(!r.inputs?.length||!outputName))return
      const measured=r.userData.actualItemsPerHour!==undefined&&r.userData.actualItemsPerHour>0
      const reqs=[r.questRequirement,r.accessRequirement,r.regionRequirement,r.diaryRequirement,r.minigameRequirement,r.equipment].filter(Boolean) as string[]
      byName.set(r.name,{
        id:`legacy:${r.id}`,name:r.name,skill:r.skill,level:r.level,member:!r.f2p,open:r.unlocked,status:r.status,requirements:reqs,
        inputs:isAlchemy?[{name:r.alchItem!,qty:1},{name:'Nature rune',qty:1}]:r.inputs,
        outputName,outputQty:r.outputQty||1,xpEach:r.expectedXpPerItem??r.xp??null,
        rate:r.planningItemsPerHour||null,rateSource:measured?'GERÇEK ÖLÇÜM':'TEORİK',
        kind:isAlchemy?'ALCHEMY':'PROCESS',fixedOutputNet:isAlchemy?r.outputNet:null
      })
    })
    // V5 broad catalogue adds verified explicit input→output activities not already covered above.
    v5Rows.forEach(x=>{
      if(x.quality!=='VERIFIED'||byName.has(x.name)||!x.economy.inputs.length||!x.economy.outputName)return
      const measured=x.rateSource==='MEASURED'
      const rate:number|null=x.rate>0?x.rate:null
      const reqText=(x as any).requirement
      const reqs=reqText?[String(reqText)]:[]
      const status=x.open?'✓ AÇIK':x.member&&mode==='F2P'?'🔒 MEMBERS':x.current<x.level?`🔒 ${x.skills.join('/')} ${x.level}`:reqs.length?`🔒 ${reqs.join(', ')}`:'🔒 LOCKED'
      byName.set(x.name,{
        id:`v5:${x.id}`,name:x.name,skill:x.skills.join('/'),level:x.level,member:x.member,open:x.open,status,requirements:reqs,
        inputs:x.economy.inputs.map(i=>({name:i.name,qty:i.qty})),outputName:x.economy.outputName,outputQty:x.economy.outputQty||1,
        xpEach:typeof x.xpEach==='number'?x.xpEach:(typeof x.xpHour==='number'&&x.xpHour>0&&rate!==null&&rate>0?x.xpHour/rate:null),rate,rateSource:measured?'GERÇEK ÖLÇÜM':rate?'TEORİK':'DATA REQUIRED',kind:'PROCESS',fixedOutputNet:null
      })
    })
    return [...byName.values()].sort((a,b)=>Number(b.open)-Number(a.open)||a.skill.localeCompare(b.skill)||a.level-b.level||a.name.localeCompare(b.name))
  },[rows,v5Rows,mode])
  const selectedSmartRecipe=smartRecipes.find(x=>x.id===smartRecipeId)||null
  const smartRecipeCalc=selectedSmartRecipe?(()=>{
    const inputAdv=selectedSmartRecipe.inputs.map(inp=>({inp,adv:smartAdvice(inp.name,smartProfile,smartQty)}))
    if(inputAdv.some(x=>!x.adv))return null
    const smartInputCost=inputAdv.reduce((s,x)=>s+(x.adv!.recBuy*x.inp.qty),0)
    let grossSell=0,tax=0,netSell=0,outAdv:any=null
    if(selectedSmartRecipe.kind==='ALCHEMY'){
      if(selectedSmartRecipe.fixedOutputNet===null)return null
      netSell=selectedSmartRecipe.fixedOutputNet;grossSell=netSell
    }else{
      if(!selectedSmartRecipe.outputName)return null
      outAdv=smartAdvice(selectedSmartRecipe.outputName,smartProfile,smartQty)
      if(!outAdv)return null
      grossSell=outAdv.recSell*selectedSmartRecipe.outputQty
      tax=geTax(outAdv.recSell)*selectedSmartRecipe.outputQty
      netSell=grossSell-tax
    }
    const profit=netSell-smartInputCost
    const roi=smartInputCost>0?profit/smartInputCost*100:null
    const rate=selectedSmartRecipe.rate
    const gpHour=rate===null?null:profit*rate
    const batchProfit=profit*smartQty
    const xpBatch=selectedSmartRecipe.xpEach===null?null:selectedSmartRecipe.xpEach*smartQty
    const xpHour=selectedSmartRecipe.xpEach===null||rate===null?null:selectedSmartRecipe.xpEach*rate
    const inputCapital=smartInputCost*smartQty
    const expectedRevenue=netSell*smartQty
    const productionMinutes=rate&&rate>0?smartQty/rate*60:null
    const buyFillWindows=inputAdv.map(x=>x.adv!.buyFill.range)
    const sellFillWindow=outAdv?.sellFill?.range||null
    return {inputAdv,outAdv,smartInputCost,grossSell,tax,netSell,profit,roi,rate,gpHour,batchProfit,xpBatch,xpHour,inputCapital,expectedRevenue,productionMinutes,buyFillWindows,sellFillWindow}
  })():null

  const loadSmartRecipe=async()=>{
    if(!selectedSmartRecipe)return
    const names=[...selectedSmartRecipe.inputs.map(x=>x.name),...(selectedSmartRecipe.outputName?[selectedSmartRecipe.outputName]:[])].filter(Boolean)
    await Promise.all(names.map(loadSmartSeries))
  }

  const legacyMeasuredRanking=useMemo(()=>{
    const recipeRows=rows.filter(r=>r.unlocked&&(r.gpHour??0)>0).map(r=>({
      id:`legacy-recipe-${r.id}`,name:r.name,skills:[r.skill],level:r.level,kind:'PROCESSING',
      gp:r.gpHour??0,rate:r.planningItemsPerHour,source:r.speedSource==='GERÇEK'?'MEASURED':'LIVE/ESTIMATE',
      attention:r.attentionLevel||'MEDIUM',member:!r.f2p,open:true,xpHour:r.xpHour||0,
      pages:[] as V5PageId[],legacy:true
    }))
    const gatherLegacy=gatheringRows.filter(r=>r.unlocked&&(r.gpHour??0)>0).map(r=>({
      id:`legacy-gather-${r.id}`,name:r.name,skills:[r.skill],level:r.requiredLevel,kind:'GATHERING',
      gp:r.gpHour??0,rate:r.planningItemsPerHour,source:r.speedSource==='GERÇEK'?'MEASURED':'LIVE/ESTIMATE',
      attention:r.attentionLevel||'MEDIUM',member:!r.f2p,open:true,xpHour:r.xpHour||0,
      pages:[] as V5PageId[],legacy:true
    }))
    return [...recipeRows,...gatherLegacy]
  },[rows,gatheringRows])
  const unifiedRanking=useMemo(()=>{
    const v5=v5Rows.filter(x=>x.open&&x.gp>0&&x.economy.hasPrices&&(x.quality==='VERIFIED'||v5IncludeUnverified)).map(x=>({...x,legacy:false}))
    const canonicalVerified=v5Rows.filter(x=>x.quality==='VERIFIED')
    const legacyFiltered=legacyMeasuredRanking.filter(l=>!canonicalVerified.some(c=>{
      const ln=l.name.toLowerCase(),cn=c.name.toLowerCase(),out=(c.output||'').toLowerCase()
      return ln===cn||(out.length>4&&ln.includes(out))||(cn.replace(/^(make|smelt|smith|cook|top)\s+/,'')===ln.replace(/^(make|smelt|smith|cook|top)\s+/,''))
    }))
    const all=[...v5,...(v5IncludeUnverified?legacyFiltered:[])]
    const priority=(s:string)=>s==='MEASURED'||s==='GERÇEK'||s==='LIVE GE + MEASURED RATE'?4:s.startsWith('LIVE GE')?3:s==='USER THEORY'||s==='LIVE/ESTIMATE'?2:1
    const byName=new Map<string,any>()
    all.forEach(x=>{
      const key=x.name.trim().toLowerCase()
      const prev=byName.get(key)
      if(!prev||priority(x.source)>priority(prev.source)||(priority(x.source)===priority(prev.source)&&x.gp>prev.gp)) byName.set(key,x)
    })
    return Array.from(byName.values()).sort((a,b)=>{
      const d=b.gp-a.gp
      return d!==0?d:priority(b.source)-priority(a.source)
    })
  },[v5Rows,legacyMeasuredRanking,v5IncludeUnverified])
  const v5Top=useMemo(()=>unifiedRanking.slice(0,10),[unifiedRanking])
  const v5BuyOrderItems=useMemo(()=>{
    type RecipeUse={name:string;targetGpHour:number}
    type ItemOpportunity={
      name:string;live:number;target:number;gap:number;gapPct:number;proximity:number;
      targetHit:boolean;bestTargetGpHour:number;recipes:RecipeUse[]
    }
    const byItem=new Map<string,ItemOpportunity>()
    v5Rows.filter(x=>x.open&&x.quality==='VERIFIED'&&x.economy.hasPrices).forEach(x=>{
      x.economy.inputs.forEach(inp=>{
        const target=v5BuyTargets[inp.name]
        if(!(target>0)||inp.price===null) return
        // Item is eligible only if this OPEN recipe is profitable when the global target(s) are used.
        if(x.targetProfitEach===null||x.targetProfitEach<=0||x.targetGpHour===null||x.targetGpHour<=0) return
        const live=inp.price
        const gap=live-target
        const gapPct=target>0?gap/target*100:0
        const proximity=live>0?target/live*100:100
        const use={name:x.name,targetGpHour:x.targetGpHour}
        const existing=byItem.get(inp.name)
        if(existing){
          if(!existing.recipes.some(r=>r.name===x.name)) existing.recipes.push(use)
          existing.bestTargetGpHour=Math.max(existing.bestTargetGpHour,x.targetGpHour)
        } else {
          byItem.set(inp.name,{
            name:inp.name,live,target,gap,gapPct,proximity,
            targetHit:live<=target,bestTargetGpHour:x.targetGpHour,recipes:[use]
          })
        }
      })
    })
    return [...byItem.values()]
      .map(item=>({...item,recipes:[...item.recipes].sort((a,b)=>b.targetGpHour-a.targetGpHour).slice(0,3)}))
      .sort((a,b)=>{
        if(a.targetHit!==b.targetHit) return a.targetHit?-1:1
        const proximityDiff=Math.abs(b.proximity-a.proximity)
        if(proximityDiff>0.05) return b.proximity-a.proximity
        return b.bestTargetGpHour-a.bestTargetGpHour
      })
      .slice(0,10)
  },[v5Rows,v5BuyTargets])

  const v5PageRows=useMemo(()=>{
    const rows=v5Rows
      .filter(x=>x.pages.includes(v5Page))
      .filter(x=>v5ShowLocked||x.open)
      .filter(x=>v5AccessFilter==='ALL'||(v5AccessFilter==='F2P'?!x.member:x.member))
      .filter(x=>v5KindFilter==='ALL'||x.kind===v5KindFilter)
      .filter(x=>v5AttentionFilter==='ALL'||x.attention===v5AttentionFilter)
      .filter(x=>v5DataFilter==='ALL'||x.source===v5DataFilter)
      .filter(x=>v5ProfitFilter==='ALL'||(v5ProfitFilter==='PROFIT'?x.gp>0:x.gp<=0))
      .filter(x=>!v5Search.trim()||[x.name,x.kind,x.input,x.output,x.note,x.edit.note].join(' ').toLowerCase().includes(v5Search.toLowerCase()))
    return rows.sort((a,b)=>v5Sort==='GP_ASC'?a.gp-b.gp:v5Sort==='LEVEL_ASC'?a.level-b.level:v5Sort==='RATE_DESC'?b.rate-a.rate:(b.gp-a.gp))
  },[v5Rows,v5Page,v5ShowLocked,v5Search,v5AccessFilter,v5KindFilter,v5AttentionFilter,v5DataFilter,v5ProfitFilter,v5Sort])
  const v5MoneySkills=useMemo(()=>Array.from(new Set([...v5Rows,...legacyMeasuredRanking].flatMap(x=>x.skills))).sort(),[v5Rows,legacyMeasuredRanking])
  const v5MoneyRows=useMemo(()=>unifiedRanking
    .filter(x=>v5MoneySkill==='ALL'||x.skills.includes(v5MoneySkill))
    .filter(x=>v5MoneyKind==='ALL'||x.kind===v5MoneyKind)
    .filter(x=>v5MoneyAttention==='ALL'||x.attention===v5MoneyAttention)
    .filter(x=>v5MoneyData==='ALL'||x.source===v5MoneyData||(v5MoneyData==='MEASURED'&&(x.source==='GERÇEK'||x.source==='MEASURED')))
    .filter(x=>!v5MoneySearch.trim()||[x.name,x.kind,(x.input||''),(x.output||''),(x.note||''),(x.edit?.note||'')].join(' ').toLowerCase().includes(v5MoneySearch.toLowerCase()))
  ,[unifiedRanking,v5MoneySkill,v5MoneyKind,v5MoneyAttention,v5MoneyData,v5MoneySearch])
  const v5PageInfo=V5_PAGES.find(p=>p.id===v5Page)!
  const v5Update=(id:string,patch:Partial<V5Edit>)=>setV5Edits(old=>({...old,[id]:{...(old[id]||{}),...patch}}))
  const v5Reset=(id:string)=>setV5Edits(old=>{const n={...old};delete n[id];return n})

  const v4SearchResults = useMemo(() => {
    const q = v4Search.trim().toLowerCase()
    if (!q && !v4ViewAll) return []
    return V4_ACTIVITY_DATABASE
      .map(activity => ({ activity, access: evaluateActivity(activity, { mode, levels, unlocks: requirements }) }))
      .filter(({ activity, access }) => {
        if (!v4ShowLocked && !access.open) return false
        if (v4KindFilter !== 'ALL' && activity.kind !== v4KindFilter) return false
        if (!q) return true
        const haystack = [activity.name, activity.category, ...activity.skills, ...activity.tags, ...(activity.items ?? [])].join(' ').toLowerCase()
        return haystack.includes(q)
      })
  }, [v4Search, v4ShowLocked, v4ViewAll, v4KindFilter, mode, levels, requirements])
  const v4PageCount = Math.max(1, Math.ceil(v4SearchResults.length / V4_PAGE_SIZE))
  const v4PagedResults = v4SearchResults.slice((v4Page-1)*V4_PAGE_SIZE, v4Page*V4_PAGE_SIZE)

  const v4Stats = useMemo(() => {
    const evaluated = V4_ACTIVITY_DATABASE.map(activity => ({activity, access:evaluateActivity(activity,{mode,levels,unlocks:requirements})}))
    return {
      total:evaluated.length,
      verified:evaluated.filter(x=>x.activity.verified==='VERIFIED').length,
      members:evaluated.filter(x=>!x.activity.f2p && x.activity.members).length,
      open:evaluated.filter(x=>x.access.open).length,
      locked:evaluated.filter(x=>!x.access.open).length,
    }
  }, [mode, levels, requirements])

  const v4TheoryRows = useMemo(() => V4_THEORY_ESTIMATES.map(t => {
    const activity = V4_ACTIVITY_DATABASE.find(a => a.id === t.id)
    if (!activity) return null
    const req = evaluateActivity(activity,{mode,levels,unlocks:requirements})
    const skillReq = (activity.requirements.skills ?? []).map(s=>`${s.skill} ${s.level}`).join(', ') || '—'
    return { ...t, activity, open:req.open, missing:req.missing, skillReq }
  }).filter(Boolean).sort((x:any,y:any)=>y.gpHour-x.gpHour) as any[], [mode, levels, requirements])

  const v4TheoryOpenTop = useMemo(() => v4TheoryRows.filter((r:any)=>r.open).slice(0,5), [v4TheoryRows])
  const v4TheoryFutureTop = useMemo(() => v4TheoryRows.filter((r:any)=>!r.open).slice(0,5), [v4TheoryRows])

  const v4Ctx = useMemo(() => ({mode,levels,unlocks:requirements}), [mode,levels,requirements])
  const v4SafeCombat = useMemo(() => rankCombat(V4_ACTIVITY_DATABASE,v4Ctx,true).slice(0,10), [v4Ctx])
  const v4WildCombat = useMemo(() => rankCombat(V4_ACTIVITY_DATABASE,v4Ctx,false).filter(x=>['WILDERNESS','PVP'].includes(x.activity.riskType)).slice(0,10), [v4Ctx])
  const v4Unlocks = useMemo(() => v4NextUnlocks(V4_ACTIVITY_DATABASE,v4Ctx).slice(0,20), [v4Ctx])
  const v4QuestValue = useMemo(() => questUnlockValue(V4_ACTIVITY_DATABASE,v4Ctx).slice(0,10), [v4Ctx])
  const v4Chains = useMemo(() => itemChains(V4_ACTIVITY_DATABASE,v4PlannerItem).slice(0,20), [v4PlannerItem])
  const v4GearReady = useMemo(() => readyAfterSimpleRequirements(V4_ACTIVITY_DATABASE,v4Ctx).slice(0,20), [v4Ctx])

  const coverageRows=useMemo(()=>{
    const byId=new Map(V5_CATALOGUE.map(a=>[a.id,a]))
    return V5_CANONICAL_MANIFEST.map(c=>({canonical:c,activity:byId.get(c.key)||null}))
  },[])
  const coverageSummary=useMemo(()=>{
    const summarize=(member:boolean)=>{
      const set=coverageRows.filter(x=>x.canonical.member===member)
      const counts={VERIFIED:0,NEEDS_VERIFICATION:0,PLACEHOLDER:0,DUPLICATE:0,INCOMPLETE:0,DEPRECATED:0,MISSING:0}
      set.forEach(x=>{if(!x.activity)counts.MISSING++;else counts[x.activity.quality||'NEEDS_VERIFICATION']++})
      return {total:set.length,...counts,pct:set.length?counts.VERIFIED/set.length*100:0}
    }
    return {f2p:summarize(false),member:summarize(true)}
  },[coverageRows])
  const qualityCounts=useMemo(()=>{
    const c={VERIFIED:0,NEEDS_VERIFICATION:0,PLACEHOLDER:0,DUPLICATE:0,INCOMPLETE:0,DEPRECATED:0}
    V5_CATALOGUE.forEach(a=>c[a.quality||'NEEDS_VERIFICATION']++)
    return c
  },[])

  return (
    <main>
      <header>
        <div>
          <h1>OSRS Economy Scanner V5.8.2 — Live GP/h Recalculation Fix</h1>
          <p>
            Live GE processing scanner • gerçek hız/fiyat • sermaye ve süre planı • F2P safety audit
          </p>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',justifyContent:'flex-end'}}>
          <button onClick={refresh} disabled={loading}>
            {loading
              ? 'Güncelleniyor...'
              : '↻ Fiyatları Güncelle'}
          </button>
          <div style={{fontSize:11,color:error?'#f85149':updated?'#3fb950':'#8b949e',minWidth:190}}>
            {loading
              ? 'OSRS Wiki fiyatları alınıyor...'
              : error
                ? `Güncelleme başarısız${updated ? ` • Son başarılı: ${updated.toLocaleString('tr-TR')}` : ''}`
                : updated
                  ? `Son fiyat güncelleme: ${updated.toLocaleString('tr-TR')}`
                  : 'Henüz fiyat güncellemesi yapılmadı'}
          </div>
        </div>
      </header>

      <nav style={{position:'sticky',top:0,zIndex:20,display:'flex',gap:8,flexWrap:'wrap',padding:'10px 0',background:'#0d1117',borderBottom:'1px solid #30363d'}}>
        {([
          ['dashboard','Dashboard'],['smart','Smart Order'],['skills','21 Skill Views'],['money','Money Methods'],['planner','Unlocks / Planner'],['database','Full Database'],['coverage','Database Coverage'],
        ] as const).map(([id,label])=><button key={id} type="button" onClick={()=>setActiveTab(id)}
          style={{fontWeight:activeTab===id?800:500,outline:activeTab===id?'2px solid #58a6ff':'none'}}>{label}</button>)}
      </nav>

      {error && <div className="error">{error}</div>}

            {activeTab==='dashboard'&&<div>
              <section style={{marginBottom:12,padding:12,background:'#161b22',border:'1px solid #30363d',borderRadius:8}}>
                <h3 style={{marginTop:0,marginBottom:8}}>Skill Seviyelerim</h3>
                <div style={{fontSize:10,color:'#8b949e',marginBottom:8}}>Buradaki seviyeler Dashboard, 21 Skill Views ve Money Methods sonuçlarını birlikte günceller.</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                  {Object.keys(levels).map(s=><label key={s} style={{display:'flex',alignItems:'center',gap:4,fontSize:11}}>{s}
                    <input type="number" min="1" max="99" value={levels[s]} onChange={e=>setLevels(old=>({...old,[s]:clamp(Number(e.target.value),1,99)}))} style={{width:50,background:'#0d1117',color:'white',border:'1px solid #30363d',borderRadius:4,padding:4}}/>
                  </label>)}
                </div>
              </section>
              <section style={{marginBottom:12,padding:12,border:'1px solid #30363d',borderRadius:8}}>
                <h3 style={{marginTop:0}}>V5.8.1 — Live Economy Top 10</h3>
                <div style={{fontSize:10,color:'#8b949e',marginBottom:8}}>Default liste yalnız OPEN + VERIFIED + priceable ekonomik kayıtları kullanır. Effective Rate önceliği MEASURED → LEVEL MODEL → THEORY → ESTIMATE. PLACEHOLDER/DUPLICATE varsayılan sıralamaya girmez.</div>
                <label style={{fontSize:10,display:'inline-flex',gap:5,alignItems:'center',marginBottom:7}}><input type="checkbox" checked={v5IncludeUnverified} onChange={e=>setV5IncludeUnverified(e.target.checked)}/> Include unverified / research candidates</label>
                <div className="tableBox"><table><thead><tr><th>#</th><th>Activity</th><th>Skill</th><th>Kâr/adet</th><th>Effective GP/h</th><th>Rate/h</th><th>Rate Source</th><th>Liquidity</th><th>Capacity GP/h</th><th>Quality</th></tr></thead><tbody>
                {v5Top.map((x,i)=><tr key={x.id}><td>{i+1}</td><td className="name">{x.name}{x.economy&&<div style={{fontSize:9,color:'#8b949e',marginTop:3}}>{x.economy.hasPrices?<>{x.economy.inputText&&<div>Alış: {x.economy.inputText}</div>}<div>Satış: {x.economy.outputText}</div></>:<div>Canlı fiyat modeli: {x.economy.liveEligible?'fiyat eşleşmesi eksik':'henüz tanımlı değil'}</div>}</div>}</td><td>{x.skills.join(', ')} {x.level}</td><td>{fmt(x.economy?.profitEach)}</td><td><b>{fmt(x.gp)}</b></td><td>{fmt(x.rate)}</td><td>{x.rateSource||x.source}</td><td>{x.liquidityLabel||'—'}{x.batchVolumePct!==null&&x.batchVolumePct!==undefined?<div style={{fontSize:9}}>{fmt(x.batchVolumePct,1)}% / {x.batchSize}</div>:null}</td><td>{fmt(x.capacityAdjustedGpHour)}</td><td>{x.quality||'LEGACY'}</td></tr>)}
                {!v5Top.length&&<tr><td colSpan={10}>Mevcut level/mod ile VERIFIED pozitif GP/h adayı yok.</td></tr>}
                </tbody></table></div>
                <div style={{fontSize:10,marginTop:6}}>V5 katalog: <b>{V5_CATALOGUE.length}</b> activity • VERIFIED: <b>{qualityCounts.VERIFIED}</b> • PLACEHOLDER: <b>{qualityCounts.PLACEHOLDER}</b> • OPEN: <b>{v5Rows.filter(x=>x.open).length}</b> • Editlenmiş: <b>{Object.keys(v5Edits).length}</b></div>
              </section>
<section id="dashboard" className="cards">
        <div className="card">
          <label>ACCOUNT MODE</label>
          <select
            value={mode}
            onChange={(e) =>
              setMode(e.target.value as AccountMode)
            }
            style={{ width: '100%' }}
          >
            <option value="F2P">F2P</option>
            <option value="MEMBER">MEMBER</option>
          </select>
        </div>

        <div className="card">
          <label>MEVCUT GP</label>
          <input
            type="number"
            value={gp}
            min="0"
            onChange={(e) =>
              setGp(Math.max(0, Number(e.target.value)))
            }
          />
        </div>

        <div className="card">
          <label>HEDEF ÜRETİM</label>
          <input
            type="number"
            value={quantity}
            min="1"
            onChange={(e) =>
              setQuantity(
                Math.max(1, Number(e.target.value))
              )
            }
          />
        </div>

        <div className="card">
          <label>HEDEF SÜRE</label>
          <select
            value={targetHours}
            onChange={(e) => setTargetHours(Number(e.target.value))}
            style={{ width: '100%' }}
          >
            <option value={0.5}>30 dakika</option>
            <option value={1}>1 saat</option>
            <option value={2}>2 saat</option>
            <option value={3}>3 saat</option>
          </select>
        </div>

        <div className="card">
          <label>BOND / KALAN</label>
          <strong>{fmt(bond)} GP</strong>
          <span
            style={{
              fontSize: 11,
              color: '#8b949e',
            }}
          >
            Kalan: {fmt(missing)}
          </span>
        </div>

        <div className="card">
          <label>BOND İLERLEME</label>
          <strong>
            {bond ? bondProgress.toFixed(2) : '—'}%
          </strong>
          <div className="bar">
            <div
              style={{
                width: `${bondProgress}%`,
              }}
            />
          </div>
        </div>
      </section>

      <section id="bond-planner" style={{marginBottom:12,padding:12,background:'#161b22',border:'1px solid #30363d',borderRadius:8}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{fontWeight:'bold',color:'#e3b341'}}>BOND SUSTAINABILITY ENGINE — V4.4</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button type="button" onClick={downloadFullBackup}>Tam Yedek Al</button>
            <label><span style={{display:'inline-block',padding:'5px 9px',border:'1px solid #30363d',borderRadius:5,cursor:'pointer'}}>Yedeği Geri Yükle</span><input type="file" accept=".json,application/json" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)restoreFullBackup(f);e.currentTarget.value=''}}/></label>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:8,marginTop:10}}>
          <div style={{padding:9,border:'1px solid #30363d',borderRadius:6}}><div style={{fontSize:9,color:'#8b949e'}}>SURVIVAL STATUS</div><b style={{fontSize:15}}>{sustainabilityStatus}</b><div style={{fontSize:9}}>Senaryo: {bondScenario}</div></div>
          <div style={{padding:9,border:'1px solid #30363d',borderRadius:6}}><div style={{fontSize:9,color:'#8b949e'}}>40 / 50 SAAT EŞİĞİ</div><b>{fmt(requiredNetGp40)} / {fmt(requiredNetGp50)} GP/h</b><div style={{fontSize:9}}>Minimum sürdürülebilir net hız</div></div>
          <div style={{padding:9,border:'1px solid #30363d',borderRadius:6}}><div style={{fontSize:9,color:'#8b949e'}}>ÖLÇÜM GÜVENİ</div><b>{measurementConfidence}</b><div style={{fontSize:9}}>{measurementCount} ölçüm • {measuredMethodCount} gerçek hızlı yöntem</div></div>
          <div style={{padding:9,border:'1px solid #30363d',borderRadius:6}}><div style={{fontSize:9,color:'#8b949e'}}>SAFE BOND READY</div><b>{bond&&gp>=bondTarget?'EVET':'HAYIR'}</b><div style={{fontSize:9}}>Bond + capital + buffer</div></div>
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,fontSize:11,marginTop:10}}>
          <label>Aktif gün <input type="number" min="1" max="14" value={bondActiveDays} onChange={e=>setBondActiveDays(clamp(Number(e.target.value)||10,1,14))} style={{width:50}}/></label>
          <label>Günlük max <select value={dailyMaxHours} onChange={e=>setDailyMaxHours(Number(e.target.value))}><option value={1}>1h</option><option value={2}>2h</option><option value={3}>3h</option><option value={4}>4h</option><option value={5}>5h</option></select></label>
          <label>Saat bütçesi <select value={bondHoursBudget} onChange={e=>setBondHoursBudget(Number(e.target.value))}><option value={20}>20h</option><option value={30}>30h</option><option value={40}>40h</option><option value={50}>50h</option></select></label>
          <label>Senaryo <select value={bondScenario} onChange={e=>setBondScenario(e.target.value as BondScenario)}><option value="CONSERVATIVE">Conservative</option><option value="EXPECTED">Expected</option></select></label>
          <label>Öncelik <select value={progressionPriority} onChange={e=>setProgressionPriority(e.target.value as ProgressionPriority)}><option value="PROFIT">Profit</option><option value="BALANCED">Balanced</option><option value="PROGRESSION">Progression</option></select></label>
          <label>Working capital <input type="number" min="0" step="100000" value={bondReserve} onChange={e=>setBondReserve(Math.max(0,Number(e.target.value)||0))} style={{width:100}}/></label>
          <label>Emergency buffer <input type="number" min="0" step="100000" value={emergencyBuffer} onChange={e=>setEmergencyBuffer(Math.max(0,Number(e.target.value)||0))} style={{width:100}}/></label>
          <label>Yorgunluk <select value={playerMode} onChange={e=>setPlayerMode(e.target.value as PlayerMode)}><option>ACTIVE</option><option>NORMAL</option><option>CHILL</option></select></label>
          <label>Bond yöntemi <select value={selectedBondMethod} onChange={e=>setSelectedBondMethod(e.target.value)}><option value="">Otomatik en iyi</option>{allOpenMethods.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        </div>
        <div style={{marginTop:10,fontSize:11,lineHeight:1.65}}>
          Bond {fmt(bond)} + Working Capital {fmt(bondReserve)} + Buffer {fmt(emergencyBuffer)} = <b>{fmt(bondTarget)} GP güvenli hedef</b> • Eksik <b>{fmt(remainingSafeGp)}</b><br/>
          Seçili: <b>{chosenBondMethod?.name||'—'}</b> • {chosenBondMethod?.source||'—'} • Ham {fmt(realisticGpHour)} GP/h • Senaryo sonrası <b>{fmt(sustainableGpHour)} GP/h</b><br/>
          {bondHoursBudget} saat bütçesinde gereken <b>{fmt(requiredNetGpBudget)} GP/h</b> • Tahmini <b>{sustainableHours===null?'—':fmt(sustainableHours,1)+' saat'}</b>
        </div>
        <div style={{marginTop:10,padding:9,border:'1px solid #30363d',borderRadius:6,fontSize:10}}>
          <b>10-DAY PLAN CHECK</b><br/>Kapasite: {bondActiveDays} gün × {dailyMaxHours}h = <b>{fmt(planCapacityHours,1)} saat</b> • Tahmini bitiş <b>{expectedCompletionDays===null?'—':`Day ${expectedCompletionDays}`}</b> • Buffer <b>{bufferDays===null?'—':bufferDays+' gün'}</b><br/>
          {sustainableHours!==null && sustainableHours<=planCapacityHours ? '✓ Plan seçili zaman bütçesine sığıyor.' : '⚠ Plan zaman bütçesine sığmıyor veya veri yetersiz.'}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:8,marginTop:10,fontSize:10}}>
          <div style={{padding:8,border:'1px solid #238636',borderRadius:6}}><b>PRIMARY MONEY MAKER</b><div>{primaryMoneyMaker?.name||'NEEDS DATA'}</div><div>{primaryMoneyMaker?`${fmt(primaryMoneyMaker.gpHour)} GP/h • ${primaryMoneyMaker.source}`:'—'}</div></div>
          <div style={{padding:8,border:'1px solid #9e6a03',borderRadius:6}}><b>LOW-ATTENTION BACKUP</b><div>{lowAttentionBackup?.name||'NEEDS DATA'}</div><div>{lowAttentionBackup?`${fmt(lowAttentionBackup.gpHour)} GP/h • ${lowAttentionBackup.attention}`:'—'}</div></div>
          <div style={{padding:8,border:'1px solid #1f6feb',borderRadius:6}}><b>MARKET / LIMIT BACKUP</b><div>{marketBackup?.name||'NEEDS DATA'}</div><div>{marketBackup?`${fmt(marketBackup.gpHour)} GP/h • ${marketBackup.source}`:'—'}</div></div>
        </div>
        <details style={{marginTop:10,fontSize:10}}><summary style={{cursor:'pointer',fontWeight:700}}>High Alch Scanner / Basket — veri durumu</summary><div style={{padding:8,border:'1px solid #30363d',borderRadius:6,marginTop:6}}><b>NEEDS DATA:</b> Güvenilir High Alch value + buy limit dataset'i olmadığı için otomatik basket uydurulmadı. Mevcut High Alch yöntemleri Money Methods içinde çalışmaya devam eder.</div></details>
      </section>

      {mode==='MEMBER' && <section style={{marginBottom:12,padding:10,background:'#161b22',border:'1px solid #30363d',borderRadius:8}}>
        <b>MEMBER REQUIREMENTS / UNLOCKS</b>
        <div style={{fontSize:10,color:'#8b949e',margin:'5px 0 8px'}}>Yalnız kalıcı quest/access unlocklarını işaretle. Normal satın alınabilir ekipman activity'yi kilitlemez.</div>
        {requirementGroups.map(group=><details key={group.title} style={{marginBottom:6,border:'1px solid #30363d',borderRadius:6,padding:7}}>
          <summary style={{cursor:'pointer',fontWeight:700}}>{group.title} — {group.items.filter(x=>requirements[x]).length}/{group.items.length}</summary>
          <div style={{display:'flex',flexWrap:'wrap',gap:7,marginTop:8}}>
            {group.items.map(x=><label key={x} style={{fontSize:10}}><input type="checkbox" checked={!!requirements[x]} onChange={e=>setRequirements(o=>({...o,[x]:e.target.checked}))}/>{x}</label>)}
          </div>
        </details>)}
      </section>}

      {mode==='MEMBER' && <section style={{marginBottom:12,padding:10,background:'#161b22',border:'1px solid #8957e5',borderRadius:8}}>
        <div style={{fontWeight:800,color:'#d2a8ff',marginBottom:4}}>MEMBER THEORY PREVIEW — V4</div>
        <div style={{fontSize:10,color:'#8b949e',marginBottom:8}}>Canlı GE hesabı değil; rota seçmek için kaba GP/h başlangıç verisi. GERÇEK ölçüm her zaman teorinin önündedir.</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:8}}>
          <div style={{border:'1px solid #238636',borderRadius:6,padding:8}}>
            <b>Şu an OPEN — teori</b>
            {v4TheoryOpenTop.length ? v4TheoryOpenTop.map((r:any,i:number)=><div key={r.id} style={{marginTop:5,fontSize:10}}>#{i+1} {r.activity.name} — <b>{fmt(r.gpHour)} GP/h</b> • TAHMİN • {r.skillReq}</div>) : <div style={{marginTop:5,fontSize:10}}>Mevcut level/unlocklarla teorik MEMBER aday yok.</div>}
          </div>
          <div style={{border:'1px solid #1f6feb',borderRadius:6,padding:8}}>
            <b>Gelecek potansiyeli — teori</b>
            {v4TheoryFutureTop.map((r:any,i:number)=><div key={r.id} style={{marginTop:5,fontSize:10}}>#{i+1} {r.activity.name} — <b>{fmt(r.gpHour)} GP/h</b> • {r.skillReq} • {r.missing.slice(0,2).join(' / ')||'LOCKED'}</div>)}
          </div>
        </div>
      </section>}

      <section style={{marginBottom:12}}><div style={{fontWeight:'bold',fontSize:12,marginBottom:5}}>D — Bond Sustain Top 3</div><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:8}}>{bondSustainTop3.map((m,i)=><div key={m.id} style={{background:'#12261a',border:'1px solid #8957e5',borderRadius:7,padding:9,fontSize:11}}><b>#{i+1} — {m.name}</b><div>{fmt(m.gpHour)} GP/h • {m.source} • {m.attention}</div></div>)}</div></section>

      <section style={{ marginBottom: 12 }}>
        {[
          ['A — Processing / Crafting Top 3', processingTop3, '#238636'],
          ['B — Gathering Top 3', gatheringTop3, '#1f6feb'],
          ['C — Şu an neyi rahat yapabilirim? (AFK / Low Attention)', afkTop3, '#9e6a03'],
        ].map(([title, list, border]: any) => (
          <div key={title} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight:'bold', fontSize:12, marginBottom:5 }}>{title}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:8 }}>
              {list.map((r:any, i:number) => (
                <div key={r.id} style={{ background:'#12261a', border:`1px solid ${border}`, borderRadius:7, padding:'9px 12px', fontSize:11 }}>
                  <div style={{ color:'#3fb950', fontWeight:'bold' }}>#{i+1} — {r.name}</div>
                  {'competitionRisk' in r ? (
                    <><div>{fmt(r.gpHour)} GP/h • {fmt(r.xpHour)} XP/h • Risk {r.competitionRisk}</div><div>{r.attentionLevel} • {r.speedSource} • Lv {r.currentLevel}/{r.requiredLevel}</div></>
                  ) : (
                    <><div>{fmt(r.profit)} GP/adet • {fmt(r.profitPerRun)} GP/tur • {r.roi===null?'—':`${r.roi.toFixed(1)}%`} ROI</div><div>XP/tur {fmt(r.xpPerRun,1)} • Hacim {fmt(r.dailyVolume)} • {r.attentionLevel}</div></>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>


      <section style={{marginBottom:10,padding:12,background:'#161b22',border:'1px solid #30363d',borderRadius:8}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
          <b style={{fontSize:14}}>BUY ORDER OPPORTUNITY — En Yakın 10 Malzeme</b>
          <span style={{fontSize:10,color:'#8b949e'}}>Global item hedefleri • unique input item • açık + hedef fiyatta kârlı reçeteler</span>
        </div>
        {v5BuyOrderItems.length?v5BuyOrderItems.map((item,i)=>{
          const status=item.targetHit?'HEDEF FİYAT GELDİ':item.proximity>=95?'ÇOK YAKIN':item.proximity>=90?'YAKIN':item.proximity>=80?'ORTA':item.proximity>=70?'UZAK':'ÇOK UZAK'
          const color=item.targetHit?'#238636':item.proximity>=95?'#1f6f3d':item.proximity>=90?'#2ea043':item.proximity>=80?'#d29922':item.proximity>=70?'#db6d28':'#da3633'
          return <div key={item.name} style={{marginTop:10,padding:12,border:`2px solid ${color}`,borderRadius:8,background:'#0d1117'}}>
            {item.targetHit&&<div style={{fontSize:15,fontWeight:900,color:'#3fb950',marginBottom:4}}>🔥 HEDEF FİYAT GELDİ</div>}
            <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
              <div>
                <div style={{fontSize:18,fontWeight:900}}>#{i+1} {item.name}</div>
                <div style={{fontSize:15,fontWeight:800,marginTop:3}}>Canlı: {fmt(item.live)} GP → Hedef: {fmt(item.target)} GP</div>
                <div style={{fontSize:12,marginTop:3}}>Hedefe fark: {item.gap>=0?'+':''}{fmt(item.gap)} GP | {item.gapPct>=0?'+':''}{item.gapPct.toFixed(1)}%</div>
              </div>
              <div style={{minWidth:170,textAlign:'center',padding:'8px 12px',borderRadius:8,border:`2px solid ${color}`}}>
                <div style={{fontSize:26,fontWeight:900,color}}>%{item.proximity.toFixed(1)}</div>
                <div style={{fontSize:11,fontWeight:900,color}}>{status}</div>
                <div style={{fontSize:9,color:'#8b949e'}}>HEDEFE YAKIN</div>
              </div>
            </div>
            <div style={{fontSize:10,color:'#8b949e',marginTop:8}}><b>En kârlı kullanım:</b> {item.recipes.map(r=>r.name).join(' • ')}</div>
          </div>
        }):<div style={{marginTop:8,fontSize:11}}>Henüz global hedef alış fiyatı tanımlanmış ve hedef fiyatta kârlı en az bir açık reçetede kullanılan item yok.</div>}
      </section>
      <section style={{marginBottom:10,padding:10,background:'#161b22',border:'1px solid #30363d',borderRadius:7,fontSize:11}}><b>Bir sonraki kârlı unlock</b>{nextUnlocks.length?nextUnlocks.map(r=><div key={r.id}>{r.name}: {r.skill} {r.currentLevel}→{r.level} ({r.levelsMissing} level / {fmt(r.xpMissing)} XP) • canlı {fmt(r.profit)} GP/adet • {fmt(r.profitPerRun)} GP/tur</div>):<div>Canlı fiyatlarla yakın pozitif skill unlock bulunamadı.</div>}</section>

      {(mode==='MEMBER' || (bond&&gp>=bond)) && <section style={{marginBottom:10,padding:10,background:'#161b22',border:'1px solid #8957e5',borderRadius:7,fontSize:11}}><b>FIRST BOND TRANSITION PLAN</b><div>1) Member skill seviyelerini gir ve yalnızca gerçekten sahip olduğun quest/access kutularını işaretle.</div><div>2) İlk hedef: Bond + reserve için <b>{fmt(bondTarget)}</b> GP çalışma tabanı.</div><div>3) Şu an ekonomik rota: <b>{bondSustainTop3[0]?.name||'ölçüm/veri gerekli'}</b>{bondSustainTop3[0]?` — ${fmt(bondSustainTop3[0].gpHour)} GP/h`:''}.</div><div>4) Bond+reserve güvenceye girdikten sonraki GP <b>Progression GP</b> olarak quest/gear/skill gelişimine ayrılır.</div></section>}

            </div>}

      
      {activeTab==='smart'&&<div>
        <section style={{marginBottom:12,padding:12,background:'#161b22',border:'1px solid #30363d',borderRadius:8}}>
          <h2 style={{marginTop:0,color:'#f0f6fc',fontWeight:900,letterSpacing:'.2px'}}>SMART ORDER / 24H ORDER ADVISOR</h2>
          <div style={{fontSize:10,color:'#8b949e',marginBottom:10}}>OSRS Wiki 5m zaman serisinin son 24 saati kullanılır. FAST ağırlıklı {'<1 saat'}, BALANCED 1–6 saat, PATIENT 6–24 saat penceresini hedefler. Tekil spike/dipler median/MAD filtresiyle bastırılır; fiyat dağılımı, hacim ve ilgili fiyat seviyesindeki işlem yoğunluğu birlikte değerlendirilir. Dolum aralıkları tahmindir, garanti değildir.</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end'}}>
            <label>Item<br/><input value={smartSearch} onChange={e=>setSmartSearch(e.target.value)} placeholder="Ruby, Sapphire..." style={{width:180}}/></label>
            <label>Profil<br/><select value={smartProfile} onChange={e=>setSmartProfile(e.target.value as SmartProfile)}><option>FAST</option><option>BALANCED</option><option>PATIENT</option></select></label>
            <label>Miktar<br/><select value={smartQtyPreset} onChange={e=>{const v=e.target.value;setSmartQtyPreset(v);if(v!=='CUSTOM')setSmartQty(Number(v))}}><option value="100">100</option><option value="250">250</option><option value="500">500</option><option value="1000">1.000</option><option value="CUSTOM">Özel</option></select></label>
            {smartQtyPreset==='CUSTOM'&&<label>Özel miktar<br/><input type="number" min="1" value={smartQty} onChange={e=>setSmartQty(Math.max(1,Number(e.target.value)||1))} style={{width:100}}/></label>}
          </div>
          {smartSearch.trim()&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
            {mapping.filter((m:any)=>prices[m.id]&&m.name?.toLowerCase().includes(smartSearch.toLowerCase())).slice(0,12).map((m:any)=><button key={m.id} onClick={()=>{setSmartItem(m.name);setSmartSearch(m.name);loadSmartSeries(m.name)}}>{m.name}</button>)}
          </div>}
          {smartError&&<div className="error" style={{marginTop:8}}>{smartError}</div>}
          {smartItem&&smartLoading[smartItem]&&<div style={{marginTop:10}}>24h veri yükleniyor...</div>}
          {selectedSmart&&<div style={{marginTop:12,padding:12,border:'1px solid #30363d',borderRadius:8}}>
            <div style={{fontSize:18,fontWeight:900}}>{selectedSmart.item} • {selectedSmart.profile} • {fmt(selectedSmart.qty)} adet</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:8,marginTop:8}}>
              <div className="card"><label>Current BUY / SELL</label><strong>{fmt(selectedSmart.currentBuy)} / {fmt(selectedSmart.currentSell)} GP</strong></div>
              <div className="card"><label>24h Low / High</label><strong>{fmt(selectedSmart.low)} / {fmt(selectedSmart.high)} GP</strong></div>
              <div className="card"><label>24h VWAP / Median</label><strong>{fmt(selectedSmart.vwap)} / {fmt(selectedSmart.median)} GP</strong></div>
              <div className="card"><label>24h Volume</label><strong>{fmt(selectedSmart.dailyVol)}</strong></div>
              <div className="card"><label>Confidence</label><strong>{selectedSmart.confidence}</strong></div>
              <div className="card"><label>Tahmini Fill</label><strong>BUY {selectedSmart.buyFill.difficulty} • {selectedSmart.buyFill.range}<br/>SELL {selectedSmart.sellFill.difficulty} • {selectedSmart.sellFill.range}</strong></div>
            </div>
            <div className="tableBox" style={{marginTop:10}}><table><thead><tr><th>Profil</th><th>Recommended BUY</th><th>BUY fark</th><th>Recommended SELL</th><th>SELL fark</th><th>Confidence</th><th>BUY fill</th><th>SELL fill</th></tr></thead><tbody>
              {selectedSmartProfiles.map((a:any)=><tr key={a.profile} style={{fontWeight:a.profile===smartProfile?800:400}}><td>{a.profile}{a.profile===smartProfile?' ★':''}</td><td>{fmt(a.recBuy)} GP</td><td>{a.currentBuy?`${((a.recBuy-a.currentBuy)/a.currentBuy*100).toFixed(1)}%`:'?'}</td><td>{fmt(a.recSell)} GP</td><td>{a.currentSell?`${((a.recSell-a.currentSell)/a.currentSell*100).toFixed(1)}%`:'?'}</td><td>{a.confidence}</td><td>{a.buyFill.difficulty} • {a.buyFill.range}</td><td>{a.sellFill.difficulty} • {a.sellFill.range}</td></tr>)}
            </tbody></table></div>
            {v5BuyTargets[selectedSmart.item]>0&&(()=>{const manual=v5BuyTargets[selectedSmart.item];const patient=smartAdvice(selectedSmart.item,'PATIENT',smartQty);if(!patient)return null;const diff=(manual-patient.recBuy)/patient.recBuy*100;const label=diff<=-10?'ÇOK SABIRLI / DOLMASI ZOR':diff<=-4?'SABIRLI':diff<=4?'SMART FİYATA YAKIN':diff<=10?'DAHA HIZLI':'ÇOK AGRESİF';return <div style={{marginTop:10,padding:10,border:'1px solid #d29922',borderRadius:7}}><b>Manual Target vs Smart Price</b><div style={{fontSize:14,marginTop:3}}>Manual Target: <b>{fmt(manual)} GP</b> • Smart PATIENT BUY: <b>{fmt(patient.recBuy)} GP</b></div><div style={{fontSize:11}}>Manual Target, Smart PATIENT'a göre {Math.abs(diff).toFixed(1)}% {diff<0?'daha düşük':'daha yüksek'} → <b>{label}</b></div></div>})()}
            <div style={{fontSize:10,color:'#8b949e',marginTop:8}}>Dayanak: {selectedSmart.samples} adet 5m örnek • {selectedSmart.filteredCount} uç örnek filtrelendi • hacim ağırlıklı dağılım • miktar/24h hacim etkisi{selectedSmart.historyCount?` • ${selectedSmart.historyCount} benzer kişisel emir kaydı`:''}{selectedSmart.avgBuyHours!==null?` • BUY geçmiş ort. ${selectedSmart.avgBuyHours.toFixed(1)}h`:''}{selectedSmart.avgSellHours!==null?` • SELL geçmiş ort. ${selectedSmart.avgSellHours.toFixed(1)}h`:''}</div>
          </div>}
        </section>

        <section style={{marginBottom:12,padding:12,background:'#161b22',border:'1px solid #30363d',borderRadius:8}}>
          <h3 style={{marginTop:0}}>SMART BUY → PROCESS → SMART SELL</h3>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'end'}}>
            <label>Processing / Alchemy activity<br/><select value={smartRecipeId} onChange={e=>setSmartRecipeId(e.target.value)} style={{maxWidth:560}}><option value="">Seç...</option>{smartRecipes.map(x=><option key={x.id} value={x.id}>{x.open?'✓':'🔒'} {x.member?'MEMBERS':'F2P'} • {x.skill} {x.level} • {x.name}</option>)}</select></label>
            <button onClick={loadSmartRecipe} disabled={!selectedSmartRecipe||!selectedSmartRecipe.open}>24h Recipe Verisini Yükle</button>
          </div>
          {selectedSmartRecipe&&<div style={{fontSize:10,color:selectedSmartRecipe.open?'#8b949e':'#d29922',marginTop:6}}>{selectedSmartRecipe.status} • {selectedSmartRecipe.member?'MEMBERS':'F2P'} • Hammadde/ürün 24h serileri yüklenince {smartProfile} fiyatlarıyla hesaplanır. Hız: <b>{selectedSmartRecipe.rateSource}{selectedSmartRecipe.rate!==null?` • ${fmt(selectedSmartRecipe.rate)}/h`:''}</b>{selectedSmartRecipe.requirements.length?` • Gereksinim: ${selectedSmartRecipe.requirements.join(', ')}`:''}</div>}
          {smartRecipeCalc&&<div style={{marginTop:10,padding:10,border:'1px solid #30363d',borderRadius:7}}>
            <div><b>Smart alış:</b> {smartRecipeCalc.inputAdv.map(x=>`${x.inp.name} ${fmt(x.adv!.recBuy)} GP × ${x.inp.qty||1}`).join(' + ')}</div>
            <div><b>Smart satış:</b> {selectedSmartRecipe?.kind==='ALCHEMY'?`High Alchemy sabit çıktı ${fmt(smartRecipeCalc.netSell)} GP`:`${selectedSmartRecipe?.outputName} ${fmt(smartRecipeCalc.outAdv?.recSell)} GP • GE tax ${fmt(smartRecipeCalc.tax)} GP`}</div>
            <div style={{display:'flex',gap:16,flexWrap:'wrap',marginTop:7}}><b>Kâr/item: {fmt(smartRecipeCalc.profit)} GP</b><b>Batch ({fmt(smartQty)}): {fmt(smartRecipeCalc.batchProfit)} GP</b><b>Input Capital: {fmt(smartRecipeCalc.inputCapital)} GP</b><b>Expected Revenue: {fmt(smartRecipeCalc.expectedRevenue)} GP</b><b>ROI: {smartRecipeCalc.roi===null?'?':smartRecipeCalc.roi.toFixed(1)+'%'}</b><b>Production Time: {smartRecipeCalc.productionMinutes===null?'DATA REQUIRED':smartRecipeCalc.productionMinutes.toFixed(1)+' dk'}</b><b>Buy Waiting: {smartRecipeCalc.buyFillWindows.join(' / ')}</b><b>Sell Waiting: {smartRecipeCalc.sellFillWindow||'ALCH / N/A'}</b><b>XP/batch: {fmt(smartRecipeCalc.xpBatch)}</b><b>Production GP/h: {smartRecipeCalc.gpHour===null?'DATA REQUIRED':fmt(smartRecipeCalc.gpHour)}</b><b>Expected XP/h: {smartRecipeCalc.xpHour===null?'DATA REQUIRED':fmt(smartRecipeCalc.xpHour)}</b><b>{selectedSmartRecipe?.rateSource}{selectedSmartRecipe&&selectedSmartRecipe.rate!==null?` • ${fmt(selectedSmartRecipe.rate)}/h`:''}</b></div><div style={{fontSize:9,color:'#8b949e',marginTop:6}}>Production GP/h yalnız aktif üretim hızıdır; BUY/SELL bekleme süresi Full Cycle Return ile aynı şey değildir.</div>
          </div>}
        </section>

        <section style={{padding:12,background:'#161b22',border:'1px solid #30363d',borderRadius:8}}>
          <h3 style={{marginTop:0}}>Order History / Gerçekleşen Emir Geçmişi</h3>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'end'}}>
            <label>Item<br/><input value={historyDraft.item} onChange={e=>setHistoryDraft(d=>({...d,item:e.target.value}))} style={{width:150}}/></label>
            <label>BUY/SELL<br/><select value={historyDraft.side} onChange={e=>setHistoryDraft(d=>({...d,side:e.target.value as OrderSide}))}><option>BUY</option><option>SELL</option></select></label>
            <label>Miktar<br/><input type="number" value={historyDraft.quantity} onChange={e=>setHistoryDraft(d=>({...d,quantity:Number(e.target.value)}))} style={{width:85}}/></label>
            <label>Emir fiyatı<br/><input type="number" value={historyDraft.orderPrice} onChange={e=>setHistoryDraft(d=>({...d,orderPrice:Number(e.target.value)}))} style={{width:90}}/></label>
            <label>Gerçekleşen<br/><input type="number" value={historyDraft.filledQuantity} onChange={e=>setHistoryDraft(d=>({...d,filledQuantity:Number(e.target.value)}))} style={{width:85}}/></label>
            <label>Fill saat<br/><input value={historyDraft.fillHours} onChange={e=>setHistoryDraft(d=>({...d,fillHours:e.target.value}))} placeholder="14 / 0.5" style={{width:82}}/></label>
            <label>Ort. fiyat<br/><input value={historyDraft.averageFillPrice} onChange={e=>setHistoryDraft(d=>({...d,averageFillPrice:e.target.value}))} placeholder="ops." style={{width:80}}/></label>
            <label>Durum<br/><select value={historyDraft.status} onChange={e=>setHistoryDraft(d=>({...d,status:e.target.value as OrderStatus}))}><option>OPEN</option><option>PARTIAL</option><option>FILLED</option><option>CANCELLED</option></select></label>
            <button onClick={addOrderHistory}>Emri Kaydet</button>
          </div>
          <div className="tableBox" style={{marginTop:10}}><table><thead><tr><th>Tarih</th><th>Item</th><th>Side</th><th>Miktar</th><th>Emir</th><th>Doldu</th><th>Süre</th><th>Ort.</th><th>Durum</th><th></th></tr></thead><tbody>
            {orderHistory.slice(0,100).map(h=><tr key={h.id}><td>{new Date(h.date).toLocaleString('tr-TR')}</td><td>{h.item}</td><td>{h.side}</td><td>{fmt(h.quantity)}</td><td>{fmt(h.orderPrice)}</td><td>{fmt(h.filledQuantity)}</td><td>{h.fillHours===null?'—':h.fillHours<1?'<1h':`${h.fillHours}h`}</td><td>{h.averageFillPrice===null?'—':fmt(h.averageFillPrice)}</td><td>{h.status}</td><td><button onClick={()=>setOrderHistory(old=>old.filter(x=>x.id!==h.id))}>Sil</button></td></tr>)}
            {!orderHistory.length&&<tr><td colSpan={10}>Henüz emir geçmişi yok. Örn: Sapphire • BUY • 500 • 150 GP • 500 doldu • 14 saat.</td></tr>}
          </tbody></table></div>
        </section>
      </div>}

{activeTab==='skills'&&<div>
        <section style={{marginTop:12,padding:12,border:'1px solid #30363d',borderRadius:8}}>
          <h3 style={{marginTop:0}}>V5 — 21 Deep Skill / Progression Views</h3>
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
            {V5_PAGES.map(p=><button type="button" key={p.id} onClick={()=>setV5Page(p.id)} style={{fontWeight:v5Page===p.id?800:500,outline:v5Page===p.id?'2px solid #58a6ff':'none'}}>{p.label}</button>)}
          </div>
          <div><b>{v5PageInfo.label}</b> <span style={{fontSize:10,color:'#8b949e'}}>({v5PageInfo.skills.join(' + ')})</span></div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center',marginTop:8}}>
            <input value={v5Search} onChange={e=>setV5Search(e.target.value)} placeholder="Bu sayfada ara..."/>
            <select value={v5AccessFilter} onChange={e=>setV5AccessFilter(e.target.value)}><option value="ALL">F2P + Member</option><option value="F2P">F2P</option><option value="MEMBER">Member</option></select>
            <select value={v5KindFilter} onChange={e=>setV5KindFilter(e.target.value)}><option value="ALL">Tüm türler</option><option>GATHERING</option><option>PROCESSING</option><option>COMBAT</option><option>TRAINING</option><option>RECURRING</option><option>UTILITY</option></select>
            <select value={v5AttentionFilter} onChange={e=>setV5AttentionFilter(e.target.value)}><option value="ALL">Tüm dikkat</option><option>AFK</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select>
            <select value={v5DataFilter} onChange={e=>setV5DataFilter(e.target.value)}><option value="ALL">Tüm veri</option><option value="THEORY">THEORY</option><option value="USER THEORY">USER THEORY</option><option value="MEASURED">MEASURED</option></select>
            <select value={v5ProfitFilter} onChange={e=>setV5ProfitFilter(e.target.value)}><option value="ALL">Kâr/Zarar: Tümü</option><option value="PROFIT">Kârlı</option><option value="LOSS">Zarar / 0</option></select>
            <select value={v5Sort} onChange={e=>setV5Sort(e.target.value)}><option value="GP_DESC">GP/h ↓</option><option value="GP_ASC">GP/h ↑</option><option value="LEVEL_ASC">Level ↑</option><option value="RATE_DESC">Rate/h ↓</option></select>
            <label style={{fontSize:10}}><input type="checkbox" checked={v5ShowLocked} onChange={e=>setV5ShowLocked(e.target.checked)}/> LOCKED göster</label>
          </div>
          <div style={{fontSize:10,color:'#8b949e',margin:'7px 0'}}>Kayıt: {v5PageRows.length} • OPEN {v5PageRows.filter(x=>x.open).length}. THEORY değerleri başlangıç planlama tahminidir; Edit ile theory/measurement değerlerini değiştirebilirsin.</div>
          <div className="tableBox"><table><thead><tr><th>Activity</th><th>F2P/P2P</th><th>Level</th><th>Tür</th><th>Theory GP/h</th><th>Effective GP/h</th><th>Rate/h</th><th>XP/h</th><th>Dikkat</th><th>Durum</th><th>Quality</th><th>Veri</th><th>Edit</th></tr></thead><tbody>
          {v5PageRows.map(x=><tr key={x.id} className={!x.open?'lockedRow':''}>
            <td className="name">{x.name}<div style={{fontSize:9,color:'#8b949e'}}>{x.input?`In: ${x.input}`:''}{x.output?` → Out: ${x.output}`:''}</div><div style={{fontSize:9,color:x.economy.hasPrices?'#3fb950':'#8b949e',marginTop:3}}>{x.economy.hasPrices?<>{x.economy.inputText&&<div>Alış: {x.economy.inputText}</div>}<div>Satış: {x.economy.outputText}</div>{x.economy.profitEach!==null&&<div>Kâr/adet: {fmt(x.economy.profitEach)} GP • Canlı GP/h: {fmt(x.liveGp)}</div>}</>:<div>Canlı fiyat: {x.economy.liveEligible?'eşleşme/veri eksik':'reçete modeli henüz tanımlı değil — THEORY korunuyor'}</div>}</div>{(x.edit.note||x.note)&&<div style={{fontSize:9,color:'#8b949e'}}>{x.edit.note||x.note}</div>}</td>
            <td>{x.member?'MEMBER':'F2P'}</td><td>{x.skills.join(', ')} {x.level}<div style={{fontSize:9}}>Sen: {x.current}</div></td><td>{x.kind}</td>
            <td>{fmt(x.edit.theoryGpHour??x.theoryGpHour)}</td><td><b>{fmt(x.gp)}</b></td><td>{fmt(x.rate)}</td><td>{fmt(x.xpHour)}</td><td>{x.attention}</td>
            <td><b>{x.open?'OPEN':'LOCKED'}</b>{!x.open&&<div style={{fontSize:9}}>{x.member&&mode==='F2P'?'Membership':x.current<x.level?`${x.level-x.current} level eksik`:x.requirement||'Requirement'}</div>}</td>
            <td><b>{x.quality}</b>{x.sourceRef&&<div style={{fontSize:9,color:'#8b949e'}}>{x.sourceRef}</div>}</td><td>{x.source}</td><td><button type="button" onClick={()=>setV5Editing(v5Editing===x.id?null:x.id)}>Edit</button></td>
          </tr>)}
          {!v5PageRows.length&&<tr><td colSpan={13}>Eşleşen activity yok.</td></tr>}
          </tbody></table></div>
          {v5Editing&&(()=>{const x=v5Rows.find(r=>r.id===v5Editing);if(!x)return null;return <div style={{marginTop:10,padding:10,border:'1px solid #58a6ff',borderRadius:8}}>
            <b>Edit — {x.name}</b><div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
            <label>Theory Rate/h <input type="number" value={x.edit.theoryRate??x.theoryRate} onChange={e=>v5Update(x.id,{theoryRate:Number(e.target.value)})}/></label>
            <label>Theory GP/h <input type="number" readOnly value={x.theoryGpHour??''}/></label>
            <label>Measured Rate/h <input type="number" value={x.edit.measuredRate??x.measuredRate??''} onChange={e=>v5Update(x.id,{measuredRate:e.target.value===''?undefined:Number(e.target.value)})}/></label>
            <label>Measured GP/h <input type="number" readOnly value={x.measuredGpHour??''}/></label>
            <label>Effective Rate/h <input type="number" readOnly value={x.rate}/></label>
            <label>Effective GP/h <input type="number" readOnly value={x.gp}/></label>
            <label>Manual GP/h override <input type="number" placeholder="boş = otomatik" value={x.edit.gpOverride??''} onChange={e=>v5Update(x.id,{gpOverride:e.target.value===''?undefined:Number(e.target.value)})}/></label>
            <label style={{minWidth:280}}>Not <input style={{width:'100%'}} value={x.edit.note??''} onChange={e=>v5Update(x.id,{note:e.target.value})}/></label>
            <button type="button" onClick={()=>v5Reset(x.id)}>Override sıfırla</button></div>
            {x.economy.inputs.length>0&&<div style={{marginTop:8,padding:8,border:'1px solid #30363d',borderRadius:6}}>
              <b>Buy Order hedef alış fiyatları</b>
              <div style={{fontSize:9,color:'#8b949e',margin:'3px 0 6px'}}>Bu hedef ITEM bazlı ve globaldir: örneğin Ruby = 650 girersen Ruby kullanan tüm reçeteler 650 hedefini kullanır. Boş bırakırsan canlı alış fiyatı kullanılır.</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{x.economy.inputs.map(inp=><label key={inp.name}>{inp.name} <span style={{fontSize:9,color:'#8b949e'}}>canlı {fmt(inp.price)} GP</span> <input type="number" min="0" placeholder="Hedef alış" value={x.targets[inp.name]??''} onChange={e=>setV5BuyTargets(old=>{const next={...old};if(e.target.value==='')delete next[inp.name];else next[inp.name]=Math.max(0,Number(e.target.value));return next})}/></label>)}</div>
              {x.hasTarget&&<div style={{fontSize:10,marginTop:6}}>Hedef maliyet: <b>{fmt(x.targetInputCost)} GP</b> • Hedef kâr/adet: <b>{fmt(x.targetProfitEach)} GP</b> • Hedef GP/h: <b>{fmt(x.targetGpHour)}</b> • Effective rate: <b>{fmt(x.rate)}/h {x.rateSource}</b></div>}
            </div>}
            <div style={{fontSize:9,color:'#8b949e',marginTop:5}}>Orijinal theory: {fmt(x.theoryRate)}/h • {fmt(x.theoryGpHour)} GP/h. GP/h override boşsa canlı kâr × Effective Rate otomatik hesaplanır. Measured Rate varsa theory hiçbir ekonomik sıralamada kullanılmaz.</div><div style={{fontSize:10,marginTop:5}}>{x.economy.hasPrices?<><b>Canlı fiyat:</b> {x.economy.inputText||'Girdi yok'} → {x.economy.outputText} • <b>{fmt(x.economy.profitEach)} GP/adet</b></>:<><b>Canlı fiyat modeli:</b> henüz eksik. Bu kayıtta GP/h THEORY/override üzerinden kalır.</>}</div>
          </div>})()}
        </section>
      </div>}

      {activeTab==='money'&&<div>
        <section style={{marginBottom:12,padding:12,border:'1px solid #58a6ff',borderRadius:8}}>
          <h3 style={{marginTop:0}}>V5 Money Methods — Full Database Ranking</h3>
          <div style={{fontSize:10,color:'#8b949e',marginBottom:8}}>Bu tablo artık 21 skill görünümündeki aynı V5 activity kayıtlarından otomatik oluşur. Skill level değişince OPEN havuz ve sıralama anında değişir.</div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:8}}>
            <input value={v5MoneySearch} onChange={e=>setV5MoneySearch(e.target.value)} placeholder="Money method ara..."/>
            <select value={v5MoneySkill} onChange={e=>setV5MoneySkill(e.target.value)}><option value="ALL">Tüm skill'ler</option>{v5MoneySkills.map(s=><option key={s}>{s}</option>)}</select>
            <select value={v5MoneyKind} onChange={e=>setV5MoneyKind(e.target.value)}><option value="ALL">Tüm türler</option><option>GATHERING</option><option>PROCESSING</option><option>COMBAT</option><option>TRAINING</option><option>RECURRING</option><option>UTILITY</option></select>
            <select value={v5MoneyAttention} onChange={e=>setV5MoneyAttention(e.target.value)}><option value="ALL">Tüm dikkat</option><option>AFK</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select>
            <select value={v5MoneyData} onChange={e=>setV5MoneyData(e.target.value)}><option value="ALL">Theory + Measured</option><option value="THEORY">THEORY</option><option value="USER THEORY">USER THEORY</option><option value="MEASURED">MEASURED</option></select>
          </div>
          <div style={{fontSize:10,marginBottom:6}}>OPEN + pozitif GP/h: <b>{v5MoneyRows.length}</b> yöntem. Örn. Herblore level yükseldiğinde uygun potion kayıtları burada otomatik açılır.</div>
          <div className="tableBox"><table><thead><tr><th>#</th><th>Yöntem</th><th>Skill</th><th>Tür</th><th>GP/h</th><th>Rate/h</th><th>XP/h</th><th>Dikkat</th><th>Veri</th><th>F2P/P2P</th></tr></thead><tbody>
          {v5MoneyRows.map((x,i)=><tr key={x.id}><td>{i+1}</td><td className="name">{x.name}<div style={{fontSize:9,color:'#8b949e'}}>{x.input?`In: ${x.input}`:''}{x.output?` → Out: ${x.output}`:''}</div>{x.economy&&<div style={{fontSize:9,color:x.economy.hasPrices?'#3fb950':'#8b949e'}}>{x.economy.hasPrices?<>{x.economy.inputText&&<div>Alış: {x.economy.inputText}</div>}<div>Satış: {x.economy.outputText}</div>{x.economy.profitEach!==null&&<div>Kâr/adet: {fmt(x.economy.profitEach)} GP</div>}</>:<div>Canlı fiyat modeli yok / eksik</div>}</div>}</td><td>{x.skills.join(', ')} {x.level}</td><td>{x.kind}</td><td><b>{fmt(x.gp)}</b></td><td>{fmt(x.rate)}</td><td>{fmt(x.xpHour)}</td><td>{x.attention}</td><td>{x.source}</td><td>{x.member?'MEMBER':'F2P'}</td></tr>)}
          {!v5MoneyRows.length&&<tr><td colSpan={10}>Filtrelere uyan OPEN ve pozitif GP/h yöntemi yok.</td></tr>}
          </tbody></table></div>
        </section>
        <details>
          <summary style={{cursor:'pointer',fontWeight:700,marginBottom:8}}>Legacy V4 Money Methods (canlı GE hesapları)</summary>
<section className="filters" id="money-methods">
        <label>
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) =>
              setAvailableOnly(e.target.checked)
            }
          />
          Sadece AÇIK
        </label>

        <label>
          <input
            type="checkbox"
            checked={showMembers}
            onChange={(e) =>
              setShowMembers(e.target.checked)
            }
          />
          MEMBERS yöntemleri göster
        </label>

        <select value={activityTypeFilter} onChange={(e)=>setActivityTypeFilter(e.target.value)}>
          <option value="All">Aktivite: Tümü</option><option>Processing</option><option>Cooking</option><option>Gathering</option><option>Combat</option>
        </select>
        <select value={attentionFilter} onChange={(e)=>setAttentionFilter(e.target.value)}>
          <option value="All">Dikkat: Tümü</option><option value="AFK">AFK</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
        </select>
        <select value={purposeFilter} onChange={(e)=>setPurposeFilter(e.target.value)}>
          <option value="All">Amaç: Tümü</option><option value="MONEY">Money</option><option value="SKILL + PROFIT">Skill + Profit</option><option value="XP">XP</option>
        </select>
        <label><input type="checkbox" checked={noLossOnly} onChange={(e)=>setNoLossOnly(e.target.checked)} /> Sadece zarar ettirmeyenler</label>
        <label>Plan güveni % <input type="number" min="10" max="100" step="5" value={planningFactor} onChange={(e)=>setPlanningFactor(clamp(Number(e.target.value)||50,10,100))} style={{width:55}} /></label>

        <select
          value={profitFilter}
          onChange={(e) =>
            setProfitFilter(e.target.value)
          }
        >
          <option value="All">Kâr/Zarar: Tümü</option>
          <option value="Profit">Sadece kârlı</option>
          <option value="Loss">Sadece zararlı</option>
        </select>

        <select
          value={skillFilter}
          onChange={(e) =>
            setSkillFilter(e.target.value)
          }
        >
          <option value="All">Tüm skill'ler</option>
          <option>Crafting</option>
          <option>Cooking</option>
          <option>Smithing</option>
          <option>Magic</option>
          <option>Prayer</option>
          <option>Fishing</option>
          <option>Mining</option>
          <option>Woodcutting</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) =>
            setCategoryFilter(e.target.value)
          }
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'All' ? 'Tüm kategoriler' : c}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) =>
            setSort(e.target.value)
          }
        >
          <option value="profit">Kâr/adet ↓</option>
          <option value="runprofit">Kâr/tur ↓</option>
          <option value="gph">GP/saat ↓</option>
          <option value="roi">ROI ↓</option>
          <option value="volume">Hacim ↓</option>
          <option value="level">Level ↑</option>
        </select>
      </section>

      <div className="explain">
        <b>Input:</b> Wiki HIGH = hızlı alış &nbsp;•&nbsp;
        <b>Output:</b> Wiki LOW = hızlı satış &nbsp;•&nbsp;
        <b>GE tax:</b> dahil &nbsp;•&nbsp;
        <b>Hedef:</b> {fmt(quantity)} adet &nbsp;•&nbsp;
        <b>Süre:</b> {targetHours === 0.5 ? '30 dk' : `${targetHours} saat`} &nbsp;•&nbsp;
        <b>Ölçülmemiş hız planı:</b> %{planningFactor} &nbsp;•&nbsp;
        <b>Güncelleme:</b>{' '}
        {updated
          ? updated.toLocaleString('tr-TR')
          : '—'}
      </div>

      <div className="tableBox">
        <table
          style={{
            tableLayout: 'auto',
            minWidth: 0,
          }}
        >
          <thead>
            <tr>
              <th>Yöntem / {fmt(quantity)} adet plan</th>
              <th>Durum</th>
              <th>Skill</th>
              <th>Maliyet</th>
              <th>Satış</th>
              <th>Kâr</th>
              <th>Kâr / {fmt(quantity)}</th>
              <th>ROI</th>
              <th>XP</th>
              <th>GP/XP</th>
              <th>Başarı</th>
              <th>24h Hacim</th>
              <th>Adet/Tur</th>
              <th>Kâr/Tur</th>
              <th>XP/Tur</th>
              <th>Hız</th>
              <th>GP/h</th>
              <th>XP/h</th>
              <th>Kaynak</th>
              <th>Tür</th>
            </tr>
          </thead>

          <tbody>
            {visibleRows.map((r) => {
              const lowVolume =
                r.dailyVolume !== null &&
                r.dailyVolume < 1000

              return (
                <tr
                  key={r.name}
                  className={
                    !r.unlocked
                      ? 'lockedRow'
                      : ''
                  }
                >
                  <td
                    className="name"
                    style={{ minWidth: 250 }}
                  >
                    <div>{r.name}</div>

                    <div
                      style={{
                        color: '#8b949e',
                        fontWeight: 'normal',
                        fontSize: 9,
                        marginTop: 3,
                      }}
                    >
                      {r.ingredientsText}
                    </div>

                    <div
                      style={{
                        fontWeight: 'normal',
                        fontSize: 9,
                        marginTop: 3,
                        color: '#c9d1d9',
                      }}
                    >
                      {fmt(quantity)} adet:
                      {' '}Sermaye{' '}
                      <b>{fmt(r.capitalForQty)}</b>
                      {' '}• Kâr{' '}
                      <b
                        className={
                          (r.profitForQty ?? 0) >= 0
                            ? 'positive'
                            : 'negative'
                        }
                      >
                        {fmt(r.profitForQty)}
                      </b>
                      {' '}• XP{' '}
                      <b>{fmt(r.xpForQty)}</b>
                    </div>

                    <div
                      style={{
                        fontWeight: 'normal',
                        fontSize: 9,
                        marginTop: 3,
                        color: '#8b949e',
                      }}
                    >
                      Mevcut GP ile max <b>{fmt(r.maxByCapital)}</b> adet •{' '}
                      {targetHours === 0.5 ? '30 dk' : `${targetHours} saat`}: <b>{fmt(r.timeLimitedQty)}</b> adet
                      {r.timeLimitedQty < r.timePotentialQty ? ' (sermaye limiti)' : ''} • Sermaye{' '}
                      <b>{fmt(r.timeCapital)}</b> • Kâr{' '}
                      <b className={(r.timeProfit ?? 0) >= 0 ? 'positive' : 'negative'}>{fmt(r.timeProfit)}</b> • XP{' '}
                      <b>{fmt(r.timeXp)}</b>
                    </div>

                    <div style={{ marginTop: 5, fontWeight: 'normal' }}>
                      <button
                        type="button"
                        onClick={() => setEditingMethodId(editingMethodId === r.id ? null : r.id)}
                        style={{
                          fontSize: 10,
                          padding: '4px 8px',
                          border: '1px solid #388bfd',
                          borderRadius: 5,
                          background: editingMethodId === r.id ? '#1f6feb' : '#0d1117',
                          color: '#58a6ff',
                          cursor: 'pointer',
                        }}
                      >
                        {editingMethodId === r.id ? '− ÖLÇÜMÜ KAPAT' : '+ ÖLÇÜM / DÜZENLE'}
                      </button>

                      {editingMethodId === r.id && (
<div
                          style={{
                            marginTop: 6,
                            padding: 7,
                            border: '1px solid #30363d',
                            borderRadius: 5,
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(110px, 1fr))',
                            gap: 6,
                            minWidth: 260,
                          }}
                        >
                          <label style={{ fontSize: 9 }}>
                            Gerçek adet/saat
                            <input
                              type="number"
                              min="0"
                              placeholder={String(Math.round(r.theoreticalItemsPerHour))}
                              value={r.userData.actualItemsPerHour ?? ''}
                              onChange={(e) => {
                                const v = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value))
                                updateMethodData(r.id, { actualItemsPerHour: v })
                              }}
                              style={{ width: '100%' }}
                            />
                          </label>
                          <div style={{ fontSize: 9, alignSelf: 'end' }}>
                            Teorik: <b>{fmt(r.theoreticalItemsPerHour)}</b>/h<br />
                            Etkin: <b>{fmt(r.effectiveItemsPerHour)}</b>/h
                          </div>
                          <label style={{ fontSize: 9 }}>
                            Ölçülen adet
                            <input
                              type="number"
                              min="0"
                              value={r.userData.measuredQuantity ?? ''}
                              onChange={(e) => {
                                const q = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value))
                                const m = r.userData.measuredMinutes
                                const speed = q && m ? (q / m) * 60 : r.userData.actualItemsPerHour
                                updateMethodData(r.id, { measuredQuantity: q, actualItemsPerHour: speed })
                              }}
                              style={{ width: '100%' }}
                            />
                          </label>
                          <label style={{ fontSize: 9 }}>
                            Geçen süre (dk)
                            <input
                              type="number"
                              min="0"
                              value={r.userData.measuredMinutes ?? ''}
                              onChange={(e) => {
                                const m = e.target.value === '' ? undefined : Math.max(0, Number(e.target.value))
                                const q = r.userData.measuredQuantity
                                const speed = q && m ? (q / m) * 60 : r.userData.actualItemsPerHour
                                updateMethodData(r.id, { measuredMinutes: m, actualItemsPerHour: speed })
                              }}
                              style={{ width: '100%' }}
                            />
                          </label>
                          <label style={{ fontSize: 9 }}>
                            Gerçek girdi maliyeti/adet
                            <input
                              type="number"
                              min="0"
                              placeholder={String(Math.round(r.wikiInputCost || 0))}
                              value={r.userData.actualBuyCost ?? ''}
                              onChange={(e) => updateMethodData(r.id, { actualBuyCost: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })}
                              style={{ width: '100%' }}
                            />
                          </label>
                          <label style={{ fontSize: 9 }}>
                            Gerçek satış/alch değeri
                            <input
                              type="number"
                              min="0"
                              placeholder={String(Math.round(r.outputPrice || 0))}
                              value={r.userData.actualSellPrice ?? ''}
                              onChange={(e) => updateMethodData(r.id, { actualSellPrice: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })}
                              style={{ width: '100%' }}
                            />
                          </label>
                          <label style={{ fontSize: 9 }}>
                            Adet / tur
                            <input
                              type="number"
                              min="1"
                              value={r.itemsPerRun}
                              onChange={(e) =>
                                updateMethodData(r.id, {
                                  itemsPerRun: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                                })
                              }
                              style={{ width: '100%' }}
                            />
                          </label>
                          <label style={{ fontSize: 9 }}>
                            Yöntem türü
                            <select
                              value={r.purpose}
                              onChange={(e) => updateMethodData(r.id, { purpose: e.target.value as MethodPurpose })}
                              style={{ width: '100%' }}
                            >
                              <option>MONEY</option>
                              <option>SKILL + PROFIT</option>
                              <option>XP</option>
                            </select>
                          </label>
                          <label style={{ fontSize: 9 }}>
                            Dikkat seviyesi
                            <select value={r.attentionLevel} onChange={(e)=>updateMethodData(r.id,{attentionLevel:e.target.value as AttentionLevel})} style={{width:'100%'}}>
                              <option value="AFK">AFK</option><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option>
                            </select>
                          </label>
                          {r.cooking && <>
                            <label style={{fontSize:9}}>Raw adet<input id={`cook-total-${r.id}`} type="number" min="1" placeholder="100" style={{width:'100%'}} /></label>
                            <label style={{fontSize:9}}>Cooked adet<input id={`cook-ok-${r.id}`} type="number" min="0" placeholder="80" style={{width:'100%'}} /></label>
                            <label style={{fontSize:9}}>Burnt adet<input id={`cook-burn-${r.id}`} type="number" min="0" placeholder="20" style={{width:'100%'}} /></label>
                            <button type="button" style={{fontSize:9}} onClick={()=>{
                              const total=Number((document.getElementById(`cook-total-${r.id}`) as HTMLInputElement)?.value||0)
                              const successful=Number((document.getElementById(`cook-ok-${r.id}`) as HTMLInputElement)?.value||0)
                              const burnt=Number((document.getElementById(`cook-burn-${r.id}`) as HTMLInputElement)?.value||0)
                              if(total>0 && successful>=0 && burnt>=0 && successful+burnt<=total){
                                updateMethodData(r.id,{actualSuccessByLevel:{...(r.userData.actualSuccessByLevel||{}),[String(r.currentLevel)]:{total,successful,burnt,rate:successful/total}}}); addMeasurement(r.id,{date:new Date().toISOString(),skillLevel:r.currentLevel,quantity:total,minutes:r.userData.measuredMinutes||0,itemsPerHour:r.userData.actualItemsPerHour||0,successful,burnt,failed:burnt})
                              }
                            }}>Cooking başarısını kaydet @ Lv{r.currentLevel}</button>
                            {r.successAtLevel && <button type="button" style={{fontSize:9}} onClick={()=>{
                              const next={...(r.userData.actualSuccessByLevel||{})}; delete next[String(r.currentLevel)]; updateMethodData(r.id,{actualSuccessByLevel:next})
                            }}>Bu level ölçümünü sil</button>}
                          </>}
                          <label style={{fontSize:9}}>Hedef buy order / girdi maliyeti<input type="number" min="0" value={r.userData.targetBuyPrice??''} onChange={e=>updateMethodData(r.id,{targetBuyPrice:e.target.value===''?undefined:Number(e.target.value)})} style={{width:'100%'}} /></label>
                          <label style={{fontSize:9}}>Ort. müdahale aralığı (sn)<input type="number" min="0" value={r.userData.averageSecondsBetweenInteractions??''} onChange={e=>updateMethodData(r.id,{averageSecondsBetweenInteractions:e.target.value===''?undefined:Number(e.target.value)})} style={{width:'100%'}} /></label>
                          <div style={{fontSize:9,color:'#8b949e'}}>History: {historySummary(r.id).count} test • son {fmt(historySummary(r.id).last?.itemsPerHour)} /h • ağırlıklı {fmt(historySummary(r.id).weighted)} /h</div>
                          <button type="button" style={{fontSize:9}} onClick={()=>{const q=r.userData.measuredQuantity||0,m=r.userData.measuredMinutes||0;if(q>0&&m>0)addMeasurement(r.id,{date:new Date().toISOString(),skillLevel:r.currentLevel,quantity:q,minutes:m,itemsPerHour:q/m*60,buyPrice:r.userData.actualBuyCost,sellPrice:r.userData.actualSellPrice,profit:r.profit??undefined,xp:r.xpForQty??undefined})}}>Bu hız testini history'ye ekle</button>
                          <div style={{ display: 'flex', gap: 5, alignItems: 'end' }}>
                            <button type="button" onClick={() => clearActualSpeed(r.id)} style={{ fontSize: 9, padding: '4px 6px' }}>Hızı sil</button>
                            <button type="button" onClick={() => clearActualPrices(r.id)} style={{ fontSize: 9, padding: '4px 6px' }}>Fiyatı sil</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {r.cooking && <div style={{color:'#58a6ff',fontWeight:'normal',fontSize:9,marginTop:3}}>
                      Başarı %{(r.successRate*100).toFixed(1)} ({r.successAtLevel ? `GERÇEK @ Lv${r.currentLevel}` : 'TAHMİN'}) • Tur: {fmt(r.expectedSuccessfulPerRun,1)} cooked / {fmt(r.expectedBurntPerRun,1)} burnt • AFK ~{r.afkSecondsPerRun}s/tur
                    </div>}
                    {r.note && (
                      <div
                        style={{
                          color: '#d29922',
                          fontWeight: 'normal',
                          fontSize: 9,
                          marginTop: 2,
                        }}
                      >
                        {r.note}
                      </div>
                    )}
                  </td>

                  <td>
                    <span
                      className={
                        r.unlocked
                          ? 'open'
                          : 'locked'
                      }
                    >
                      {r.status}
                    </span>
                  </td>

                  <td>
                    {r.skill}
                    <br />
                    {r.currentLevel}/{r.level}
                  </td>

                  <td>
                    {fmt(r.effectiveCost)}
                  </td>

                  <td>
                    {fmt(r.outputNet)}
                  </td>

                  <td
                    className={
                      (r.profit ?? 0) >= 0
                        ? 'positive'
                        : 'negative'
                    }
                  >
                    {r.profit !== null &&
                    r.profit > 0
                      ? '+'
                      : ''}
                    {fmt(r.profit)}
                  </td>

                  <td
  className={
    (r.profitForQty ?? 0) >= 0
      ? 'positive'
      : 'negative'
  }
>
  {r.profitForQty !== null &&
  r.profitForQty > 0
    ? '+'
    : ''}
  {fmt(r.profitForQty)}
</td>

                  <td
                    className={
                      (r.roi ?? 0) >= 0
                        ? 'positive'
                        : 'negative'
                    }
                  >
                    {r.roi === null
                      ? '—'
                      : `${r.roi.toFixed(1)}%`}
                  </td>

                  <td>{fmt(r.xp, 1)}</td>

                  <td
                    className={
                      (r.profitPerXp ?? 0) >= 0
                        ? 'positive'
                        : 'negative'
                    }
                  >
                    {fmt(r.profitPerXp, 2)}
                  </td>

                  <td>
                    {(r.successRate * 100).toFixed(0)}%
                  </td>

                  <td>
                    {fmt(r.dailyVolume)}
                    {lowVolume && (
                      <div className="warn">
                        ⚠ LOW VOLUME
                      </div>
                    )}
                  </td>

                  <td>
                    <b>{fmt(r.itemsPerRun)}</b>
                  </td>

                  <td className={(r.profitPerRun ?? 0) >= 0 ? 'positive' : 'negative'}>
                    {r.profitPerRun !== null && r.profitPerRun > 0 ? '+' : ''}{fmt(r.profitPerRun)}
                  </td>

                  <td>{fmt(r.xpPerRun, 1)}</td>

                  <td>
                    <b>{fmt(r.effectiveItemsPerHour)}/h</b>
                    <div style={{ fontSize: 8, color: '#8b949e' }}>
                      Teorik {fmt(r.theoreticalItemsPerHour)}/h
                      {r.speedSource === 'GERÇEK' ? ` • Gerçek ${fmt(r.effectiveItemsPerHour)}/h` : ''}
                    </div>
                  </td>

                  <td
                    className={
                      (r.gpHour ?? 0) >= 0
                        ? 'positive'
                        : 'negative'
                    }
                  >
                    {fmt(r.gpHour)}
                  </td>

                  <td>{fmt(r.xpHour)}</td>

                  <td>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 'bold',
                        color: r.speedSource === 'GERÇEK' ? '#3fb950' : '#d29922',
                      }}
                    >
                      {r.speedSource === 'GERÇEK' ? 'GERÇEK ÖLÇÜM' : 'TAHMİN'}
                    </span>
                  </td>

                  <td>
                    <span style={{ fontSize: 9, fontWeight: 'bold' }}>{r.purpose}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{marginTop:18}}>Gathering Aktiviteleri</h3>
      <div className="tableBox"><table><thead><tr><th>Aktivite</th><th>Durum</th><th>Skill</th><th>Net GP/adet</th><th>Plan adet/h</th><th>GP/h</th><th>XP/h</th><th>Dikkat</th><th>Rekabet</th><th>Veri</th></tr></thead><tbody>
        {gatheringRows.filter(r => (skillFilter==='All'||r.skill===skillFilter) && (attentionFilter==='All'||r.attentionLevel===attentionFilter) && (activityTypeFilter==='All'||activityTypeFilter==='Gathering')).map(r=><tr key={r.id} className={!r.unlocked?'lockedRow':''}>
          <td className="name">{r.name}<div style={{fontSize:9,color:'#8b949e'}}>{r.bankingMethod} • {r.notes}</div>
            <button type="button" onClick={()=>setEditingGatheringId(editingGatheringId===r.id?null:r.id)}>{editingGatheringId===r.id?'KAPAT':'+ ÖLÇÜM'}</button>
            {editingGatheringId===r.id && <div style={{marginTop:5,display:'flex',gap:4,flexWrap:'wrap'}}>
              <input type="number" placeholder="Gerçek adet/h" value={r.userData.actualItemsPerHour??''} onChange={(e)=>setGatheringData(old=>({...old,[r.id]:{...(old[r.id]||{}),actualItemsPerHour:e.target.value===''?undefined:Number(e.target.value)}}))} />
              <input type="number" placeholder="Toplanan adet" value={r.userData.measuredQuantity??''} onChange={(e)=>{const q=e.target.value===''?undefined:Number(e.target.value); const m=r.userData.measuredMinutes; setGatheringData(old=>({...old,[r.id]:{...(old[r.id]||{}),measuredQuantity:q,actualItemsPerHour:q&&m?(q/m)*60:r.userData.actualItemsPerHour}}))}} />
              <input type="number" placeholder="Dakika" value={r.userData.measuredMinutes??''} onChange={(e)=>{const m=e.target.value===''?undefined:Number(e.target.value); const q=r.userData.measuredQuantity; setGatheringData(old=>({...old,[r.id]:{...(old[r.id]||{}),measuredMinutes:m,actualItemsPerHour:q&&m?(q/m)*60:r.userData.actualItemsPerHour}}))}} />
              <div style={{fontSize:10,color:'#8b949e'}}>History: {historySummary(r.id).count} test • son {fmt(historySummary(r.id).last?.itemsPerHour)} /h • ağırlıklı {fmt(historySummary(r.id).weighted)} /h</div>
              <button onClick={()=>{const q=r.userData.measuredQuantity||0,m=r.userData.measuredMinutes||0;if(q>0&&m>0)addMeasurement(r.id,{date:new Date().toISOString(),skillLevel:r.currentLevel,quantity:q,minutes:m,itemsPerHour:q/m*60,outputs:mixedSamples[r.id]})}}>Bu gathering testini history'ye ekle</button>
              {r.secondaryItem && <div style={{fontSize:10}}>Gerçek dağılım (birikimli): {r.item} <input type="number" min="0" style={{width:70}} value={mixedSamples[r.id]?.[r.item]??''} onChange={e=>setMixedSamples(o=>({...o,[r.id]:{...(o[r.id]||{}),[r.item]:Number(e.target.value)||0}}))}/> • {r.secondaryItem} <input type="number" min="0" style={{width:70}} value={mixedSamples[r.id]?.[r.secondaryItem]??''} onChange={e=>setMixedSamples(o=>({...o,[r.id]:{...(o[r.id]||{}),[r.secondaryItem!]:Number(e.target.value)||0}}))}/> • n={r.sampleTotal}</div>}
              <button onClick={()=>setGatheringData(old=>({...old,[r.id]:{...(old[r.id]||{}),actualItemsPerHour:undefined,measuredQuantity:undefined,measuredMinutes:undefined}}))}>Ölçümü sil</button>
            </div>}
          </td><td>{r.unlocked?'✓ AÇIK':`🔒 ${r.skill.toUpperCase()} ${r.requiredLevel}`}</td><td>{r.skill} {r.currentLevel}/{r.requiredLevel}</td><td>{fmt(r.netSell)}</td><td>{fmt(r.planningItemsPerHour)}</td><td>{fmt(r.gpHour)}</td><td>{fmt(r.xpHour)}</td><td>{r.attentionLevel}</td><td>{r.competitionRisk}</td><td>{r.speedSource}</td>
        </tr>)}
      </tbody></table></div>


            </details>
      </div>}

      {activeTab==='planner'&&<div>
<section id="account-planner" style={{marginTop:18,padding:12,border:'1px solid #30363d',borderRadius:8}}>
        <h3 style={{marginTop:0}}>V4 Account Planner — Final Integration</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:10}}>
          <div className="tableBox"><table><thead><tr><th colSpan={3}>Best Safe Combat</th></tr><tr><th>Activity</th><th>Net GP/h</th><th>Risk</th></tr></thead><tbody>{v4SafeCombat.slice(0,5).map(x=><tr key={x.activity.id}><td>{x.activity.name}</td><td>{x.netGpHour==null?'—':fmt(x.netGpHour)}</td><td>{x.activity.riskType}</td></tr>)}{!v4SafeCombat.length&&<tr><td colSpan={3}>Açık/doğrulanmış combat yöntemi yok.</td></tr>}</tbody></table></div>
          <div className="tableBox"><table><thead><tr><th colSpan={3}>Wilderness / PvP — Ayrı Liste</th></tr><tr><th>Activity</th><th>Net GP/h</th><th>Risk</th></tr></thead><tbody>{v4WildCombat.slice(0,5).map(x=><tr key={x.activity.id}><td>{x.activity.name}</td><td>{x.netGpHour==null?'—':fmt(x.netGpHour)}</td><td>{x.activity.riskType}</td></tr>)}{!v4WildCombat.length&&<tr><td colSpan={3}>Açık yöntem yok.</td></tr>}</tbody></table></div>
        </div>
        <h4>Next Profitable Unlock — Full Database</h4>
        <div className="tableBox"><table><thead><tr><th>Ufuk</th><th>Activity</th><th>Eksik skill</th><th>Diğer kilitler</th></tr></thead><tbody>{v4Unlocks.slice(0,10).map(x=><tr key={x.activity.id}><td>{x.bucket}</td><td>{x.activity.name}</td><td>{x.missingSkills.map(r=>`${r.skill} ${r.current}→${r.level}`).join(' • ')||'—'}</td><td>{x.access.missing.filter(m=>!m.includes('gerekli (mevcut')).join(' • ')||'—'}</td></tr>)}</tbody></table></div>
        <h4>Şimdi yapabilirsin — sadece ekipmanı edin</h4>
        <div className="tableBox"><table><thead><tr><th>Activity</th><th>Skill</th><th>Gerekli ekipman</th></tr></thead><tbody>
          {v4GearReady.map(x=><tr key={x.activity.id}><td>{x.activity.name}</td><td>{x.activity.requirements.skills?.map(s=>`${s.skill} ${s.level}`).join(' • ')||'—'}</td><td>{x.access.missing.filter(m=>m.startsWith('Ekipman edin:')).map(m=>m.replace('Ekipman edin: ','')).join(' • ')}</td></tr>)}
          {!v4GearReady.length&&<tr><td colSpan={3}>Yalnızca ekipman alarak açılacak yöntem yok.</td></tr>}
        </tbody></table></div>
        <h4>Quest Unlock Value</h4>
        <div className="tableBox"><table><thead><tr><th>Quest</th><th>Açtığı verified activity</th><th>Örnekler</th></tr></thead><tbody>{v4QuestValue.map(q=><tr key={q.quest}><td>{q.quest}</td><td>{q.count}</td><td>{q.activities.slice(0,4).join(' • ')}</td></tr>)}{!v4QuestValue.length&&<tr><td colSpan={3}>Eksik quest requirement bulunamadı.</td></tr>}</tbody></table></div>
        <h4>Item → Money Chain</h4>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}><input value={v4PlannerItem} onChange={e=>setV4PlannerItem(e.target.value)} placeholder="Item ara: onyx, rune, shark..."/><span style={{fontSize:10,color:'#8b949e'}}>Gather myself = 0 GP sayılmaz; ekonomik maliyet GE opportunity cost'tur.</span></div>
        {v4PlannerItem&&<div className="tableBox" style={{marginTop:6}}><table><thead><tr><th>Activity</th><th>Acquire</th><th>Process</th><th>Final</th><th>Sell</th></tr></thead><tbody>{v4Chains.map(a=><tr key={a.id}><td>{a.name}</td><td>{a.chain?.acquire?.join(' → ')||'—'}</td><td>{a.chain?.process?.join(' → ')||'—'}</td><td>{a.chain?.finalProduct?.join(' → ')||'—'}</td><td>{a.chain?.sell?.join(' → ')||'—'}</td></tr>)}{!v4Chains.length&&<tr><td colSpan={5}>Bu item için tanımlı verified/needs-verification chain kaydı yok.</td></tr>}</tbody></table></div>}
        <div style={{fontSize:10,color:'#8b949e',marginTop:8}}>Bond Sustain mevcut canlı ekonomi motorunda kalır; V4 combat tarafında yalnızca net GP/h (loot − supplies) tanımlı ve VERIFIED yöntemler güvenli karşılaştırmaya alınır. Wilderness/PvP otomatik olarak ayrı tutulur.</div>
      </section>

            </div>}

      {activeTab==='coverage'&&<div>
        <section style={{padding:12,border:'1px solid #58a6ff',borderRadius:8,marginBottom:12}}>
          <h3 style={{marginTop:0,color:'#f0f6fc'}}>DATABASE COVERAGE AUDIT</h3>
          <div style={{fontSize:11,color:'#8b949e',marginBottom:10}}>Coverage yalnız canonical manifest içindeki gerçek activity hedeflerine göre hesaplanır. PLACEHOLDER satırlar VERIFIED coverage sayılmaz. Manifest v1 genişletildikçe denominator büyür; mevcut database kendi kendine %100 üretemez.</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <div className="card"><b>F2P manifest coverage</b><div style={{fontSize:24}}>{coverageSummary.f2p.pct.toFixed(1)}%</div><small>{coverageSummary.f2p.VERIFIED}/{coverageSummary.f2p.total} VERIFIED • {coverageSummary.f2p.MISSING} MISSING</small></div>
            <div className="card"><b>MEMBERS manifest coverage</b><div style={{fontSize:24}}>{coverageSummary.member.pct.toFixed(1)}%</div><small>{coverageSummary.member.VERIFIED}/{coverageSummary.member.total} VERIFIED • {coverageSummary.member.MISSING} MISSING</small></div>
            <div className="card"><b>V5 audit</b><div style={{fontSize:18}}>{qualityCounts.PLACEHOLDER} PLACEHOLDER</div><small>{qualityCounts.VERIFIED} VERIFIED • {qualityCounts.NEEDS_VERIFICATION} NEEDS VERIFICATION</small></div>
          </div>
        </section>
        <section>
          <h3 style={{color:'#f0f6fc'}}>Canonical Manifest — Missing / Quality</h3>
          <div className="tableBox"><table><thead><tr><th>Mode</th><th>Skill</th><th>Activity</th><th>Status</th><th>DB ID</th></tr></thead><tbody>
            {coverageRows.map(x=><tr key={x.canonical.key}><td>{x.canonical.member?'MEMBERS':'F2P'}</td><td>{x.canonical.page}</td><td className="name">{x.canonical.label}</td><td><b>{x.activity?.quality||'MISSING'}</b></td><td>{x.activity?.id||x.canonical.key}</td></tr>)}
          </tbody></table></div>
        </section>
      </div>}

      {activeTab==='database'&&<div>
<section style={{marginTop:18,padding:12,border:'1px solid #30363d',borderRadius:8}} id="activity-database">
        <h3 style={{marginTop:0}}>V4 — Global Activity Database Search</h3>
        <div style={{fontSize:10,color:'#8b949e',marginBottom:8}}>OPEN ve LOCKED aktiviteleri aynı katalogda ara. Doğrulanmamış kayıtlar önerilere girmez.</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <input value={v4Search} onChange={e=>{setV4Search(e.target.value);setV4Page(1)}} placeholder="onyx, rune, shark, dragon, slayer..." style={{minWidth:280}} />
          <select value={v4KindFilter} onChange={e=>{setV4KindFilter(e.target.value);setV4Page(1)}}><option value="ALL">Tüm türler</option><option value="PROCESSING">Processing</option><option value="GATHERING">Gathering</option><option value="COMBAT">Combat</option><option value="MAGIC">Magic</option><option value="UTILITY">Utility</option></select>
          <label style={{fontSize:10}}><input type="checkbox" checked={v4ShowLocked} onChange={e=>{setV4ShowLocked(e.target.checked);setV4Page(1)}} /> LOCKED göster</label>
          <button type="button" onClick={()=>{setV4ViewAll(x=>!x);setV4Page(1)}}>{v4ViewAll?'View All kapat':'View All'}</button>
          <span style={{fontSize:10,color:'#8b949e'}}>Database: {v4Stats.total} • Verified: {v4Stats.verified} • Members: {v4Stats.members} • OPEN: {v4Stats.open} • LOCKED: {v4Stats.locked}</span>
        </div>
        {(v4Search || v4ViewAll) && <div className="tableBox" style={{marginTop:8}}><table><thead><tr><th>Activity</th><th>F2P/P2P</th><th>Tür</th><th>Skill / Level</th><th>Durum</th><th>Eksik / Hazırlık</th><th>Risk</th><th>Dikkat</th><th>Doğrulama</th></tr></thead><tbody>
          {v4PagedResults.map(({activity,access})=><tr key={activity.id} className={!access.open?'lockedRow':''}>
            <td className="name">{activity.name}<div style={{fontSize:9,color:'#8b949e'}}>{activity.items?.join(' • ')}</div></td>
            <td>{activity.f2p?'F2P':'MEMBER'}</td>
            <td>{activity.kind}<br/><span style={{fontSize:9}}>{activity.category}</span></td>
            <td>{activity.requirements.skills?.map(x=>`${x.skill} ${x.level}`).join(' • ')||activity.skills.join(', ')||'—'}</td>
            <td><b>{access.status}</b></td>
            <td>{access.missing.length?access.missing.join(' | '):'—'}</td>
            <td>{activity.riskType}{activity.combat?.wildernessPvpRisk&&<><br/><span style={{fontSize:9,color:'#f85149'}}>PvP risk</span></>}</td>
            <td>{activity.attention}{activity.afkWindowSeconds?<><br/><span style={{fontSize:9}}>{activity.afkWindowSeconds}s AFK</span></>:null}</td>
            <td>{activity.verified==='VERIFIED'?'✓ VERIFIED':'⚠ NEEDS VERIFICATION'}{activity.combat?.recommendedStats?.length?<div style={{fontSize:9,color:'#8b949e'}}>Öneri: {activity.combat.recommendedStats.map(x=>`${x.skill} ${x.level}`).join(' • ')}</div>:null}</td>
          </tr>)}
          {!v4SearchResults.length&&<tr><td colSpan={9}>Eşleşme yok.</td></tr>}
        </tbody></table>
          {v4SearchResults.length>0&&<div style={{display:'flex',justifyContent:'center',gap:8,alignItems:'center',padding:8}}>
            <button type="button" disabled={v4Page<=1} onClick={()=>setV4Page(p=>Math.max(1,p-1))}>← Önceki</button>
            <span>Sayfa {v4Page}/{v4PageCount} • {v4SearchResults.length} kayıt</span>
            <button type="button" disabled={v4Page>=v4PageCount} onClick={()=>setV4Page(p=>Math.min(v4PageCount,p+1))}>Sonraki →</button>
          </div>}
        </div>}
      </section>

      </div>}

      <p className="foot">
        F2P modunda MEMBERS veya F2P doğrulaması olmayan yöntemler ekonomik sıralamaya katılmaz. Gerçek hız girilmişse GP/h ve XP/h gerçek ölçümü, yoksa teorik tahmini kullanır. Gerçek fiyat override'ları yalnızca ilgili yöntemin hesabını değiştirir; canlı Wiki verisini değiştirmez. Düşük hacimli ürünlerde görünen marjı
        büyük miktarda işlem yapmadan önce 1–10 adet ile doğrula.
      </p>
    </main>
  )
}
