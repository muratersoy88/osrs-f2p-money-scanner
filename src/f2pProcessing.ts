import type { V4Activity } from '../types'
const v='VERIFIED' as const,d='2026-10-04',src='OSRS Wiki F2P Smithing/Crafting guides (verified 2026-10-04)'
const p=(id:string,name:string,cat:string,skill:string,lvl:number,items:string[],notes:string,attention:V4Activity['attention']='MEDIUM',extra:Partial<V4Activity>={}):V4Activity=>({id,name,kind:'PROCESSING',category:cat,skills:[skill],f2p:true,members:true,verified:v,source:src,lastVerified:d,requirements:{skills:[{skill,level:lvl}]},attention,riskType:'SAFE',tags:[cat.toLowerCase(),skill.toLowerCase(),...items.map(x=>x.toLowerCase()),'f2p'],items,notes,...extra})
export const f2pProcessingActivities:V4Activity[]=[
 p('f2p-smelt-bronze','Smelt Bronze bars','Smithing','Smithing',1,['Copper ore','Tin ore','Bronze bar'],'1 copper + 1 tin; 6.2 Smithing XP/bar.'),
 p('f2p-smelt-iron','Smelt Iron bars','Smithing','Smithing',15,['Iron ore','Iron bar'],'Base iron smelting has failure chance; Ring of forging is members-only and must not be assumed in F2P.'),
 p('f2p-smelt-silver','Smelt Silver bars','Smithing','Smithing',20,['Silver ore','Silver bar'],'13.7 Smithing XP/bar.'),
 p('f2p-smelt-steel','Smelt Steel bars','Smithing','Smithing',30,['Iron ore','Coal','Steel bar'],'1 iron + 2 coal; 17.5 Smithing XP/bar. Existing real Steel measurements remain in V2.5 history.'),
 p('f2p-smelt-gold','Smelt Gold bars','Smithing','Smithing',40,['Gold ore','Gold bar'],'22.5 Smithing XP/bar; Goldsmith gauntlets are not assumed.'),
 p('f2p-smelt-mithril','Smelt Mithril bars','Smithing','Smithing',50,['Mithril ore','Coal','Mithril bar'],'1 mithril + 4 coal; 30 Smithing XP/bar.'),
 p('f2p-smelt-adamant','Smelt Adamantite bars','Smithing','Smithing',70,['Adamantite ore','Coal','Adamantite bar'],'1 adamantite + 6 coal; 37.5 Smithing XP/bar.'),
 p('f2p-smelt-runite','Smelt Runite bars','Smithing','Smithing',85,['Runite ore','Coal','Runite bar'],'1 runite + 8 coal; 50 Smithing XP/bar.'),
 p('f2p-cut-sapphire','Cut Sapphire','Crafting','Crafting',20,['Uncut sapphire','Sapphire'],'50 Crafting XP/item. Live margin must use current GE prices.','HIGH'),
 p('f2p-cut-emerald','Cut Emerald','Crafting','Crafting',27,['Uncut emerald','Emerald'],'67.5 Crafting XP/item.','HIGH'),
 p('f2p-cut-ruby','Cut Ruby','Crafting','Crafting',34,['Uncut ruby','Ruby'],'85 Crafting XP/item.','HIGH'),
 p('f2p-cut-diamond','Cut Diamond','Crafting','Crafting',43,['Uncut diamond','Diamond'],'107.5 Crafting XP/item.','HIGH'),
 p('f2p-gold-ring','Make Gold ring','Crafting','Crafting',5,['Gold bar','Gold ring'],'15 Crafting XP/item; furnace + ring mould.' ,'MEDIUM',{requirements:{skills:[{skill:'Crafting',level:5}],gear:['Ring mould']}}),
 p('f2p-gold-necklace','Make Gold necklace','Crafting','Crafting',6,['Gold bar','Gold necklace'],'20 Crafting XP/item; furnace + necklace mould.','MEDIUM',{requirements:{skills:[{skill:'Crafting',level:6}],gear:['Necklace mould']}}),
 p('f2p-gold-amulet','Make Gold amulet (u)','Crafting','Crafting',8,['Gold bar','Gold amulet (u)'],'30 Crafting XP/item; furnace + amulet mould.','MEDIUM',{requirements:{skills:[{skill:'Crafting',level:8}],gear:['Amulet mould']}}),
 p('f2p-tiara','Make Tiara','Crafting','Crafting',23,['Silver bar','Tiara'],'52.5 Crafting XP/item; furnace + tiara mould.','MEDIUM',{requirements:{skills:[{skill:'Crafting',level:23}],gear:['Tiara mould']}}),
 p('f2p-leather-chaps','Craft Leather chaps','Crafting','Crafting',18,['Leather','Leather chaps'],'27 Crafting XP/item.','HIGH',{requirements:{skills:[{skill:'Crafting',level:18}],gear:['Needle','Thread']}}),
 p('f2p-hardleather-body','Craft Hardleather body','Crafting','Crafting',28,['Hard leather','Hardleather body'],'35 Crafting XP/item.','HIGH',{requirements:{skills:[{skill:'Crafting',level:28}],gear:['Needle','Thread']}}),
]
