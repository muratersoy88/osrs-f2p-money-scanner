import type { V4Activity } from '../types'
const d='2026-10-04', src='OSRS stable skill requirements; Foundation 5 curated P2P gathering dataset'
const a=(id:string,name:string,lvl:number,item:string,attention:V4Activity['attention'],risk:V4Activity['riskType']='SAFE',competition:'LOW'|'MEDIUM'|'HIGH'='MEDIUM',extra:Partial<V4Activity>={}):V4Activity=>({id,name,kind:'GATHERING',category:'Mining',skills:['Mining'],f2p:false,members:true,verified:'VERIFIED',source:src,lastVerified:d,requirements:{skills:[{skill:'Mining',level:lvl}]},attention,riskType:risk,competitionRisk:competition,tags:['mining','p2p',item.toLowerCase()],items:[item],...extra})
export const p2pMiningActivities:V4Activity[]=[
 a('p2p-mine-pure-essence','Mine Pure essence',30,'Pure essence','LOW','SAFE','LOW',{requirements:{skills:[{skill:'Mining',level:30}],quests:['Rune Mysteries'],areas:['Rune essence mine']}}),
 a('p2p-motherlode','Motherlode Mine',30,'Pay-dirt','LOW','SAFE','LOW',{requirements:{skills:[{skill:'Mining',level:30}],areas:['Motherlode Mine']},afkWindowSeconds:30,notes:'Ore mix scales with Mining level. Economic value should be calculated from actual output distribution.'}),
 a('p2p-gem-rocks','Mine Gem rocks',40,'Uncut gems','MEDIUM','SAFE','MEDIUM',{requirements:{skills:[{skill:'Mining',level:40}],quests:['Shilo Village'],areas:['Shilo Village gem rocks']},items:['Uncut sapphire','Uncut emerald','Uncut ruby','Uncut diamond'],notes:'Mixed-output gem activity; use measured/default distribution rather than one fixed gem.'}),
 a('p2p-amethyst','Mine Amethyst',92,'Amethyst','AFK','SAFE','LOW',{requirements:{skills:[{skill:'Mining',level:92}],areas:['Mining Guild']},afkWindowSeconds:60}),
]
