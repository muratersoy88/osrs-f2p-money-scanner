export type V5PageId =
  'melee'|'ranged'|'magic'|'agility'|'mining'|'smithing'|'herblore'|'fishing'|'thieving'|'cooking'|'prayer'|'crafting'|'firemaking'|'fletching'|'woodcutting'|'runecraft'|'slayer'|'farming'|'construction'|'hunter'|'sailing'
export type V5Kind='GATHERING'|'PROCESSING'|'COMBAT'|'TRAINING'|'RECURRING'|'UTILITY'
export type V5Activity={
 id:string; name:string; pages:V5PageId[]; skills:string[]; level:number; member:boolean; kind:V5Kind;
 theoryRate:number; theoryGpHour:number; xpHour:number; attention:'HIGH'|'MEDIUM'|'LOW'|'AFK';
 input?:string; output?:string; requirement?:string; note?:string
}
export type V5Edit={theoryRate?:number;theoryGpHour?:number;measuredRate?:number;measuredGpHour?:number;note?:string}
export type V5Page={id:V5PageId;label:string;skills:string[]}


export const V5_PAGES:V5Page[]=[
{id:'melee',label:'Melee Fight',skills:['Attack','Strength','Defence','Hitpoints']},
{id:'ranged',label:'Ranged Fight',skills:['Ranged','Defence','Hitpoints']},
{id:'magic',label:'Magic',skills:['Magic','Defence','Hitpoints']},
{id:'agility',label:'Agility',skills:['Agility']},{id:'mining',label:'Mining',skills:['Mining']},
{id:'smithing',label:'Smithing',skills:['Smithing']},{id:'herblore',label:'Herblore',skills:['Herblore']},
{id:'fishing',label:'Fishing',skills:['Fishing']},{id:'thieving',label:'Thieving',skills:['Thieving']},
{id:'cooking',label:'Cooking',skills:['Cooking']},{id:'prayer',label:'Prayer',skills:['Prayer']},
{id:'crafting',label:'Crafting',skills:['Crafting']},{id:'firemaking',label:'Firemaking',skills:['Firemaking']},
{id:'fletching',label:'Fletching',skills:['Fletching']},{id:'woodcutting',label:'Woodcutting',skills:['Woodcutting']},
{id:'runecraft',label:'Runecraft',skills:['Runecraft']},{id:'slayer',label:'Slayer',skills:['Slayer']},
{id:'farming',label:'Farming',skills:['Farming']},{id:'construction',label:'Construction',skills:['Construction']},
{id:'hunter',label:'Hunter',skills:['Hunter']},{id:'sailing',label:'Sailing',skills:['Sailing']},
]


const out:V5Activity[]=[]
let seq=0
const add=(page:V5PageId,name:string,skill:string,level:number,member:boolean,kind:V5Kind,rate:number,gp:number,xp:number,attention:V5Activity['attention']='MEDIUM',extra:Partial<V5Activity>={})=>{
 out.push({id:`v5-${page}-${++seq}`,name,pages:[page],skills:[skill],level,member,kind,theoryRate:rate,theoryGpHour:gp,xpHour:xp,attention,...extra})
}
const tierGp=(level:number,base=18000)=>Math.round(base+level*level*55)
const tierXp=(level:number,base=8000)=>Math.round(base+level*900)

// Mining / gathering
;[['Clay',1],['Copper ore',1],['Tin ore',1],['Iron ore',15],['Silver ore',20],['Coal',30],['Gold ore',40],['Mithril ore',55],['Adamantite ore',70],['Runite ore',85],['Pure essence',30],['Sandstone',35],['Granite',45],['Gem rocks',40],['Volcanic ash',22],['Amethyst',92],['Calcified rocks',41],['Motherlode Mine',30],['Blast mine',43],['Volcanic Mine',50]].forEach(([n,l])=>add('mining',`Mine ${n}`,'Mining',+l,+l>1,'GATHERING',Math.max(60,1400-+l*9),tierGp(+l,22000),tierXp(+l),+l>70?'LOW':'MEDIUM'))

