import type { V4Activity } from '../types'
const v='VERIFIED' as const,d='2026-10-04',src='OSRS Runecraft rune table; standard F2P altars'
const r=(id:string,name:string,lvl:number,xp:number,item:string,area:string):V4Activity=>({id,name,kind:'PROCESSING',category:'Runecraft',skills:['Runecraft'],f2p:true,members:true,verified:v,source:src,lastVerified:d,requirements:{skills:[{skill:'Runecraft',level:lvl}],areas:[area]},attention:'MEDIUM',riskType:'SAFE',tags:['runecraft','rune essence',item.toLowerCase(),'f2p'],items:['Rune essence',item],notes:`${xp} Runecraft XP per essence before multiple-rune output. Multiple-rune thresholds must be applied from current Runecraft level.`})
export const f2pRunecraftActivities:V4Activity[]=[
 r('f2p-rc-air','Craft Air runes',1,5,'Air rune','Air Altar'),
 r('f2p-rc-mind','Craft Mind runes',2,5.5,'Mind rune','Mind Altar'),
 r('f2p-rc-water','Craft Water runes',5,6,'Water rune','Water Altar'),
 r('f2p-rc-earth','Craft Earth runes',9,6.5,'Earth rune','Earth Altar'),
 r('f2p-rc-fire','Craft Fire runes',14,7,'Fire rune','Fire Altar'),
 r('f2p-rc-body','Craft Body runes',20,7.5,'Body rune','Body Altar'),
]
