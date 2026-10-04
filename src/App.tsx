import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API = 'https://prices.runescape.wiki/api/v1/osrs'

type AccountMode = 'F2P' | 'P2P'
type RecipeKind = 'normal' | 'alchemy'
type MethodPurpose = 'MONEY' | 'SKILL + PROFIT' | 'XP'
type AttentionLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'AFK'
type ActivityType = 'Processing' | 'Gathering' | 'Cooking' | 'Combat'
type CompetitionRisk = 'LOW' | 'MEDIUM' | 'HIGH'

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
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n))

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

  // ---------------- MEMBERS AUDIT ----------------
  {
    name: 'Enchant sapphire ring → Ring of recoil',
    category: 'Members',
    skill: 'Magic',
    level: 7,
    xp: 17.5,
    inputs: [
      { name: 'Sapphire ring', qty: 1 },
      { name: 'Cosmic rune', qty: 1 },
      { name: 'Water rune', qty: 1 },
    ],
    output: 'Ring of recoil',
    f2p: false,
    itemsPerHour: 1200,
    note: 'MEMBERS ONLY',
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
    if (!parsed[steelId]) {
      parsed[steelId] = {
        actualItemsPerHour: 491,
        measuredQuantity: 270,
        measuredMinutes: 33,
      }
    }
    return parsed
  } catch {
    return {
      [recipeId('Iron + 2 Coal → Steel bar')]: {
        actualItemsPerHour: 491,
        measuredQuantity: 270,
        measuredMinutes: 33,
      },
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
    try { return JSON.parse(localStorage.getItem('osrs-gathering-data-v24') || '{}') } catch { return {} }
  })
  const [editingGatheringId, setEditingGatheringId] = useState<string | null>(null)

  const updateMethodData = (id: string, patch: Partial<MethodUserData>) => {
    setMethodData((old) => ({
      ...old,
      [id]: { ...(old[id] || {}), ...patch },
    }))
  }

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
  }, [gp, quantity, levels, mode, methodData, targetHours, planningFactor, gatheringData])

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

  const rows = useMemo(() => {
    return RECIPES.map((r) => {
      const id = recipeId(r.name)
      const userData = methodData[id] || {}
      const verifiedF2P = r.verifiedF2P !== false
      const membersLocked = mode === 'F2P' && (!r.f2p || !verifiedF2P)
      const currentLevel = levels[r.skill] ?? 1
      const levelLocked = currentLevel < r.level

      let status = '✓ AÇIK'
      if (mode === 'F2P' && !verifiedF2P) status = '🔒 F2P DOĞRULANMADI'
      else if (membersLocked) status = '🔒 MEMBERS'
      else if (levelLocked) status = `🔒 ${r.skill.toUpperCase()} ${r.level}`

      const unlocked = !membersLocked && !levelLocked

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

  const processingTop3 = useMemo(() => scoreProcessing(rows.filter(r => r.unlocked && r.verifiedF2P && r.activityType !== 'Gathering' && r.profit !== null && r.profit > 0 && r.capitalPerRun !== null && r.capitalPerRun <= gp)), [rows, gp])

  const gatheringRows = useMemo(() => GATHERING.map(a => {
    const id = `gather-${recipeId(a.name)}`
    const ud = gatheringData[id] || {}
    const level = levels[a.skill] ?? 1
    const unlocked = a.f2p && a.verifiedF2P && level >= a.requiredLevel
    const sellPrice = sell(a.item)
    const secondarySell = a.secondaryItem ? sell(a.secondaryItem) : null
    const primaryNet = sellPrice === null ? null : sellPrice - geTax(sellPrice)
    const secondaryNet = secondarySell === null ? null : secondarySell - geTax(secondarySell)
    const share = a.primaryShare ?? 1
    const netSell = primaryNet === null ? null : (a.secondaryItem && secondaryNet !== null ? primaryNet * share + secondaryNet * (1-share) : primaryNet)
    const xpPerItem = a.secondaryXpPerSuccess !== undefined ? a.xpPerSuccess * share + a.secondaryXpPerSuccess * (1-share) : a.xpPerSuccess
    const actual = ud.actualItemsPerHour && ud.actualItemsPerHour > 0 ? ud.actualItemsPerHour : null
    const effectiveItemsPerHour = actual ?? a.theoreticalItemsPerHour
    const planningItemsPerHour = actual ?? a.theoreticalItemsPerHour * clamp(planningFactor/100, .1, 1)
    const gpHour = netSell === null ? null : netSell * planningItemsPerHour
    const xpHour = xpPerItem * planningItemsPerHour
    return { ...a, id, userData: ud, currentLevel: level, unlocked, netSell, xpPerItem, effectiveItemsPerHour, planningItemsPerHour, gpHour, xpHour, speedSource: actual ? 'GERÇEK' : 'TAHMİN' }
  }), [gatheringData, levels, prices, mapping, planningFactor])

  const gatheringTop3 = useMemo(() => gatheringRows.filter(r => r.unlocked && r.netSell !== null).map(r => {
    const riskPenalty = r.competitionRisk === 'HIGH' ? .65 : r.competitionRisk === 'MEDIUM' ? .82 : 1
    const attentionBonus = r.attentionLevel === 'AFK' ? 1.12 : r.attentionLevel === 'LOW' ? 1.06 : 1
    return { ...r, gatherScore: Math.max(r.gpHour ?? 0,0) * riskPenalty * attentionBonus + r.xpHour * .05 }
  }).sort((a,b)=>b.gatherScore-a.gatherScore).slice(0,3), [gatheringRows])

  const afkTop3 = useMemo(() => {
    const proc = rows.filter(r => r.unlocked && r.verifiedF2P && ['LOW','AFK'].includes(r.attentionLevel) && (r.profit ?? -Infinity) >= 0).map(r => ({ kind:'processing', ...r, afkScore: (r.afkSecondsPerRun ?? 20) + Math.max(r.xpPerRun ?? 0,0)/100 + Math.max(r.profitPerRun ?? 0,0)/1000 }))
    const gat = gatheringRows.filter(r => r.unlocked && ['LOW','AFK'].includes(r.attentionLevel)).map(r => ({ kind:'gathering', ...r, profitPerRun:null, xpPerRun:null, afkSecondsPerRun:null, profit:r.netSell, afkScore: (r.attentionLevel==='AFK'?100:60) + r.xpHour/1000 + Math.max(r.gpHour ?? 0,0)/10000 }))
    return [...proc, ...gat].sort((a,b)=>(b.afkScore??0)-(a.afkScore??0)).slice(0,3)
  }, [rows, gatheringRows])



  return (
    <main>
      <header>
        <div>
          <h1>OSRS F2P Money Scanner V2.4.0</h1>
          <p>
            Live GE processing scanner • gerçek hız/fiyat • sermaye ve süre planı • F2P safety audit
          </p>
        </div>

        <button onClick={refresh} disabled={loading}>
          {loading
            ? 'Güncelleniyor...'
            : '↻ Fiyatları Güncelle'}
        </button>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="cards">
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
            <option value="P2P">P2P</option>
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


      <section className="filters">
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

      <div
        style={{
          marginTop: 10,
          padding: 10,
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 7,
        }}
      >
        <div
          style={{
            fontWeight: 'bold',
            marginBottom: 8,
            color: '#e3b341',
            fontSize: 12,
          }}
        >
          Skill Seviyelerim
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 7,
          }}
        >
          {Object.keys(levels).map((s) => (
            <label
              key={s}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
              }}
            >
              {s}
              <input
                type="number"
                min="1"
                max="99"
                value={levels[s]}
                onChange={(e) => {
                  const n = clamp(
                    Number(e.target.value),
                    1,
                    99
                  )

                  setLevels((old) => ({
                    ...old,
                    [s]: n,
                  }))
                }}
                style={{
                  width: 50,
                  background: '#0d1117',
                  color: 'white',
                  border: '1px solid #30363d',
                  borderRadius: 4,
                  padding: 4,
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="explain">
        <b>Input:</b> Wiki HIGH = hızlı alış &nbsp;•&nbsp;
        <b>Output:</b> Wiki LOW = hızlı satış &nbsp;•&nbsp;
        <b>GE tax:</b> dahil &nbsp;•&nbsp;
        <b>Hedef:</b> {fmt(quantity)} adet &nbsp;•&nbsp;
        <b>Süre:</b> {targetHours === 0.5 ? '30 dk' : `${targetHours} saat`} &nbsp;•&nbsp;
        <b>Ölçülmemiş hız planı:</b> %{planningFactor} &nbsp;•&nbsp;
        <b>Güncelleme:</b>{' '}
        {updated
          ? updated.toLocaleTimeString('tr-TR')
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
                                updateMethodData(r.id,{actualSuccessByLevel:{...(r.userData.actualSuccessByLevel||{}),[String(r.currentLevel)]:{total,successful,burnt,rate:successful/total}}})
                              }
                            }}>Cooking başarısını kaydet @ Lv{r.currentLevel}</button>
                            {r.successAtLevel && <button type="button" style={{fontSize:9}} onClick={()=>{
                              const next={...(r.userData.actualSuccessByLevel||{})}; delete next[String(r.currentLevel)]; updateMethodData(r.id,{actualSuccessByLevel:next})
                            }}>Bu level ölçümünü sil</button>}
                          </>}
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
              <button onClick={()=>setGatheringData(old=>({...old,[r.id]:{...(old[r.id]||{}),actualItemsPerHour:undefined,measuredQuantity:undefined,measuredMinutes:undefined}}))}>Ölçümü sil</button>
            </div>}
          </td><td>{r.unlocked?'✓ AÇIK':`🔒 ${r.skill.toUpperCase()} ${r.requiredLevel}`}</td><td>{r.skill} {r.currentLevel}/{r.requiredLevel}</td><td>{fmt(r.netSell)}</td><td>{fmt(r.planningItemsPerHour)}</td><td>{fmt(r.gpHour)}</td><td>{fmt(r.xpHour)}</td><td>{r.attentionLevel}</td><td>{r.competitionRisk}</td><td>{r.speedSource}</td>
        </tr>)}
      </tbody></table></div>

      <p className="foot">
        F2P modunda MEMBERS veya F2P doğrulaması olmayan yöntemler ekonomik sıralamaya katılmaz. Gerçek hız girilmişse GP/h ve XP/h gerçek ölçümü, yoksa teorik tahmini kullanır. Gerçek fiyat override'ları yalnızca ilgili yöntemin hesabını değiştirir; canlı Wiki verisini değiştirmez. Düşük hacimli ürünlerde görünen marjı
        büyük miktarda işlem yapmadan önce 1–10 adet ile doğrula.
      </p>
    </main>
  )
}