// Woodcutting + firemaking
;[['Logs',1],['Oak logs',15],['Willow logs',30],['Teak logs',35],['Maple logs',45],['Mahogany logs',50],['Yew logs',60],['Magic logs',75],['Redwood logs',90],['Arctic pine logs',42],['Sulliuscep',65],['Blisterwood',62]].forEach(([n,l])=>{
 add('woodcutting',`Cut ${n}`,'Woodcutting',+l,+l>30,'GATHERING',Math.max(70,1100-+l*7),tierGp(+l,16000),tierXp(+l),+l>=60?'LOW':'MEDIUM')
 add('firemaking',`Burn ${n}`,'Firemaking',Math.max(1,+l),+l>30,'TRAINING',1100,-Math.round(tierGp(+l,5000)*.35),tierXp(+l,16000),'HIGH',{input:String(n)})
})

// Fishing + cooking fish
;[['Shrimp',1],['Sardine',5],['Herring',10],['Anchovies',15],['Trout',20],['Pike',25],['Salmon',30],['Tuna',35],['Lobster',40],['Swordfish',50],['Monkfish',62],['Karambwan',65],['Shark',76],['Sea turtle',79],['Manta ray',81],['Anglerfish',82],['Dark crab',85],['Minnow',82],['Sacred eel',87],['Infernal eel',80]].forEach(([n,l])=>{
 const mem=+l>50
 add('fishing',`Fish ${n}`,'Fishing',+l,mem,'GATHERING',Math.max(80,900-+l*6),tierGp(+l,18000),tierXp(+l),+l>=62?'LOW':'MEDIUM')
 add('cooking',`Cook ${n}`,'Cooking',Math.max(1,+l-5),mem,'PROCESSING',1000,tierGp(+l,9000),tierXp(+l,22000),'LOW',{input:`Raw ${n}`,output:String(n)})
})

// Smithing generated equipment
const metals:[string,number,boolean][]=[['Bronze',1,false],['Iron',15,false],['Steel',30,false],['Mithril',50,false],['Adamant',70,false],['Rune',85,false]]
const forms:[string,number][]=[['dagger',0],['axe',0],['mace',2],['med helm',3],['sword',4],['dart tips',4],['nails',4],['scimitar',5],['arrowtips',5],['limbs',6],['longsword',6],['full helm',7],['throwing knives',7],['sq shield',8],['warhammer',9],['battleaxe',10],['chainbody',11],['kiteshield',12],['claws',13],['2h sword',14],['plateskirt',14],['platelegs',16],['platebody',18]]
metals.forEach(([m,b,mem])=>forms.forEach(([f,o])=>add('smithing',`Smith ${m} ${f}`,'Smithing',Math.min(99,b+o),mem,'PROCESSING',850,tierGp(Math.min(99,b+o),12000),tierXp(Math.min(99,b+o),18000),'HIGH',{input:`${m} bar`,output:`${m} ${f}`})))
;[['Bronze bar',1,false],['Iron bar',15,false],['Silver bar',20,false],['Steel bar',30,false],['Gold bar',40,false],['Mithril bar',50,false],['Adamantite bar',70,false],['Runite bar',85,false]].forEach(([n,l,m])=>add('smithing',`Smelt ${n}`,'Smithing',+l,!!m,'PROCESSING',900,tierGp(+l,14000),tierXp(+l,13000),'LOW'))

// Crafting jewellery + gems + hides/glass
const gems:[string,number,boolean][]=[['Sapphire',20,false],['Emerald',27,false],['Ruby',34,false],['Diamond',43,false],['Dragonstone',55,true],['Onyx',67,true],['Zenyte',89,true]]
gems.forEach(([g,l,mem])=>{
 add('crafting',`Cut ${g}`,'Crafting',l,mem,'PROCESSING',2200,tierGp(l,17000),tierXp(l,24000),'HIGH',{input:`Uncut ${g}`,output:g})
 ;([['ring',0],['necklace',2],['bracelet',3],['amulet (u)',4]] as [string,number][]).forEach(([f,o])=>add('crafting',`Make ${g} ${f}`,'Crafting',Math.min(99,l+o),mem||f==='bracelet','PROCESSING',1100,tierGp(l+o,19000),tierXp(l+o,20000),'LOW',{input:`Gold bar + ${g}`,output:`${g} ${f}`}))
})
;[['Leather',1,false],['Hard leather',28,false],['Green d\'hide',57,true],['Blue d\'hide',66,true],['Red d\'hide',73,true],['Black d\'hide',79,true]].forEach(([n,l,m])=>['body','chaps','vambraces'].forEach((f,i)=>add('crafting',`${n} ${f}`,'Crafting',Math.min(99,+l+i*2),!!m,'PROCESSING',700,tierGp(+l+i*2,16000),tierXp(+l+i*2,21000),'MEDIUM')))
;[['Molten glass',1],['Beer glass',1],['Candle lantern',4],['Oil lamp',12],['Vial',33],['Fishbowl',42],['Unpowered orb',46],['Lantern lens',49],['Light orb',87]].forEach(([n,l])=>add('crafting',`Glassblow ${n}`,'Crafting',+l,+l>1,'PROCESSING',1500,tierGp(+l,11000),tierXp(+l,18000),'HIGH'))

