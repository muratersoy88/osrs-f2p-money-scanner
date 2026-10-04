import type { V4Activity } from '../types'
const v='VERIFIED' as const,d='2026-10-04',src='OSRS F2P Crafting jewellery tables'
const j=(id:string,name:string,lvl:number,items:string[],mould:string,xp:number):V4Activity=>({id,name,kind:'PROCESSING',category:'Crafting Jewellery',skills:['Crafting'],f2p:true,members:true,verified:v,source:src,lastVerified:d,requirements:{skills:[{skill:'Crafting',level:lvl}],gear:[mould]},attention:'MEDIUM',riskType:'SAFE',tags:['crafting','jewellery',...items.map(x=>x.toLowerCase()),'f2p'],items,notes:`${xp} Crafting XP/item. Furnace and ${mould.toLowerCase()} required.`})
const e=(id:string,name:string,lvl:number,items:string[]):V4Activity=>({id,name,kind:'MAGIC',category:'Jewellery Enchant',skills:['Magic'],f2p:true,members:true,verified:v,source:'OSRS standard spellbook jewellery enchant tables',lastVerified:d,requirements:{skills:[{skill:'Magic',level:lvl}]},attention:'HIGH',riskType:'SAFE',tags:['magic','enchant','jewellery',...items.map(x=>x.toLowerCase()),'f2p'],items,notes:'Rune cost and live GE values must be included in economic profit.'})
export const f2pJewelleryActivities:V4Activity[]=[
 j('f2p-sapphire-ring','Make Sapphire ring',20,['Gold bar','Sapphire','Sapphire ring'],'Ring mould',40),
 j('f2p-sapphire-necklace','Make Sapphire necklace',22,['Gold bar','Sapphire','Sapphire necklace'],'Necklace mould',55),
 j('f2p-sapphire-amulet','Make Sapphire amulet (u)',24,['Gold bar','Sapphire','Sapphire amulet (u)'],'Amulet mould',65),
 j('f2p-emerald-ring','Make Emerald ring',27,['Gold bar','Emerald','Emerald ring'],'Ring mould',55),
 j('f2p-emerald-necklace','Make Emerald necklace',29,['Gold bar','Emerald','Emerald necklace'],'Necklace mould',60),
 j('f2p-emerald-amulet','Make Emerald amulet (u)',31,['Gold bar','Emerald','Emerald amulet (u)'],'Amulet mould',70),
 j('f2p-ruby-ring','Make Ruby ring',34,['Gold bar','Ruby','Ruby ring'],'Ring mould',70),
 j('f2p-ruby-necklace','Make Ruby necklace',40,['Gold bar','Ruby','Ruby necklace'],'Necklace mould',75),
 j('f2p-ruby-amulet','Make Ruby amulet (u)',50,['Gold bar','Ruby','Ruby amulet (u)'],'Amulet mould',85),
 j('f2p-diamond-ring','Make Diamond ring',43,['Gold bar','Diamond','Diamond ring'],'Ring mould',85),
 j('f2p-diamond-necklace','Make Diamond necklace',56,['Gold bar','Diamond','Diamond necklace'],'Necklace mould',90),
 j('f2p-diamond-amulet','Make Diamond amulet (u)',70,['Gold bar','Diamond','Diamond amulet (u)'],'Amulet mould',100),
 e('f2p-enchant-sapphire-amulet','Enchant Sapphire amulet',7,['Sapphire amulet','Amulet of magic']),
 e('f2p-enchant-emerald-amulet','Enchant Emerald amulet',27,['Emerald amulet','Amulet of defence']),
 e('f2p-enchant-ruby-amulet','Enchant Ruby amulet',49,['Ruby amulet','Amulet of strength']),
 e('f2p-enchant-diamond-amulet','Enchant Diamond amulet',57,['Diamond amulet','Amulet of power']),
]
