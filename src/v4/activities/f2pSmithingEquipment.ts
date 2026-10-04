import type { V4Activity } from '../types'
const v='VERIFIED' as const,d='2026-10-04',src='OSRS F2P Smithing equipment level tables'
type Tier={key:string;name:string;base:number;bar:string}
const tiers:Tier[]=[{key:'bronze',name:'Bronze',base:1,bar:'Bronze bar'},{key:'iron',name:'Iron',base:15,bar:'Iron bar'},{key:'steel',name:'Steel',base:30,bar:'Steel bar'},{key:'mithril',name:'Mithril',base:50,bar:'Mithril bar'},{key:'adamant',name:'Adamant',base:70,bar:'Adamantite bar'},{key:'rune',name:'Rune',base:85,bar:'Runite bar'}]
const forms=[
 {key:'dagger',name:'dagger',off:0,bars:1},{key:'scimitar',name:'scimitar',off:5,bars:2},{key:'warhammer',name:'warhammer',off:9,bars:3},
 {key:'2h',name:'2h sword',off:14,bars:3},{key:'platelegs',name:'platelegs',off:16,bars:3},{key:'plateskirt',name:'plateskirt',off:16,bars:3},{key:'platebody',name:'platebody',off:18,bars:5},
]
export const f2pSmithingEquipmentActivities:V4Activity[]=tiers.flatMap(t=>forms.filter(f=>t.base+f.off<=99).map(f=>({id:`f2p-smith-${t.key}-${f.key}`,name:`Smith ${t.name} ${f.name}`,kind:'PROCESSING' as const,category:'Smithing Equipment',skills:['Smithing'],f2p:true,members:true,verified:v,source:src,lastVerified:d,requirements:{skills:[{skill:'Smithing',level:t.base+f.off}],gear:['Hammer']},attention:'MEDIUM' as const,riskType:'SAFE' as const,tags:['smithing',t.key,f.key,t.bar.toLowerCase(),'f2p'],items:[t.bar,`${t.name} ${f.name}`],notes:`Uses ${f.bars} ${t.bar}${f.bars>1?'s':''}. Economic comparison must use live bar opportunity cost, not self-gathered cost = 0.`})))