// Herblore broad potion catalogue
;[['Attack potion',3],['Antipoison',5],['Strength potion',12],['Restore potion',22],['Energy potion',26],['Defence potion',30],['Agility potion',34],['Combat potion',36],['Prayer potion',38],['Super attack',45],['Superantipoison',48],['Fishing potion',50],['Super energy',52],['Super strength',55],['Weapon poison',60],['Super restore',63],['Super defence',66],['Antifire potion',69],['Ranging potion',72],['Magic potion',76],['Stamina potion',77],['Zamorak brew',78],['Antidote+',68],['Saradomin brew',81],['Extended antifire',84],['Anti-venom',87],['Super combat potion',90],['Anti-venom+',94],['Divine super combat',97],['Divine ranging',74],['Divine magic',78]].forEach(([n,l])=>add('herblore',`Make ${n}`,'Herblore',+l,true,'PROCESSING',1700,tierGp(+l,26000),tierXp(+l,30000),'HIGH',{requirement:'Druidic Ritual'}))

// Fletching
const logs:[string,number][]=[['Logs',1],['Oak',15],['Willow',30],['Maple',45],['Yew',60],['Magic',75],['Redwood',90]]
logs.forEach(([n,l])=>{add('fletching',`Fletch ${n} shortbow (u)`,'Fletching',+l,true,'PROCESSING',1600,tierGp(+l,13000),tierXp(+l,21000),'HIGH');add('fletching',`Fletch ${n} longbow (u)`,'Fletching',Math.min(99,+l+5),true,'PROCESSING',1500,tierGp(+l+5,15000),tierXp(+l+5,23000),'HIGH');add('fletching',`String ${n} longbow`,'Fletching',Math.min(99,+l+5),true,'PROCESSING',1900,tierGp(+l+5,18000),tierXp(+l+5,18000),'HIGH')})
;[['Bronze',1],['Iron',15],['Steel',30],['Mithril',45],['Adamant',60],['Rune',75],['Amethyst',82],['Dragon',90]].forEach(([n,l])=>['arrows','darts','bolts'].forEach(f=>add('fletching',`Make ${n} ${f}`,'Fletching',+l,true,'PROCESSING',3000,tierGp(+l,17000),tierXp(+l,25000),'HIGH')))

// Runecraft
;[['Air rune',1,false],['Mind rune',2,false],['Water rune',5,false],['Earth rune',9,false],['Fire rune',14,false],['Body rune',20,false],['Cosmic rune',27,true],['Chaos rune',35,true],['Astral rune',40,true],['Nature rune',44,true],['Law rune',54,true],['Death rune',65,true],['Blood rune',77,true],['Soul rune',90,true],['Wrath rune',95,true]].forEach(([n,l,m])=>add('runecraft',`Craft ${n}`,'Runecraft',+l,!!m,'PROCESSING',Math.max(500,1800-+l*7),tierGp(+l,23000),tierXp(+l,19000),'MEDIUM'))

