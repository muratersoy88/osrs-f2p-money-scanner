import type { V4Activity } from '../types'
const d='2026-10-04',src='OSRS Crafting level tables; member-only gem/jewellery actions'
const p=(id:string,name:string,lvl:number,items:string[],notes:string,gear?:string[]):V4Activity=>({id,name,kind:'PROCESSING',category:'Crafting',skills:['Crafting'],f2p:false,members:true,verified:'VERIFIED',source:src,lastVerified:d,requirements:{skills:[{skill:'Crafting',level:lvl}],...(gear?{gear}: {})},attention:'HIGH',riskType:'SAFE',tags:['members','p2p','crafting',...items.map(x=>x.toLowerCase())],items,notes})
export const p2pCraftingActivities:V4Activity[]=[
 p('p2p-cut-dragonstone','Cut Dragonstone',55,['Uncut dragonstone','Dragonstone'],'137.5 Crafting XP per successful cut.',['Chisel']),
 p('p2p-cut-onyx','Cut Onyx',67,['Uncut onyx','Onyx'],'167.5 Crafting XP. High-capital processing; live margin must decide viability.',['Chisel']),
 p('p2p-cut-zenyte','Cut Zenyte',89,['Uncut zenyte','Zenyte'],'200 Crafting XP. Very high-capital processing.',['Chisel']),
 p('p2p-dragonstone-ring','Make Dragonstone ring',55,['Gold bar','Dragonstone','Dragonstone ring'],'Member jewellery; furnace + ring mould.',['Ring mould']),
 p('p2p-dragon-necklace','Make Dragon necklace',72,['Gold bar','Dragonstone','Dragon necklace'],'Member jewellery; furnace + necklace mould.',['Necklace mould']),
 p('p2p-dragonstone-bracelet','Make Dragonstone bracelet',74,['Gold bar','Dragonstone','Dragonstone bracelet'],'Member jewellery; furnace + bracelet mould.',['Bracelet mould']),
 p('p2p-dragonstone-amulet','Make Dragonstone amulet (u)',80,['Gold bar','Dragonstone','Dragonstone amulet (u)'],'Member jewellery; furnace + amulet mould.',['Amulet mould']),
 p('p2p-onyx-ring','Make Onyx ring',67,['Gold bar','Onyx','Onyx ring'],'High-capital member jewellery.',['Ring mould']),
 p('p2p-onyx-necklace','Make Onyx necklace',82,['Gold bar','Onyx','Onyx necklace'],'High-capital member jewellery.',['Necklace mould']),
 p('p2p-onyx-bracelet','Make Onyx bracelet',84,['Gold bar','Onyx','Onyx bracelet'],'High-capital member jewellery.',['Bracelet mould']),
 p('p2p-onyx-amulet','Make Onyx amulet (u)',90,['Gold bar','Onyx','Onyx amulet (u)'],'High-capital member jewellery.',['Amulet mould']),
 p('p2p-zenyte-ring','Make Zenyte ring',89,['Gold bar','Zenyte','Zenyte ring'],'Very high-capital member jewellery.',['Ring mould']),
 p('p2p-zenyte-necklace','Make Zenyte necklace',92,['Gold bar','Zenyte','Zenyte necklace'],'Very high-capital member jewellery.',['Necklace mould']),
 p('p2p-zenyte-bracelet','Make Zenyte bracelet',95,['Gold bar','Zenyte','Zenyte bracelet'],'Very high-capital member jewellery.',['Bracelet mould']),
 p('p2p-zenyte-amulet','Make Zenyte amulet (u)',98,['Gold bar','Zenyte','Zenyte amulet (u)'],'Very high-capital member jewellery.',['Amulet mould']),
]
