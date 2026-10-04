import type { V4Activity } from '../types'
const d='2026-10-04', src='OSRS stable Woodcutting requirements; Foundation 5 curated P2P gathering dataset'
const a=(id:string,name:string,lvl:number,item:string,attention:V4Activity['attention'],extra:Partial<V4Activity>={}):V4Activity=>({id,name,kind:'GATHERING',category:'Woodcutting',skills:['Woodcutting'],f2p:false,members:true,verified:'VERIFIED',source:src,lastVerified:d,requirements:{skills:[{skill:'Woodcutting',level:lvl}]},attention,riskType:'SAFE',competitionRisk:'LOW',tags:['woodcutting','p2p',item.toLowerCase()],items:[item],...extra})
export const p2pWoodcuttingActivities:V4Activity[]=[
 a('p2p-wc-teak','Chop Teak logs',35,'Teak logs','MEDIUM',{afkWindowSeconds:25}),
 a('p2p-wc-maple','Chop Maple logs',45,'Maple logs','LOW',{afkWindowSeconds:45}),
 a('p2p-wc-mahogany','Chop Mahogany logs',50,'Mahogany logs','LOW',{afkWindowSeconds:35}),
 a('p2p-wc-magic','Chop Magic logs',75,'Magic logs','AFK',{afkWindowSeconds:75}),
 a('p2p-wc-redwood','Chop Redwood logs',90,'Redwood logs','AFK',{requirements:{skills:[{skill:'Woodcutting',level:90}],areas:['Woodcutting Guild']},afkWindowSeconds:180}),
]