// Farming crops / runs
;[['Potato',1],['Onion',5],['Cabbage',7],['Tomato',12],['Sweetcorn',20],['Strawberry',31],['Watermelon',47],['Guam',9],['Marrentill',14],['Tarromin',19],['Harralander',26],['Ranarr',32],['Toadflax',38],['Irit',44],['Avantoe',50],['Kwuarm',56],['Snapdragon',62],['Cadantine',67],['Lantadyme',73],['Dwarf weed',79],['Torstol',85],['Oak tree',15],['Willow tree',30],['Maple tree',45],['Yew tree',60],['Magic tree',75],['Palm tree',68],['Dragonfruit tree',81],['Cactus',55],['Potato cactus',64],['Seaweed',23],['Giant seaweed',23],['Mushroom',53],['Belladonna',63],['Celastrus',85],['Redwood tree',90]].forEach(([n,l])=>add('farming',`${n} run`,'Farming',+l,true,'RECURRING',1,tierGp(+l,30000),tierXp(+l,15000),'LOW',{note:'Theory GP/h is an editable planning placeholder; recurring profit/run should be measured.'}))

// Hunter
;[['Polar kebbit',1],['Crimson swift',1],['Common kebbit',3],['Golden warbler',5],['Feldip weasel',7],['Copper longtail',9],['Cerulean twitch',11],['Ruby harvest',15],['Tropical wagtail',19],['Wild kebbit',23],['Sapphire glacialis',25],['Ferret',27],['Swamp lizard',29],['Spined larupia',31],['Barb-tailed kebbit',33],['Snowy knight',35],['Prickly kebbit',37],['Horned graahk',41],['Spotted kebbit',43],['Black warlock',45],['Orange salamander',47],['Razor-backed kebbit',49],['Sabre-toothed kebbit',51],['Chinchompa',53],['Grey chinchompa',53],['Red salamander',59],['Red chinchompa',63],['Black salamander',67],['Dashing kebbit',69],['Black chinchompa',73],['Herbiboar',80]].forEach(([n,l])=>add('hunter',`Hunt ${n}`,'Hunter',+l,true,'GATHERING',Math.max(60,500-+l*3),tierGp(+l,26000),tierXp(+l,24000),'MEDIUM'))

// Thieving
;[['Man/Woman',1],['Farmer',10],['Warrior',25],['Rogue',32],['Master Farmer',38],['Guard',40],['Knight of Ardougne',55],['Paladin',70],['Gnome',75],['Hero',80],['Vyres',82],['Elves',85],['TzHaar-Hur',90]].forEach(([n,l])=>add('thieving',`Pickpocket ${n}`,'Thieving',+l,true,'GATHERING',Math.max(80,1200-+l*7),tierGp(+l,28000),tierXp(+l,30000),'HIGH'))
;[['Baker stall',5],['Silk stall',20],['Fur stall',35],['Silver stall',50],['Spice stall',65],['Gem stall',75]].forEach(([n,l])=>add('thieving',`Steal from ${n}`,'Thieving',+l,true,'GATHERING',600,tierGp(+l,20000),tierXp(+l,22000),'MEDIUM'))

// Slayer monsters
;[['Crawling hand',5],['Cave bug',7],['Cave crawler',10],['Banshee',15],['Rockslug',20],['Cockatrice',25],['Pyrefiend',30],['Mogre',32],['Harpie bug swarm',33],['Wall beast',35],['Killerwatt',37],['Molanisk',39],['Basilisk',40],['Terror dog',40],['Fever spider',42],['Infernal mage',45],['Brine rat',47],['Bloodveld',50],['Jelly',52],['Turoth',55],['Cave horror',58],['Aberrant spectre',60],['Dust devil',65],['Kurask',70],['Skeletal wyvern',72],['Gargoyle',75],['Brutal black dragon',77],['Nechryael',80],['Abyssal demon',85],['Cave kraken',87],['Dark beast',90],['Smoke devil',93],['Alchemical Hydra',95]].forEach(([n,l])=>add('slayer',`Slay ${n}`,'Slayer',+l,true,'COMBAT',Math.max(20,180-+l),tierGp(+l,42000),tierXp(+l,26000),'MEDIUM'))

// Prayer
;[['Bones',1,false],['Big bones',1,false],['Babydragon bones',1,true],['Dragon bones',1,true],['Wyvern bones',1,true],['Dagannoth bones',1,true],['Superior dragon bones',70,true],['Ensouled heads',16,true],['Demonic ashes',1,true],['Infernal ashes',1,true]].forEach(([n,l,m])=>add('prayer',`Train with ${n}`,'Prayer',+l,!!m,'TRAINING',900,-tierGp(+l,22000),tierXp(+l,35000),'HIGH',{input:String(n)}))

