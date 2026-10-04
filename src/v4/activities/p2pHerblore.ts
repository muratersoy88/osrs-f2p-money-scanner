import type { V4Activity } from '../types'
const d='2026-10-04',src='OSRS Herblore herb-cleaning level table'
const clean=(id:string,name:string,lvl:number,grimy:string,cleanHerb:string):V4Activity=>({id,name,kind:'PROCESSING',category:'Herblore',skills:['Herblore'],f2p:false,members:true,verified:'VERIFIED',source:src,lastVerified:d,requirements:{skills:[{skill:'Herblore',level:lvl}],quests:['Druidic Ritual']},attention:'HIGH',riskType:'SAFE',tags:['members','herblore','clean herb',grimy.toLowerCase(),cleanHerb.toLowerCase()],items:[grimy,cleanHerb],notes:'Herb cleaning. Margin must use live buy/sell prices; Druidic Ritual unlock is required.'})
export const p2pHerbloreActivities:V4Activity[]=[
 clean('p2p-clean-guam','Clean Guam leaf',3,'Grimy guam leaf','Guam leaf'),clean('p2p-clean-marrentill','Clean Marrentill',5,'Grimy marrentill','Marrentill'),
 clean('p2p-clean-tarromin','Clean Tarromin',11,'Grimy tarromin','Tarromin'),clean('p2p-clean-harralander','Clean Harralander',20,'Grimy harralander','Harralander'),
 clean('p2p-clean-ranarr','Clean Ranarr weed',25,'Grimy ranarr weed','Ranarr weed'),clean('p2p-clean-toadflax','Clean Toadflax',30,'Grimy toadflax','Toadflax'),
 clean('p2p-clean-irit','Clean Irit leaf',40,'Grimy irit leaf','Irit leaf'),clean('p2p-clean-avantoe','Clean Avantoe',48,'Grimy avantoe','Avantoe'),
 clean('p2p-clean-kwuarm','Clean Kwuarm',54,'Grimy kwuarm','Kwuarm'),clean('p2p-clean-snapdragon','Clean Snapdragon',59,'Grimy snapdragon','Snapdragon'),
 clean('p2p-clean-cadantine','Clean Cadantine',65,'Grimy cadantine','Cadantine'),clean('p2p-clean-lantadyme','Clean Lantadyme',67,'Grimy lantadyme','Lantadyme'),
 clean('p2p-clean-dwarfweed','Clean Dwarf weed',70,'Grimy dwarf weed','Dwarf weed'),clean('p2p-clean-torstol','Clean Torstol',75,'Grimy torstol','Torstol'),
]
