import type { V4Activity } from '../types'
const d='2026-10-04',src='OSRS Fletching bow level tables'
const bow=(id:string,name:string,lvl:number,log:string,out:string):V4Activity=>({id,name,kind:'PROCESSING',category:'Fletching',skills:['Fletching'],f2p:false,members:true,verified:'VERIFIED',source:src,lastVerified:d,requirements:{skills:[{skill:'Fletching',level:lvl}],gear:['Knife']},attention:'MEDIUM',afkWindowSeconds:45,riskType:'SAFE',tags:['members','fletching','bow',log.toLowerCase(),out.toLowerCase()],items:[log,out],notes:'Unstrung bow production; live GE prices determine current profit.'})
const stringBow=(id:string,name:string,lvl:number,u:string,out:string):V4Activity=>({id,name,kind:'PROCESSING',category:'Fletching',skills:['Fletching'],f2p:false,members:true,verified:'VERIFIED',source:src,lastVerified:d,requirements:{skills:[{skill:'Fletching',level:lvl}]},attention:'MEDIUM',afkWindowSeconds:40,riskType:'SAFE',tags:['members','fletching','stringing','bow'],items:[u,'Bow string',out],notes:'Stringing bows; compare live unstrung + bow-string cost against finished bow.'})
export const p2pFletchingActivities:V4Activity[]=[
 bow('p2p-fletch-oak-short','Fletch Oak shortbow (u)',20,'Oak logs','Oak shortbow (u)'),bow('p2p-fletch-oak-long','Fletch Oak longbow (u)',25,'Oak logs','Oak longbow (u)'),
 bow('p2p-fletch-willow-short','Fletch Willow shortbow (u)',35,'Willow logs','Willow shortbow (u)'),bow('p2p-fletch-willow-long','Fletch Willow longbow (u)',40,'Willow logs','Willow longbow (u)'),
 bow('p2p-fletch-maple-short','Fletch Maple shortbow (u)',50,'Maple logs','Maple shortbow (u)'),bow('p2p-fletch-maple-long','Fletch Maple longbow (u)',55,'Maple logs','Maple longbow (u)'),
 bow('p2p-fletch-yew-short','Fletch Yew shortbow (u)',65,'Yew logs','Yew shortbow (u)'),bow('p2p-fletch-yew-long','Fletch Yew longbow (u)',70,'Yew logs','Yew longbow (u)'),
 bow('p2p-fletch-magic-short','Fletch Magic shortbow (u)',80,'Magic logs','Magic shortbow (u)'),bow('p2p-fletch-magic-long','Fletch Magic longbow (u)',85,'Magic logs','Magic longbow (u)'),
 stringBow('p2p-string-yew-long','String Yew longbow',70,'Yew longbow (u)','Yew longbow'),stringBow('p2p-string-magic-long','String Magic longbow',85,'Magic longbow (u)','Magic longbow'),
]
