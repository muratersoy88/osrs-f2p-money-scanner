import type { V4Activity } from '../types'
const v='VERIFIED' as const, d='2026-10-04', src='OSRS Wiki F2P skill guides (verified 2026-10-04)'
const g=(id:string,name:string,cat:string,skill:string,lvl:number,xp:number,item:string,attention:V4Activity['attention'],risk:V4Activity['riskType']='SAFE',competition:'LOW'|'MEDIUM'|'HIGH'='LOW',extra:Partial<V4Activity>={}):V4Activity=>({id,name,kind:'GATHERING',category:cat,skills:[skill],f2p:true,members:true,verified:v,source:src,lastVerified:d,requirements:{skills:[{skill,level:lvl}]},attention,riskType:risk,competitionRisk:competition,tags:[cat.toLowerCase(),skill.toLowerCase(),item.toLowerCase(),'f2p'],items:[item],notes:`Verified F2P. ${xp} XP per successful gather. Live value should come from price API.`,...extra})
export const f2pGatheringActivities:V4Activity[]=[
 g('f2p-mine-clay','Mine Clay','Mining','Mining',1,5,'Clay','MEDIUM'),
 g('f2p-mine-copper','Mine Copper ore','Mining','Mining',1,17.5,'Copper ore','MEDIUM'),
 g('f2p-mine-tin','Mine Tin ore','Mining','Mining',1,17.5,'Tin ore','MEDIUM'),
 g('f2p-mine-iron','Mine Iron ore','Mining','Mining',15,35,'Iron ore','HIGH','SAFE','HIGH'),
 g('f2p-mine-silver','Mine Silver ore','Mining','Mining',20,40,'Silver ore','MEDIUM','SAFE','MEDIUM'),
 g('f2p-mine-coal','Mine Coal','Mining','Mining',30,50,'Coal','MEDIUM','SAFE','MEDIUM'),
 g('f2p-mine-gold','Mine Gold ore','Mining','Mining',40,65,'Gold ore','MEDIUM','SAFE','MEDIUM'),
 g('f2p-mine-mithril','Mine Mithril ore','Mining','Mining',55,80,'Mithril ore','MEDIUM','SAFE','HIGH'),
 g('f2p-mine-adamantite','Mine Adamantite ore','Mining','Mining',70,95,'Adamantite ore','MEDIUM','SAFE','HIGH'),
 g('f2p-mine-runite','Mine Runite ore (Lava Maze)','Mining','Mining',85,125,'Runite ore','HIGH','WILDERNESS','HIGH'),
 g('f2p-fish-shrimp','Net Shrimp','Fishing','Fishing',1,10,'Raw shrimps','LOW'),
 g('f2p-fish-sardine-herring','Bait Sardine / Herring','Fishing','Fishing',10,20,'Raw sardine','LOW','SAFE','LOW',{requirements:{skills:[{skill:'Fishing',level:10}],gear:['Fishing rod','Fishing bait']},items:['Raw sardine','Raw herring'],notes:'Mixed-output F2P spot. Existing measured 1000-fish distribution is retained by V2.5 history.'}),
 g('f2p-fish-trout-salmon','Fly Trout / Salmon','Fishing','Fishing',20,50,'Raw trout','LOW','SAFE','LOW',{requirements:{skills:[{skill:'Fishing',level:20}],gear:['Fly fishing rod','Feathers']},items:['Raw trout','Raw salmon'],notes:'Mixed-output F2P fly fishing; Salmon begins at Fishing 30.'}),
 g('f2p-fish-pike','Bait Pike','Fishing','Fishing',25,60,'Raw pike','LOW','SAFE','LOW',{requirements:{skills:[{skill:'Fishing',level:25}],gear:['Fishing rod','Fishing bait']}}),
 g('f2p-fish-tuna-swordfish','Harpoon Tuna / Swordfish','Fishing','Fishing',35,80,'Raw tuna','LOW','SAFE','LOW',{requirements:{skills:[{skill:'Fishing',level:35}],gear:['Harpoon']},items:['Raw tuna','Raw swordfish'],notes:'Mixed-output F2P harpoon spot; Swordfish begins at Fishing 50.'}),
 g('f2p-fish-lobster','Cage Lobster','Fishing','Fishing',40,90,'Raw lobster','LOW','SAFE','LOW',{requirements:{skills:[{skill:'Fishing',level:40}],gear:['Lobster pot'],areas:['Karamja F2P fishing spot']}}),
 g('f2p-wc-normal','Chop Logs','Woodcutting','Woodcutting',1,25,'Logs','LOW'),
 g('f2p-wc-oak','Chop Oak logs','Woodcutting','Woodcutting',15,37.5,'Oak logs','LOW'),
 g('f2p-wc-willow','Chop Willow logs','Woodcutting','Woodcutting',30,67.5,'Willow logs','LOW','SAFE','MEDIUM'),
 g('f2p-wc-yew','Chop Yew logs','Woodcutting','Woodcutting',60,175,'Yew logs','AFK','SAFE','MEDIUM',{afkWindowSeconds:60}),
]
