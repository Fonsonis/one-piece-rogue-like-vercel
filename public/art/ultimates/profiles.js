
(() => {
  'use strict';
  const styles = {
    impact:['#ffd398','#e88351'], slash:['#a4efbe','#eefbf1'], flame:['#ff903f','#ffe79f'],
    lightning:['#ffda56','#fff6cf'], ice:['#96eaff','#e6faff'], water:['#42cddf','#d2f9ff'],
    dark:['#9972d9','#e2c4ff'], quake:['#c7ecff','#fbfdff'], wind:['#83ddba','#e9fff2'],
    sand:['#d6ac65','#fff0bf'], smoke:['#bcc7d5','#f5f7fa'], poison:['#bf63db','#e9a1fa'],
    laser:['#6bdbff','#fff6ba'], shot:['#f9c46e','#fff0cc'], rubber:['#f79472','#ffe9c8'],
    room:['#59d9e3','#b9fff8'], string:['#ffd1f0','#ffffff'], paw:['#ffd6e8','#fff7fa'],
    guild_02:['#ff77ae','#ffdbed'], petals:['#cf8fe2','#ffe0f5'], phoenix:['#48cfee','#fff08a'],
    gravity:['#b881f1','#e7c9ff'], metal:['#aebbc9','#f3ab6d'], mochi:['#f4ddc3','#805958'],
    soul:['#91e8d0','#fff2ac'], ghost:['#e0cafa','#ffffff'], music:['#91e1ff','#ecd5ff'],
    forest:['#83c568','#dfefad'], beast:['#e4b37a','#fff1d6'], unit_068:['#ed824e','#ffd989'],
    barrier:['#87eca8','#e4ffe9'], bubble:['#b8f1ef','#ffd8f4'], wax:['#f4e7b5','#fffdf0'],
    ink:['#df85c3','#d6eced'], portal:['#86d9c7','#e2fff8'], bomb:['#ffc061','#fff0cd'],
    meteor:['#cba2fa','#ffce8a'], snow:['#c4eafb','#ffffff'], silk:['#d4abdf','#fff0fc'],
    guild_14:['#fff0b3','#ffffff'], electricBeast:['#c4ecff','#ffeb97'],
  };
  const overrides = Object.create(null);
  const group=(ids,family,motif,opts={})=>ids.split(' ').forEach(id=>{overrides[id]={family,motif,...opts};});


  group("unit_446 unit_447 unit_450 unit_451 unit_452 unit_453",'impact','resolve');
  group("unit_448 unit_449",'slash','rapier');
  group("unit_593",'slash','shogun');
  group("unit_594","unit_068",'flame-clouds',{color:'#ff9fcf'});
  group("unit_557",'paw','palm');
  group("unit_558",'impact','resolve');
  group("unit_559 unit_560",'shot','volley');
  group("unit_437 unit_443 unit_444 unit_445",'impact','fist');
  group("unit_438",'laser','beam');
  group("unit_439 unit_440 unit_441 unit_442",'shot','volley');
  group("unit_570 unit_571",'slash','three-swords',{count:3});
  group("unit_572 unit_573",'lightning','storm',{count:6});
  group("unit_574 unit_575",'flame','kick');
  group("unit_576",'flame','kick',{color:'#61cfff',accent:'#e7fcff'});
  group("unit_580",'impact','ryuo',{color:'#63bfff',accent:'#ffe49a',count:6});
  group("unit_578",'laser','radical',{count:5});
  group("unit_581",'quake',"technique_070",{color:'#9960da',accent:'#d8faff',count:8});
  group("unit_454",'lightning','hammer',{count:6});
  group("unit_472","unit_068",'lightning',{color:'#b69cf0',count:7});
  group("unit_455",'slash',"technique_156",{count:3});
  group("unit_456 unit_555",'shot','arrow',{color:'#80c8e5',count:5});
  group("unit_457 unit_556",'forest','thorns',{color:'#bd779d',count:7});
  group("unit_458 unit_473 unit_474",'dark',"technique_159",{count:6});
  group("unit_561 unit_562",'dark','domi-reversi',{color:'#ae5572',count:8});
  group("unit_459 unit_464 unit_465 unit_466 unit_467",'impact','giant',{count:5});
  group("unit_460 unit_461",'slash','axe',{count:2});
  group("unit_462",'impact','shield');group("unit_463",'impact','hammer');
  group("unit_468",'impact','resolve');group("unit_469",'portal','books');
  group("unit_470 unit_553",'impact',"guild_17");group("unit_471 unit_559",'shot',"technique_030");
  group("unit_001",'rubber','gatling',{count:7});
  group("unit_002",'rubber','jet',{count:10,color:'#ff8a91'});
  group("unit_003",'rubber','giant',{count:1});
  group("unit_004",'rubber','boundman',{count:1,color:'#bb2638',accent:'#ffe1c7'});
  group("unit_005",'rubber','snakeman',{count:3,color:'#d96065',accent:'#ffceb5'});
  group("unit_006",'rubber','tankman',{count:1,color:'#7c1028',accent:'#ff4a62'});
  group("unit_007 unit_434","guild_14",'dawn',{count:5});
  group("unit_008",'slash','three-swords',{count:3});
  group("unit_009",'slash',"technique_020",{count:9,color:'#ae85e0'});
  group("unit_010 unit_011 unit_315 unit_318",'lightning','cloud',{count:5});
  group("unit_014",'forest','pop-green',{count:5});group("unit_015",'shot','fire-star',{color:'#ffad64'});
  group("unit_016",'flame','kick',{count:3});group("unit_086 unit_283 unit_126 unit_302",'impact','kick');
  group("unit_046",'beast','antlers',{count:3});group("unit_047",'petals','hands',{count:8});
  group("unit_048 unit_072 unit_390 unit_391 unit_392",'laser','radical');
  group("unit_049",'music','soul-sword',{color:'#9bddfb'});group("unit_050",'water','karate',{count:4});
  group("unit_034",'bomb','muggy',{count:5});group("unit_039",'poison','mh5');
  group("unit_045",'smoke','white-blow');group("unit_052",'quake','seaquake',{count:7});
  group("unit_051 unit_055 unit_399 unit_423",'slash','conqueror',{color:'#e56777',accent:'#fff0d8'});
  group("unit_067 unit_013",'impact','galaxy',{color:'#ff9ba5',count:6});
  group("unit_056",'dark','black-hole',{count:8});group("unit_053","unit_068","flame-unit_068");
  group("unit_054",'soul','homies',{count:3});group("unit_057",'room','gamma-knife');
  group("unit_058",'metal','magnetic',{count:12});group("unit_059 unit_413",'slash','black-blade',{count:1,color:'#95f49d'});
  group("unit_597",'room','puncture-wille',{color:'#55dcff',accent:'#e6fdff',count:8});
  group("unit_598",'laser','damned-punk',{color:'#ff678b',accent:'#aefbff',count:8});
  group("unit_599",'impact','galaxy',{color:'#ff9ba5',accent:'#d2edff',count:8});
  group("unit_060 unit_418",'sand','desert-spada');group("unit_061 unit_416",'string','birdcage',{count:12});
  group("unit_062 unit_415",'paw','ursus-shock');group("unit_063 unit_412","guild_02",'petrify',{count:6});
  group("unit_064",'flame','magma',{color:'#f75e42',count:5});group("unit_065",'laser','magatama',{color:'#ffdc66',count:8});
  group("unit_066",'ice','ice-age',{count:9});group("unit_068",'wind','cyclone',{count:6});
  group("unit_069",'flame',"unit_068-claw");group("unit_079",'flame',"guild_14-orb",{count:8});
  group("unit_070",'beast',"technique_093");group("unit_071","guild_14","technique_094");
  group("unit_073",'slash','cross',{count:2,color:'#eca2a7'});group("unit_074",'ice','thunder-club');
  group("unit_075","unit_068",'lunarian',{color:'#e4a258'});group("unit_076",'poison','virus',{color:'#94d878'});
  group("unit_077",'mochi','donuts',{count:6});group("unit_078",'phoenix','wings',{count:6});
  group("unit_152",'lightning','drums',{count:4});group("unit_230",'impact','buddha',{color:'#ffdb78',count:5});
  group("unit_305",'gravity','meteor',{count:5});group("unit_419",'forest','roots',{count:7});
  group("unit_218",'poison','hydra',{count:3});group("unit_291",'poison','gas');
  group("unit_292",'snow','harpy');group("unit_183",'ghost','negative',{count:6});
  group("unit_188 unit_417",'dark','bats',{count:9});group("unit_186",'slash','autumn',{color:'#88cce7'});
  group("unit_122",'wax','candelabra');group("unit_123 unit_295 unit_378",'ink','brush',{count:6});
  group("unit_129",'metal','cage',{count:7});group("unit_154 unit_286",'string','binding',{count:7});
  group("unit_172 unit_216",'bubble','foam',{count:12});group("unit_170",'portal','door');
  group("unit_145",'rubber','spring');group("unit_277",'barrier','wall');
  group("unit_199",'ice','diamond',{color:'#99e1ec'});group("unit_200",'slash','roses',{count:2,color:'#eea7c4'});
  group("unit_198",'slash','scissors',{count:2});group("unit_197",'impact','wink',{color:'#f49dcf'});
  group("unit_189 unit_190 unit_379",'beast','serpent',{count:3});
  group("unit_261 unit_041 region_08 unit_252 unit_262 unit_263 unit_207",'water','karate');
  group("unit_043 unit_257",'beast','shark');group("unit_040 unit_022 unit_240",'water','spear');
  group("unit_241",'water','sea-kings',{count:4});
  group("unit_042 unit_225 unit_254",'slash','many-blades',{count:6});
  group("unit_036 unit_035 unit_024 unit_173 unit_383",'beast','claws',{count:4});
  group("unit_171",'slash','storm-kick',{count:4});
  group("unit_187 unit_215 unit_236 unit_260 unit_288 unit_165 unit_116",'impact','giant',{count:6});
  group("unit_115 unit_166 unit_227",'slash','giant',{count:2});
  group("unit_299 unit_237 unit_397",'quake','stone',{count:8});group("unit_366",'water','trunk',{count:6});
  group("unit_038 unit_120 unit_304 unit_282",'bomb','detonation',{count:6});
  group("unit_140 unit_141 unit_142 unit_272 unit_281 unit_279 unit_280 unit_231",'impact','pressure',{count:5});
  group("unit_306",'poison','butterfly');group("unit_239 unit_185 unit_112 unit_113",'poison','vial');
  group("unit_297",'poison','sticky',{color:'#a6c968'});
  group("unit_294",'impact','toys',{color:'#f3aaca'});group("unit_309 unit_332",'portal','pages');
  group("unit_326",'portal','mirror');group("unit_327",'wax','candy',{color:'#eda1cd'});
  group("unit_330 unit_334",'mochi','cream');group("unit_325",'metal','soldiers',{color:'#d3a971',count:5});
  group("unit_328",'soul','genie');group("unit_329 unit_316",'flame','heat');
  group("unit_322",'laser','sparking',{color:'#ff7975'});group("unit_323",'electricBeast',"unit_370");
  group("unit_324",'metal','winch');group("unit_321",'lightning','spear');
  group("unit_341","unit_068",'clouds',{color:'#ed9fbc'});
  group("unit_340 unit_205",'slash','flame',{color:'#ffb275'});
  group("unit_349",'slash','water',{color:'#8ddeef'});group("unit_346 unit_427",'slash','frost',{color:'#a8e6ff'});
  group("unit_358 unit_359 unit_360 unit_361 unit_362 unit_363",'electricBeast',"Ascended",{count:4});
  group("unit_368",'music','percussion',{color:'#ffd285'});
  group("unit_367",'dark',"guild_01",{color:'#dbc295'});group("unit_406",'dark','silence',{color:'#8ab4df'});
  group("unit_385 unit_182",'silk','web',{count:10});group("unit_395",'dark','ravens',{count:12});
  group("unit_343",'portal','clock');group("unit_350",'sand','decay');
  group("unit_354",'impact','dango',{color:'#f8d7d3'});group("unit_287",'petals','tears',{color:'#f8d7ec'});
  group("unit_394 unit_235",'beast','phantom',{color:'#c99cda'});
  group("unit_380 unit_365 unit_384 unit_382 unit_381 unit_114 unit_223",'beast','charge');
  group("unit_424",'silk','omen',{color:'#dd789c',count:8});group("unit_425",'phoenix','ominous',{color:'#c693d1',accent:'#eeceab'});
  group("unit_426",'beast','tusks');group("unit_428",'sand','maw');group("unit_429 unit_430",'dark','sovereign',{color:'#ba647e'});
  group("unit_431",'gravity','levitate');group("unit_436",'metal','ancient',{color:'#a8d5cc'});

  group("unit_012 unit_101 unit_211 unit_301",'impact','boxing',{count:3});
  group("unit_019 unit_081 unit_085 unit_091 unit_095 unit_110 unit_153 unit_158 unit_159 unit_177 unit_179 unit_180 unit_193 unit_195 unit_222 unit_264 unit_265 unit_289 unit_290 unit_308 unit_310 unit_320 unit_337 unit_338 unit_355 unit_356 unit_370 unit_375 unit_387 unit_388 unit_393 unit_408 unit_410 unit_433",'impact','resolve');
  group("unit_017 unit_018 unit_044 unit_092 unit_093 unit_096 unit_097 unit_099 unit_143 unit_194 unit_201 unit_203 unit_212 unit_213 unit_224 unit_226 unit_228 unit_229 unit_268 unit_270 unit_273 unit_274 unit_276 unit_284 unit_333 unit_335 unit_339 unit_344 unit_345 unit_348 unit_352 unit_353 unit_357 unit_405 unit_432",'slash','precision',{count:2});
  group("unit_030 unit_023 unit_033 unit_135 unit_161 unit_162 unit_169",'slash','dual',{count:2});
  group("unit_031",'slash','axe',{count:1});group("unit_037",'impact','tonfas',{count:2});
  group("unit_029",'impact','club',{count:1});group("unit_032 unit_028",'beast','claws',{count:3});
  group("unit_020 unit_098 unit_102 unit_103 unit_089 unit_138 unit_136 unit_160 unit_206",'shot',"technique_030",{count:3});
  group("unit_082 unit_083 unit_084",'shot','slingshot',{count:1});
  group("unit_118 unit_192 unit_285 unit_374",'shot','arrow',{count:3});
  group("unit_106",'shot','barrage',{count:8});group("unit_133 unit_134 unit_137 unit_371",'shot','cannon',{count:1});
  group("unit_402 unit_404 unit_233",'shot','sniper',{count:1});group("unit_202 unit_403 unit_278",'shot','pistol',{count:2});
  group("unit_336",'shot','dart',{count:1});group("unit_221",'music','flute');
  group("unit_021 unit_111",'quake','rubble',{count:3});group("unit_027",'shot','chest',{count:1,color:'#b9d485'});
  group("unit_025 unit_087 unit_088",'impact','kitchen',{count:3});
  group("unit_080 unit_090 unit_094 unit_132",'petals','encourage',{count:5});
  group("unit_107 unit_139 unit_196 unit_245 unit_271 unit_307 unit_407 unit_435",'impact','resolve',{color:'#eabf83',count:3});
  group("unit_104",'slash','peacock',{count:2,color:'#8dc6ed'});
  group("unit_105 unit_131 unit_217",'wind','dash',{count:3});group("unit_109 unit_234 unit_311",'wind','wings',{count:5});
  group("unit_108 unit_312",'beast','charge');group("unit_117",'metal','maw',{count:6});
  group("unit_119",'silk','binding',{color:'#c5a9da'});group("unit_121 unit_303",'gravity','weight',{count:3});
  group("unit_124",'bomb','baseball',{count:1});group("unit_125",'sand','burrow');
  group("unit_127",'slash','steel',{count:4,color:'#c9d8dd'});group("unit_128",'metal','spikes',{count:7});
  group("unit_130",'wind','lance');group("unit_144",'slash','spear',{count:1});
  group("unit_146",'slash','kukri',{count:1});group("unit_147",'bubble','orbs');
  group("unit_148",'flame','lance');
  group("unit_149 unit_175",'impact','pressure',{count:3});group("unit_150",'slash','cloud-blade',{color:'#d9e3ee'});
  group("unit_151",'quake','stomp');group("unit_155 unit_167",'slash','carpenter',{count:2});
  group("unit_156 unit_210 unit_208 unit_255",'impact','hammer',{count:1});
  group("unit_163 unit_164",'water','tackle',{count:3});group("unit_157 unit_246 unit_247 unit_248 unit_249 unit_250 unit_251",'water','tide');
  group("unit_168",'string','noodles',{color:'#f6dfad'});group("unit_174",'silk','mane',{color:'#e6a3bb'});
  group("unit_176",'slash','heavy-blade',{count:1});group("unit_178",'shot','plates',{count:5});
  group("unit_181",'dark','bats',{count:5});group("unit_184",'shot','invisible',{color:'#c5dce6'});
  group("unit_191",'beast','serpent');group("unit_204",'slash','horns',{count:2});group("unit_209",'impact','chain',{count:1});
  group("unit_214",'ice','icebreaker');group("unit_219",'slash','polearm',{count:2});
  group("unit_220",'silk','whip',{color:'#e899bf',count:1});group("unit_232",'slash','vanish',{color:'#b4b6d9'});
  group("unit_238",'flame','brew',{color:'#e9a55b'});
  group("unit_242 unit_258",'slash','spear',{color:'#91dbdc',count:2});group("unit_243 unit_244",'water','spear');
  group("unit_253",'string','net',{count:8});group("unit_256",'dark','vanish',{color:'#a9c6c4'});
  group("unit_259",'shot',"unit_407",{count:3});group("unit_266",'metal','arsenal',{count:9});
  group("unit_267",'water','tears',{color:'#cce4ff'});group("unit_269",'slash','counter',{count:1});
  group("unit_275",'slash','hakuba',{count:7,color:'#c8ceef'});group("unit_293 unit_351",'impact','armament',{color:'#b987a4'});
  group("unit_296",'wind','rotor',{count:4});group("unit_298",'slash','flag',{color:'#e69a9f'});
  group("unit_300",'water','dive');group("unit_313",'slash','kitchen',{color:'#dfc997'});
  group("unit_314",'forest','branches');group("unit_317",'slash','soul-blade',{color:'#e4b4ed'});
  group("unit_319",'impact','kick');group("unit_331",'slash','juice',{color:'#c9a8e8'});
  group("unit_342",'music','shamisen',{color:'#a8dec5'});group("unit_347",'portal','scroll',{color:'#d5cf9f'});
  group("unit_364",'slash','scythes',{count:2,color:'#b4d7ec'});group("unit_369",'flame','lion');
  group("unit_372",'beast','maw');group("unit_373",'poison','needles');
  group("unit_376",'dark','eye',{color:'#dfb788'});group("unit_377",'silk','binding',{color:'#b8a9d5'});
  group("unit_386",'wind','gust');group("unit_389",'laser','scanner',{color:'#abdaca'});
  group("unit_396",'impact','rally',{color:'#e9adbf'});group("unit_398",'ice','cool-shot');
  group("unit_400",'slash','axes',{count:2});group("unit_401",'shot','harpoon',{count:1});
  group("unit_409",'slash','heavy-blade',{count:1,color:'#e4c994'});group("unit_411",'metal','laboratory');
  group("unit_414",'water','karate',{count:4});
  group("unit_420 unit_421 unit_422",'shot','pistol',{count:1,color:'#e2cf9c'});

  group("unit_100",'portal','hypnosis',{color:'#dfb3e4'});
  const typeFamily={Golpe:'impact',Corte:'slash',Disparo:'shot',Fuego:'flame',Rayo:'lightning',Hielo:'ice',Agua:'water',Tierra:'quake',Viento:'wind',Veneno:'poison',Oscuridad:'dark',Éter:'impact',Cristal:'impact'};
  const hash = text => {let h=2166136261;for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  function spriteMotion(family,motif) {
    if(motif==='kick')return 'kick';
    if(family==='rubber')return ({gatling:'barrage',jet:'jet',giant:'heavy',kong:'bound',snakeman:'serpentine'})[motif]||'barrage';
    if(family==="guild_14")return 'dawn';
    if(family==='slash')return 'sword';
    if(['shot','laser'].includes(family))return 'ranged';
    if(['room','portal'].includes(family))return 'blink';
    if(family==='phoenix'||['wings','harpy','butterfly'].includes(motif))return 'flight';
    if(['beast','electricBeast'].includes(family))return 'pounce';
    if(['quake','metal',"unit_068"].includes(family)||['giant','buddha','serious'].includes(motif))return 'heavy';
    if(['impact','mochi','water'].includes(family))return 'strike';
    return 'cast';
  }
  function resolve(id, character, move, baseId=id) {
    const rule=character?.AscendedBase ? {family:'lightning',motif:'electro',color:'#d9f4ff',count:7} : overrides[id] || overrides[baseId] || overrides[character?.historicalBase];
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
