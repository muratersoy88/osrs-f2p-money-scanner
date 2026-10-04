import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API = 'https://prices.runescape.wiki/api/v1/osrs'

type AccountMode = 'F2P' | 'P2P'
type RecipeKind = 'normal' | 'alchemy'
type MethodPurpose = 'MONEY' | 'SKILL + PROFIT' | 'XP'

type MethodUserData = {
  actualItemsPerHour?: number
  measuredQuantity?: number
  measuredMinutes?: number
  actualBuyCost?: number
  actualSellPrice?: number
  purpose?: MethodPurpose
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

const recipeId = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

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
  }, [gp, quantity, levels, mode, methodData, targetHours])

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
      const membersLocked = mode === 'F2P' && !r.f2p
      const currentLevel = levels[r.skill] ?? 1
      const levelLocked = currentLevel < r.level

      let status = '✓ AÇIK'
      if (membersLocked) status = '🔒 MEMBERS'
      else if (levelLocked) status = `🔒 ${r.skill.toUpperCase()} ${r.level}`

      const unlocked = !membersLocked && !levelLocked

      let inputCost = 0
      let outputPrice: number | null = null
      let outputNet: number | null = null
      let successRate = r.success ? r.success(levels) : 1
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

      /*
        Cost per successful finished item.
        This matters for iron smelting, wine, pizza etc.
      */
      const effectiveCost =
        valid && successRate > 0
          ? inputCost / successRate
          : null

      const profit =
        effectiveCost !== null && outputNet !== null
          ? outputNet - effectiveCost
          : null

      const roi =
        profit !== null && effectiveCost! > 0
          ? (profit / effectiveCost!) * 100
          : null

      const profitPerXp =
        profit !== null && r.xp > 0
          ? profit / r.xp
          : null

      const theoreticalItemsPerHour = r.itemsPerHour * successRate
      const hasActualSpeed =
        userData.actualItemsPerHour !== undefined &&
        userData.actualItemsPerHour > 0
      const effectiveItemsPerHour = hasActualSpeed
        ? userData.actualItemsPerHour!
        : theoreticalItemsPerHour
      const speedSource = hasActualSpeed ? 'GERÇEK' : 'TAHMİN'

      const gpHour =
        profit !== null
          ? profit * effectiveItemsPerHour
          : null

      const xpHour = r.xp * effectiveItemsPerHour

      const qty = Math.max(1, Math.floor(quantity || 1))

      const attemptsForQty =
        successRate > 0
          ? qty / successRate
          : qty

      const capitalForQty =
        valid
          ? inputCost * attemptsForQty
          : null

      const profitForQty =
        profit !== null
          ? profit * qty
          : null

      const xpForQty = r.xp * qty

      const maxByCapital =
        effectiveCost !== null && effectiveCost > 0
          ? Math.max(0, Math.floor(gp / effectiveCost))
          : 0

      const timePotentialQty = Math.max(0, Math.floor(effectiveItemsPerHour * targetHours))
      const timeLimitedQty = Math.min(timePotentialQty, maxByCapital)
      const timeCapital =
        effectiveCost !== null ? effectiveCost * timeLimitedQty : null
      const timeProfit = profit !== null ? profit * timeLimitedQty : null
      const timeXp = r.xp * timeLimitedQty

      const autoPurpose: MethodPurpose =
        profit !== null && profit > 0 && r.xp > 0
          ? 'SKILL + PROFIT'
          : profit !== null && profit > 0
          ? 'MONEY'
          : 'XP'
      const purpose = userData.purpose || autoPurpose

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
        inventoryProfit,
        ingredientsText,
        alchValue,
      }
    })
  }, [mapping, prices, volumes, levels, mode, quantity, methodData, gp, targetHours])

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

  const bestF2P = rows
    .filter(
      (r) =>
        r.unlocked &&
        r.f2p &&
        r.profit !== null &&
        r.profit > 0
    )
    .sort(
      (a, b) =>
        (b.gpHour ?? -Infinity) -
        (a.gpHour ?? -Infinity)
    )[0]

  return (
    <main>
      <header>
        <div>
          <h1>OSRS F2P Money Scanner V2.2.1</h1>
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

      {bestF2P && (
        <div
          style={{
            background: '#12261a',
            border: '1px solid #238636',
            borderRadius: 7,
            padding: '9px 12px',
            marginBottom: 10,
            fontSize: 12,
          }}
        >
          <b style={{ color: '#3fb950' }}>
            ★ Şu an en güçlü açık F2P yöntem:
          </b>{' '}
          {bestF2P.name} —{' '}
          <b>{fmt(bestF2P.gpHour)} GP/h</b> —{' '}
          {fmt(bestF2P.profit)} GP/adet —{' '}
          <b>{bestF2P.speedSource}</b>
        </div>
      )}

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
                          <div style={{ display: 'flex', gap: 5, alignItems: 'end' }}>
                            <button type="button" onClick={() => clearActualSpeed(r.id)} style={{ fontSize: 9, padding: '4px 6px' }}>Hızı sil</button>
                            <button type="button" onClick={() => clearActualPrices(r.id)} style={{ fontSize: 9, padding: '4px 6px' }}>Fiyatı sil</button>
                          </div>
                        </div>
                      )}
                    </div>

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

      <p className="foot">
        F2P modunda MEMBERS yöntemleri ekonomik sıralamaya katılmaz. Gerçek hız girilmişse GP/h ve XP/h gerçek ölçümü, yoksa teorik tahmini kullanır. Gerçek fiyat override'ları yalnızca ilgili yöntemin hesabını değiştirir; canlı Wiki verisini değiştirmez. Düşük hacimli ürünlerde görünen marjı
        büyük miktarda işlem yapmadan önce 1–10 adet ile doğrula.
      </p>
    </main>
  )
}
