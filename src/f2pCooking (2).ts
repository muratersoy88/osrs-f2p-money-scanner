import type { V4Activity } from '../types'
const v='VERIFIED' as const,d='2026-10-04',src='OSRS F2P Cooking tables / cookable food verification'
const c=(id:string,name:string,lvl:number,xp:number,raw:string,cooked:string,attention:V4Activity['attention']='LOW'):V4Activity=>({id,name,kind:'PROCESSING',category:'Cooking',skills:['Cooking'],f2p:true,members:true,verified:v,source:src,lastVerified:d,requirements:{skills:[{skill:'Cooking',level:lvl}]},attention,afkWindowSeconds:60,riskType:'SAFE',tags:['cooking','cook','raw',raw.toLowerCase(),cooked.toLowerCase(),'f2p'],items:[raw,cooked,`Burnt ${cooked.replace(/^Cooked /i,'').toLowerCase()}`],notes:`${xp} Cooking XP per successful cook. Economic calculation must use level-based success/burn rate; burnt output is not assumed to have GE value.`})
export const f2pCookingActivities:V4Activity[]=[
 c('f2p-cook-shrimp','Cook Shrimps',1,30,'Raw shrimps','Shrimps'),
 c('f2p-cook-anchovies','Cook Anchovies',1,30,'Raw anchovies','Anchovies'),
 c('f2p-cook-sardine','Cook Sardine',1,40,'Raw sardine','Sardine'),
 c('f2p-cook-herring','Cook Herring',5,50,'Raw herring','Herring'),
 c('f2p-cook-trout','Cook Trout',15,70,'Raw trout','Trout'),
 c('f2p-cook-pike','Cook Pike',20,80,'Raw pike','Pike'),
 c('f2p-cook-salmon','Cook Salmon',25,90,'Raw salmon','Salmon'),
 c('f2p-cook-tuna','Cook Tuna',30,100,'Raw tuna','Tuna'),
 c('f2p-cook-lobster','Cook Lobster',40,120,'Raw lobster','Lobster'),
 c('f2p-cook-swordfish','Cook Swordfish',45,140,'Raw swordfish','Swordfish'),
 {id:'f2p-make-wine',name:'Make Jug of wine',kind:'PROCESSING',category:'Cooking',skills:['Cooking'],f2p:true,members:true,verified:v,source:src,lastVerified:d,requirements:{skills:[{skill:'Cooking',level:35}]},attention:'LOW',afkWindowSeconds:12,riskType:'SAFE',tags:['cooking','wine','grapes','jug of water','f2p'],items:['Grapes','Jug of water','Jug of wine'],notes:'200 Cooking XP on successful fermentation; fermentation failure must be represented when economic modelling is enabled.'},
]