// Agility
;[['Gnome Stronghold course',1],['Draynor rooftop',10],['Al Kharid rooftop',20],['Varrock rooftop',30],['Canifis rooftop',40],['Falador rooftop',50],['Seers rooftop',60],['Pollnivneach rooftop',70],['Rellekka rooftop',80],['Ardougne rooftop',90],['Hallowed Sepulchre',52],['Agility Pyramid',30],['Brimhaven Arena',40]].forEach(([n,l])=>add('agility',String(n),'Agility',+l,true,'TRAINING',Math.max(20,80-+l/2),tierGp(+l,12000),tierXp(+l,30000),'HIGH'))

// Construction broad room/furniture families
;[['Crude wooden chair',1],['Wooden bookcase',4],['Wooden larder',9],['Oak chair',19],['Oak larder',33],['Teak table',38],['Mahogany table',52],['Teak bench',66],['Mahogany bench',77],['Gilded altar',75],['Portal chamber',50],['Superior garden',65],['Achievement gallery',80],['Ornate rejuvenation pool',90],['Occult altar',90],['Ornate jewellery box',91]].forEach(([n,l])=>add('construction',`Build ${n}`,'Construction',+l,true,'TRAINING',500,-tierGp(+l,35000),tierXp(+l,45000),'HIGH'))

// Magic economic + combat families
;[['Low Level Alchemy',21,false],['Telekinetic Grab',33,false],['Superheat Item',43,false],['High Level Alchemy',55,false],['Enchant sapphire jewellery',7,false],['Enchant emerald jewellery',27,false],['Enchant ruby jewellery',49,false],['Enchant diamond jewellery',57,false],['Enchant dragonstone jewellery',68,true],['Enchant onyx jewellery',87,true],['Enchant zenyte jewellery',93,true],['Tan Leather',78,true],['Plank Make',86,true],['String Jewellery',80,true],['Spin Flax',76,true],['Humidify',68,true],['Superglass Make',77,true]].forEach(([n,l,m])=>add('magic',String(n),'Magic',+l,!!m,'PROCESSING',1200,tierGp(+l,26000),tierXp(+l,28000),'HIGH'))
;[['Hill giant',20,false],['Moss giant',30,false],['Ogress warrior',45,false],['Blue dragon',55,true],['Green dragon',55,true],['Black dragon',70,true],['Demonic gorilla',75,true],['Vorkath',80,true],['Zulrah',75,true],['Phantom Muspah',80,true],['General Graardor',80,true],['Kree’arra',85,true],['K’ril Tsutsaroth',80,true],['Commander Zilyana',80,true]].forEach(([n,l,m])=>{add('melee',`Fight ${n}`,'Attack',+l,!!m,'COMBAT',Math.max(15,160-+l),tierGp(+l,50000),tierXp(+l,30000),'MEDIUM');add('ranged',`Ranged ${n}`,'Ranged',+l,!!m,'COMBAT',Math.max(15,160-+l),tierGp(+l,52000),tierXp(+l,30000),'MEDIUM');add('magic',`Magic ${n}`,'Magic',+l,!!m,'COMBAT',Math.max(15,160-+l),tierGp(+l,48000),tierXp(+l,30000),'MEDIUM')})

// Sailing: deliberately broad editable activity catalogue; live theory should be calibrated as current game data evolves.
;[['Salvage basic wrecks',1],['Deliver coastal cargo',5],['Fish from vessel',10],['Salvage intermediate wrecks',20],['Courier contracts',25],['Resource dredging',30],['Island resource runs',35],['Merchant cargo routes',40],['Advanced salvage',50],['Deep-sea fishing route',55],['High-value cargo contracts',60],['Remote island gathering',65],['Advanced merchant routes',70],['Deep-sea salvage',75],['Elite cargo contracts',80],['Endgame salvage route',90]].forEach(([n,l])=>add('sailing',String(n),'Sailing',+l,true,+l%2?'GATHERING':'RECURRING',Math.max(10,80-+l/2),tierGp(+l,30000),tierXp(+l,25000),'MEDIUM',{note:'Editable theory placeholder; replace with measured data when tested.'}))

export const V5_CATALOGUE=out
