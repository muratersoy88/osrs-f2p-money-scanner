import type { V4Activity } from '../types'
const d='2026-10-04',src='OSRS Cooking fish requirement tables'
const cook=(id:string,name:string,lvl:number,raw:string,out:string,xp:number,quest?:string):V4Activity=>({id,name,kind:'PROCESSING',category:'Cooking',skills:['Cooking'],f2p:false,members:true,verified:'VERIFIED',source:src,lastVerified:d,requirements:{skills:[{skill:'Cooking',level:lvl}],...(quest?{quests:[quest]}:{})},attention:'LOW',afkWindowSeconds:65,riskType:'SAFE',tags:['members','cooking','fish',raw.toLowerCase(),out.toLowerCase()],items:[raw,out],notes:`${xp} Cooking XP on successful cook. Burn chance must be handled by the existing level/measurement cooking engine.`})
export const p2pCookingActivities:V4Activity[]=[
 cook('p2p-cook-karambwan','Cook Raw karambwan',30,'Raw karambwan','Cooked karambwan',190,'Tai Bwo Wannai Trio'),
 cook('p2p-cook-monkfish','Cook Raw monkfish',62,'Raw monkfish','Monkfish',150,'Swan Song'),
 cook('p2p-cook-shark','Cook Raw shark',80,'Raw shark','Shark',210),
 cook('p2p-cook-seaturtle','Cook Raw sea turtle',82,'Raw sea turtle','Sea turtle',211.3),
 cook('p2p-cook-anglerfish','Cook Raw anglerfish',84,'Raw anglerfish','Anglerfish',230),
 cook('p2p-cook-darkcrab','Cook Raw dark crab',90,'Raw dark crab','Dark crab',215),
]
