import type { V4Activity } from '../types'
const d='2026-10-04', src='OSRS stable skill/quest requirements; Foundation 5 curated P2P gathering dataset'
const a=(id:string,name:string,lvl:number,item:string,attention:V4Activity['attention'],extra:Partial<V4Activity>={}):V4Activity=>({id,name,kind:'GATHERING',category:'Fishing',skills:['Fishing'],f2p:false,members:true,verified:'VERIFIED',source:src,lastVerified:d,requirements:{skills:[{skill:'Fishing',level:lvl}]},attention,riskType:'SAFE',competitionRisk:'LOW',tags:['fishing','p2p',item.toLowerCase()],items:[item],...extra})
export const p2pFishingActivities:V4Activity[]=[
 a('p2p-fish-monkfish','Fish Monkfish',62,'Raw monkfish','LOW',{requirements:{skills:[{skill:'Fishing',level:62}],quests:['Swan Song'],areas:['Piscatoris Fishing Colony']},afkWindowSeconds:45}),
 a('p2p-fish-karambwan','Fish Raw karambwan',65,'Raw karambwan','AFK',{requirements:{skills:[{skill:'Fishing',level:65}],quests:['Tai Bwo Wannai Trio'],gear:['Karambwan vessel','Raw karambwanji']},afkWindowSeconds:120}),
 a('p2p-fish-shark','Harpoon Shark',76,'Raw shark','LOW',{requirements:{skills:[{skill:'Fishing',level:76}],gear:['Harpoon']},afkWindowSeconds:45}),
 a('p2p-fish-minnows','Fish Minnows',82,'Minnow','MEDIUM',{requirements:{skills:[{skill:'Fishing',level:82}],areas:['Fishing Guild minnow platform'],gear:['Small fishing net','Angler outfit']},notes:'Minnows are exchanged for raw sharks; movement of spots raises attention.'}),
 a('p2p-fish-anglerfish','Fish Anglerfish',82,'Raw anglerfish','LOW',{requirements:{skills:[{skill:'Fishing',level:82}],areas:['Port Piscarilius'],gear:['Fishing rod','Sandworms']},afkWindowSeconds:45}),
]
