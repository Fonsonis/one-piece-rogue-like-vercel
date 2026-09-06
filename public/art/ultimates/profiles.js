/* Art direction only: no combat stats, move replacements or game RNG. */
(() => {
  'use strict';
  const styles = {
    impact:['#ffd398','#e88351'], slash:['#a4efbe','#eefbf1'], flame:['#ff903f','#ffe79f'],
    lightning:['#ffda56','#fff6cf'], ice:['#96eaff','#e6faff'], water:['#42cddf','#d2f9ff'],
    dark:['#9972d9','#e2c4ff'], quake:['#c7ecff','#fbfdff'], wind:['#83ddba','#e9fff2'],
    sand:['#d6ac65','#fff0bf'], smoke:['#bcc7d5','#f5f7fa'], poison:['#bf63db','#e9a1fa'],
    laser:['#6bdbff','#fff6ba'], shot:['#f9c46e','#fff0cc'], rubber:['#f79472','#ffe9c8'],
    room:['#59d9e3','#b9fff8'], string:['#ffd1f0','#ffffff'], paw:['#ffd6e8','#fff7fa'],
    heart:['#ff77ae','#ffdbed'], petals:['#cf8fe2','#ffe0f5'], phoenix:['#48cfee','#fff08a'],
    gravity:['#b881f1','#e7c9ff'], metal:['#aebbc9','#f3ab6d'], mochi:['#f4ddc3','#805958'],
    soul:['#91e8d0','#fff2ac'], ghost:['#e0cafa','#ffffff'], music:['#91e1ff','#ecd5ff'],
    forest:['#83c568','#dfefad'], beast:['#e4b37a','#fff1d6'], dragon:['#ed824e','#ffd989'],
    barrier:['#87eca8','#e4ffe9'], bubble:['#b8f1ef','#ffd8f4'], wax:['#f4e7b5','#fffdf0'],
    ink:['#df85c3','#d6eced'], portal:['#86d9c7','#e2fff8'], bomb:['#ffc061','#fff0cd'],
    meteor:['#cba2fa','#ffce8a'], snow:['#c4eafb','#ffffff'], silk:['#d4abdf','#fff0fc'],
    sun:['#fff0b3','#ffffff'], electricBeast:['#c4ecff','#ffeb97'],
  };
  const overrides = Object.create(null);
  const group=(ids,family,motif,opts={})=>ids.split(' ').forEach(id=>{overrides[id]={family,motif,...opts};});
  // The same material can have different choreography: blade count, silhouette,
  // sweep, projectile, pressure wave and secondary accent are authored here.
  group('luffy','rubber','gatling',{count:7});
  group('luffy2','rubber','jet',{count:10,color:'#ff8a91'});
  group('luffy3','rubber','giant',{count:1});
  group('luffy4','rubber','kong',{count:3,color:'#d96065',accent:'#ffceb5'});
  group('luffy5 joyboy','sun','dawn',{count:5});
  group('zoro','slash','three-swords',{count:3});
  group('zoro2','slash','ashura',{count:9,color:'#ae85e0'});
  group('nami nami2 zeus2 hera','lightning','cloud',{count:5});
  group('usopp','forest','pop-green',{count:5});group('usopp2','shot','fire-star',{color:'#ffad64'});
  group('sanji','flame','kick',{count:3});group('zeff bluegilly bentham dellinger','impact','kick');
  group('chopper','beast','antlers',{count:3});group('robin','petals','hands',{count:8});
  group('franky vegapunk lilith edison pythagoras','laser','radical');
  group('brook','music','soul-sword',{color:'#9bddfb'});group('jinbe','water','karate',{count:4});
  group('buggy','bomb','muggy',{count:5});group('krieg','poison','mh5');
  group('smoker','smoke','white-blow');group('newgate','quake','seaquake',{count:7});
  group('roger shanks rayleigh garling','slash','conqueror',{color:'#e56777',accent:'#fff0d8'});
  group('garp coby2','impact','galaxy',{color:'#ff9ba5',count:6});
  group('teach','dark','black-hole',{count:8});group('kaido','dragon','flame-dragon');
  group('bigmom','soul','homies',{count:3});group('law','room','gamma-knife');
  group('kid','metal','magnetic',{count:12});group('mihawk shawk','slash','black-blade',{count:1,color:'#95f49d'});
  group('crocodile scroc','sand','desert-spada');group('doflamingo sflamingo','string','birdcage',{count:12});
  group('kuma sbear','paw','ursus-shock');group('hancock ssnake','heart','petrify',{count:6});
  group('akainu','flame','magma',{color:'#f75e42',count:5});group('kizaru','laser','magatama',{color:'#ffdc66',count:8});
  group('aokiji','ice','ice-age',{count:9});group('dragon','wind','cyclone',{count:6});
  group('sabo','flame','dragon-claw');group('ace','flame','sun-orb',{count:8});
  group('lucci','beast','rokuogan');group('bonney','sun','distortion');
  group('oden','slash','cross',{count:2,color:'#eca2a7'});group('yamato','ice','thunder-club');
  group('king','dragon','lunarian',{color:'#e4a258'});group('queen','poison','virus',{color:'#94d878'});
  group('katakuri','mochi','donuts',{count:6});group('marco','phoenix','wings',{count:6});
  group('enel','lightning','drums',{count:4});group('sengoku','impact','buddha',{color:'#ffdb78',count:5});
  group('fujitora','gravity','meteor',{count:5});group('ryokugyu','forest','roots',{count:7});
  group('magellan','poison','hydra',{count:3});group('caesar','poison','gas');
  group('monet','snow','harpy');group('perona','ghost','negative',{count:6});
  group('moria sgecko','dark','bats',{count:9});group('ryuma','slash','autumn',{color:'#88cce7'});
  group('galdino','wax','candelabra');group('marianne jora kanjuro','ink','brush',{count:6});
  group('hina','metal','cage',{count:7});group('paulie leo','string','binding',{count:7});
  group('kalifa tsuru','bubble','foam',{count:12});group('blueno','portal','door');
  group('bellamy','rubber','spring');group('bartolomeo','barrier','wall');
  group('jozu','ice','diamond',{color:'#99e1ec'});group('vista','slash','roses',{count:2,color:'#eea7c4'});
  group('inazuma','slash','scissors',{count:2});group('ivankov','impact','wink',{color:'#f49dcf'});
  group('sandersonia marigold orochi','beast','serpent',{count:3});
  group('hody kuroobi gyojin fishertiger koala hack namur','water','karate');
  group('arlong daruma','beast','shark');group('chuu pescador neptune','water','spear');
  group('shirahoshi','water','sea-kings',{count:4});
  group('hachi onigumo hyouzou','slash','many-blades',{count:6});
  group('kuro sham piratagato jabra whoswho','beast','claws',{count:4});
  group('kaku','slash','storm-kick',{count:4});
  group('oars oarsjr sanjuanwolf wadatsumi hajrudin oimo brogy','impact','giant',{count:6});
  group('dorry kashi johngiant','slash','giant',{count:2});
  group('pica pizarro morley','quake','stone',{count:8});group('zunesha','water','trunk',{count:6});
  group('pearl gem gladius ideo','bomb','detonation',{count:6});
  group('cricket masira shoujou elizabello chinjao sai boo burgess','impact','pressure',{count:5});
  group('reiju','poison','butterfly');group('docq hogback kureha hiriluk','poison','vial');
  group('trebol','poison','sticky',{color:'#a6c968'});
  group('sugar','impact','toys',{color:'#f3aaca'});group('pudding montdor','portal','pages');
  group('brulee','portal','mirror');group('perospero','wax','candy',{color:'#eda1cd'});
  group('opera galette','mochi','cream');group('cracker','metal','soldiers',{color:'#d3a971',count:5});
  group('daifuku','soul','genie');group('oven prometheus','flame','heat');
  group('ichiji','laser','sparking',{color:'#ff7975'});group('niji','electricBeast','speed');
  group('yonji','metal','winch');group('judge','lightning','spear');
  group('momonosuke','dragon','clouds',{color:'#ed9fbc'});
  group('kinemon fossa','slash','flame',{color:'#ffb275'});
  group('kawamatsu','slash','water',{color:'#8ddeef'});group('kiku nusjuro','slash','frost',{color:'#a8e6ff'});
  group('inuarashi nekomamushi carrot pedro wanda shishilian','electricBeast','sulong',{count:4});
  group('apoo','music','percussion',{color:'#ffd285'});
  group('hawkins','dark','straw',{color:'#dbc295'});group('rocinante','dark','silence',{color:'#8ab4df'});
  group('blackmaria tararan','silk','web',{count:10});group('karasu','dark','ravens',{count:12});
  group('toki','portal','clock');group('shinobu','sand','decay');
  group('tama','impact','dango',{color:'#f8d7d3'});group('mansherry','petals','tears',{color:'#f8d7ec'});
  group('stussy devon','beast','phantom',{color:'#c99cda'});
  group('jack drake sasaki pageone ulti dalton minotauros','beast','charge');
  group('saturn','silk','omen',{color:'#dd789c',count:8});group('mars','phoenix','ominous',{color:'#c693d1',accent:'#eeceab'});
  group('warcury','beast','tusks');group('jupeter','sand','maw');group('im xebec','dark','sovereign',{color:'#ba647e'});
  group('shiki','gravity','levitate');group('emeth','metal','ancient',{color:'#a8d5cc'});
  // Crossovers keep their own visual language, never a One Piece fruit by type.
  group('naruto','wind','rasenshuriken',{color:'#74d6ff',count:4});
  group('sasuke','electricBeast','kirin',{color:'#aacfff'});group('kakashi','lightning','raikiri',{color:'#8dcaff'});
  group('madara tatsumaki','meteor','meteor',{color:'#c2a4ed'});group('orochimaru','poison','serpents',{count:8});
  group('itadori','impact','black-flash',{color:'#ed596e',accent:'#ffe2de'});group('yuta','ghost','rika');
  group('gojo','dark','infinity',{color:'#8ab8fa',accent:'#e7cafa'});group('sukuna','slash','shrine',{color:'#ed9c91',count:12});
  group('tanjiro','dragon','fire-dance');group('zenitsu','lightning','thunderclap',{count:1});
  group('inosuke','slash','fangs',{count:2});group('nezuko','flame','blood',{color:'#f78bc0'});
  group('kibutsuji','silk','blood-whips',{color:'#e67c9b'});
  group('goku gohan cell','laser','kamehameha',{color:'#69beff',accent:'#e7fbff'});
  group('vegeta','laser','final-flash',{color:'#ffdf78'});group('genos','laser','incineration',{color:'#ffb56a'});
  group('gokuui','impact','instinct',{color:'#c7e4ff',count:7});group('jiren saitama','impact','serious',{color:'#ffe8b8',count:1});
  group('frieza','dark','supernova',{color:'#d090e8'});group('zenosama','sun','erasure',{color:'#c7b9ff'});
  group('garou','water','flowing-fist',{color:'#87bfff'});

  // Supporting cast: weapon silhouettes and restrained martial/support motifs.
  group('coby fullbody kingdew laog','impact','boxing',{count:3});
  group('piratanovato merry boodle genzo woopslap kohza iceburg chimney gonbe lola kumashi risky dadan magra domino brownbeard mocha orlumbus columbus cosette chiffon bobbin moscato bavarois toko otsuru2 speed gazelleman jaki goki atlas mjosgard bakkin sengoku2','impact','resolve');
  group('johnny yosaku tashigi kuina koushirou ipponmatsu bogard higuma noland dogra thatch haruta speedjiru squard momonga doberman strawberry yamakaji kyros rikudold dagama tanklepanto suleiman abdullah amande snack anana sukiyaki denjiro ashuradoji yasuie ushimaru hitetsu rockstar john','slash','precision',{count:2});
  group('helmeppo piratapayaso cabaji kamakiri kiwi mozu nero','slash','dual',{count:2});
  group('morgan','slash','axe',{count:1});group('gin','impact','tonfas',{count:2});
  group('alvida','impact','club',{count:1});group('mohji chouchou','beast','claws',{count:3});
  group('marineraso brandnew nezumi ripper bellemere raki braham zambai curiel','shot','rifle',{count:3});
  group('ninjin piiman tamanegi','shot','slingshot',{count:1});
  group('chess marguerite jeet batman','shot','arrow',{count:3});
  group('igaram','shot','barrage',{count:8});group('pagaya wyper genbo babanuki','shot','cannon',{count:1});
  group('benn yasopp vanaugur','shot','sniper',{count:1});group('izo luckyroux gambia','shot','pistol',{count:2});
  group('flampe','shot','dart',{count:1});group('saldeath','music','flute');
  group('bandido toto','quake','rubble',{count:3});group('gaimon','shot','chest',{count:1,color:'#b9d485'});
  group('cocinapirata patty carnecook','impact','kitchen',{count:3});
  group('kaya nojiko makino conis','petals','encourage',{count:5});
  group('cobra aisa rouge otohime scarlett sora homing lili','impact','resolve',{color:'#eabf83',count:3});
  group('vivi','slash','peacock',{count:2,color:'#8dc6ed'});
  group('karoo pierre stronger','wind','dash',{count:3});group('pell lafitte morgans','wind','wings',{count:5});
  group('chaka pekoms','beast','charge');group('wapol','metal','maw',{count:6});
  group('kuromarimo','silk','binding',{color:'#c5a9da'});group('mikita machvise','gravity','weight',{count:3});
  group('mr4','bomb','baseball',{count:1});group('merrychristmas','sand','burrow');
  group('dazbones','slash','steel',{count:4,color:'#c9d8dd'});group('paula','metal','spikes',{count:7});
  group('ganfall','wind','lance');group('kalgara','slash','spear',{count:1});
  group('sarquiss','slash','kukri',{count:1});group('satori','bubble','orbs');
  group('shura','flame','lance');
  group('gedatsu fukuro','impact','pressure',{count:3});group('ohm','slash','cloud-blade',{color:'#d9e3ee'});
  group('yama','quake','stomp');group('lulu tbone','slash','carpenter',{count:2});
  group('tilestone blamenco blenheim dosun','impact','hammer',{count:1});
  group('tom yokozuna','water','tackle',{count:3});group('kokoro camie pappag shyarly den aladine praline','water','tide');
  group('wanze','string','noodles',{color:'#f6dfad'});group('kumadori','silk','mane',{color:'#e6a3bb'});
  group('spandam','slash','heavy-blade',{count:1});group('cindry','shot','plates',{count:5});
  group('hildon','dark','bats',{count:5});group('absalom','shot','invisible',{color:'#c5dce6'});
  group('gloriosa','beast','serpent');group('atmos','slash','horns',{count:2});group('rakuyo','impact','chain',{count:1});
  group('whiteybay','ice','icebreaker');group('hannyabal','slash','polearm',{count:2});
  group('sadie','silk','whip',{color:'#e899bf',count:1});group('shiryu','slash','vanish',{color:'#b4b6d9'});
  group('vascoshot','flame','brew',{color:'#e9a55b'});
  group('fukaboshi ikaros','slash','spear',{color:'#91dbdc',count:2});group('ryuboshi manboshi','water','spear');
  group('hammond','string','net',{count:8});group('zeo','dark','vanish',{color:'#a9c6c4'});
  group('decken','shot','homing',{count:3});group('baby5','metal','arsenal',{count:9});
  group('viola','water','tears',{color:'#cce4ff'});group('rebecca','slash','counter',{count:1});
  group('cavendish','slash','hakuba',{count:7,color:'#c8ceef'});group('vergo hyogoro','impact','armament',{color:'#b987a4'});
  group('buffalo','wind','rotor',{count:4});group('diamante','slash','flag',{color:'#e69a9f'});
  group('senorpink','water','dive');group('streusen','slash','kitchen',{color:'#dfc997'});
  group('kingbaum','forest','branches');group('napoleon','slash','soul-blade',{color:'#e4b4ed'});
  group('tamago','impact','kick');group('smoothie','slash','juice',{color:'#c9a8e8'});
  group('hiyori','music','shamisen',{color:'#a8dec5'});group('raizo','portal','scroll',{color:'#d5cf9f'});
  group('killer','slash','scythes',{count:2,color:'#b4d7ec'});group('holdem','flame','lion');
  group('dobon','beast','maw');group('daifugo','poison','needles');
  group('baohuang','dark','eye',{color:'#dfb788'});group('fukurokuju','silk','binding',{color:'#b8a9d5'});
  group('fugan','wind','gust');group('shaka','laser','scanner',{color:'#abdaca'});
  group('betty','impact','rally',{color:'#e9adbf'});group('lindbergh','ice','cool-shot');
  group('gaban','slash','axes',{count:2});group('crocus','shot','harpoon',{count:1});
  group('weevil','slash','heavy-blade',{count:1,color:'#e4c994'});group('york','metal','laboratory');
  group('sshark','water','karate',{count:4});
  group('charlos rosward shalria','shot','pistol',{count:1,color:'#e2cf9c'});

  group('jango','portal','hypnosis',{color:'#dfb3e4'});
  const typeFamily={Golpe:'impact',Corte:'slash',Disparo:'shot',Fuego:'flame',Rayo:'lightning',Hielo:'ice',Agua:'water',Tierra:'quake',Viento:'wind',Veneno:'poison',Oscuridad:'dark',Haki:'impact',Fruta:'impact'};
  const hash = text => {let h=2166136261;for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  function spriteMotion(family,motif) {
    if(motif==='kick')return 'kick';
    if(family==='rubber')return ({gatling:'barrage',jet:'jet',giant:'heavy',kong:'bound'})[motif]||'barrage';
    if(family==='sun')return 'dawn';
    if(family==='slash')return 'sword';
    if(['shot','laser'].includes(family))return 'ranged';
    if(['room','portal'].includes(family))return 'blink';
    if(family==='phoenix'||['wings','harpy','butterfly'].includes(motif))return 'flight';
    if(['beast','electricBeast'].includes(family))return 'pounce';
    if(['quake','metal','dragon'].includes(family)||['giant','buddha','serious'].includes(motif))return 'heavy';
    if(['impact','mochi','water'].includes(family))return 'strike';
    return 'cast';
  }
  function resolve(id, character, move, baseId=id) {
    const rule=overrides[id] || overrides[baseId];
    const family=rule?.family || typeFamily[move?.type] || typeFamily[character?.types?.[0]] || 'impact';
    const seed=hash(id+':'+(move?.name||'')), palette=styles[family];
    return Object.freeze({id,family,motif:rule?.motif || 'technique',
      motion:spriteMotion(family,rule?.motif),
      color:rule?.color||palette[0],accent:rule?.accent||palette[1],
      count:rule?.count||3+seed%4,seed,angle:(seed%41-20)*Math.PI/180,
      name:character?.name||id,technique:move?.name||'Definitiva',
      authored:!!rule,rarity:character?.rareza||1,
    });
  }
  globalThis.UltimateArtProfiles=Object.freeze({resolve,families:Object.freeze(Object.keys(styles))});
})();
