
(() => {
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,x)), ease=x=>1-(1-clamp(x))**3;
  const active=new Map(), atlases=new Map(), hiddenSprites=new Map();
  const between=(t,a,b)=>clamp((t-a)/(b-a));


  const ultimateAtlasManifest=Object.freeze({
    "unit_284":"ultimates/unit_284.png",
    "unit_184":"ultimates/unit_184.png",
    "unit_079":"ultimates/unit_079.png",
    "unit_139":"ultimates/unit_139.png",
    "unit_064":"ultimates/unit_064.png",
    "unit_250":"ultimates/unit_250.png",
    "unit_029":"ultimates/unit_029.png",
    "unit_333":"ultimates/unit_333.png",
    "unit_339":"ultimates/unit_339.png",
    "unit_468":"ultimates/unit_468.png",
    "unit_066":"ultimates/unit_066.png",
    "unit_066-guild_05":"ultimates/unit_066-guild_05.png",
    "unit_368":"ultimates/unit_368.png",
    "unit_043":"ultimates/unit_043.png",
    "unit_348":"ultimates/unit_348.png",
    "unit_393":"ultimates/unit_393.png",
    "unit_204":"ultimates/unit_204.png",
    "unit_371":"ultimates/unit_371.png",
    "unit_266":"ultimates/unit_266.png",
    "unit_410":"ultimates/unit_410.png",
    "unit_549":"ultimates/unit_549.png",
    "unit_021":"ultimates/unit_021.png",
    "unit_376":"ultimates/unit_376.png",
    "unit_277":"ultimates/unit_277.png",
    "unit_374":"ultimates/unit_374.png",
    "unit_338":"ultimates/unit_338.png",
    "unit_442":"ultimates/unit_442.png",
    "unit_145":"ultimates/unit_145.png",
    "unit_089":"ultimates/unit_089.png",
    "unit_402":"ultimates/unit_402.png",
    "unit_126":"ultimates/unit_126.png",
    "unit_444":"ultimates/unit_444.png",
    "unit_592":"ultimates/unit_592.png",
    "unit_396":"ultimates/unit_396.png",
    "unit_469":"ultimates/unit_469.png",
    "unit_054":"ultimates/unit_054.png",
    "unit_543":"ultimates/unit_543.png",
    "unit_447":"ultimates/unit_447.png",
    "unit_590":"ultimates/unit_590.png",
    "unit_385":"ultimates/unit_385.png",
    "unit_524":"ultimates/unit_524.png",
    "unit_525":"ultimates/unit_525.png",
    "unit_210":"ultimates/unit_210.png",
    "unit_208":"ultimates/unit_208.png",
    "unit_283":"ultimates/unit_283.png",
    "unit_170":"ultimates/unit_170.png",
    "unit_320":"ultimates/unit_320.png",
    "unit_097":"ultimates/unit_097.png",
    "unit_548":"ultimates/unit_548.png",
    "unit_071":"ultimates/unit_071.png",
    "unit_595":"ultimates/unit_595.png",
    "unit_280":"ultimates/unit_280.png",
    "unit_085":"ultimates/unit_085.png",
    "unit_136":"ultimates/unit_136.png",
    "unit_098":"ultimates/unit_098.png",
    "unit_116":"ultimates/unit_116.png",
    "unit_049":"ultimates/unit_049.png",
    "unit_264":"ultimates/unit_264.png",
    "unit_326":"ultimates/unit_326.png",
    "unit_296":"ultimates/unit_296.png",
    "unit_034":"ultimates/unit_034.png",
    "unit_034-guild_07":"ultimates/unit_034-guild_07.png",
    "unit_034-unit_051":"ultimates/unit_034-unit_051.png",
    "unit_231":"ultimates/unit_231.png",
    "unit_033":"ultimates/unit_033.png",
    "unit_291":"ultimates/unit_291.png",
    "unit_246":"ultimates/unit_246.png",
    "unit_088":"ultimates/unit_088.png",
    "unit_360":"ultimates/unit_360.png",
    "unit_582":"ultimates/unit_582.png",
    "unit_275":"ultimates/unit_275.png",
    "unit_108":"ultimates/unit_108.png",
    "unit_494":"ultimates/unit_494.png",
    "unit_495":"ultimates/unit_495.png",
    "unit_420":"ultimates/unit_420.png",
    "unit_118":"ultimates/unit_118.png",
    "unit_310":"ultimates/unit_310.png",
    "unit_158":"ultimates/unit_158.png",
    "unit_281":"ultimates/unit_281.png",
    "unit_046":"ultimates/unit_046.png",
    "unit_475":"ultimates/unit_475.png",
    "unit_476":"ultimates/unit_476.png",
    "unit_477":"ultimates/unit_477.png",
    "unit_028":"ultimates/unit_028.png",
    "unit_040":"ultimates/unit_040.png",
    "unit_178":"ultimates/unit_178.png",
    "unit_107":"ultimates/unit_107.png",
    "unit_012":"ultimates/unit_012.png",
    "unit_013":"ultimates/unit_013.png",
    "unit_025":"ultimates/unit_025.png",
    "unit_467":"ultimates/unit_467.png",
    "unit_290":"ultimates/unit_290.png",
    "unit_449":"ultimates/unit_449.png",
    "unit_588":"ultimates/unit_588.png",
    "unit_132":"ultimates/unit_132.png",
    "unit_308":"ultimates/unit_308.png",
    "unit_325":"ultimates/unit_325.png",
    "unit_140":"ultimates/unit_140.png",
    "unit_060":"ultimates/unit_060.png",
    "unit_060-guild_06":"ultimates/unit_060-guild_06.png",
    "unit_060-guild_07":"ultimates/unit_060-guild_07.png",
    "unit_401":"ultimates/unit_401.png",
    "unit_206":"ultimates/unit_206.png",
    "unit_193":"ultimates/unit_193.png",
    "unit_273":"ultimates/unit_273.png",
    "unit_373":"ultimates/unit_373.png",
    "unit_328":"ultimates/unit_328.png",
    "unit_114":"ultimates/unit_114.png",
    "unit_498":"ultimates/unit_498.png",
    "unit_499":"ultimates/unit_499.png",
    "unit_257":"ultimates/unit_257.png",
    "unit_127":"ultimates/unit_127.png",
    "unit_127-guild_07":"ultimates/unit_127-guild_07.png",
    "unit_259":"ultimates/unit_259.png",
    "unit_302":"ultimates/unit_302.png",
    "unit_249":"ultimates/unit_249.png",
    "unit_345":"ultimates/unit_345.png",
    "unit_235":"ultimates/unit_235.png",
    "unit_526":"ultimates/unit_526.png",
    "unit_527":"ultimates/unit_527.png",
    "unit_298":"ultimates/unit_298.png",
    "unit_440":"ultimates/unit_440.png",
    "unit_226":"ultimates/unit_226.png",
    "unit_372":"ultimates/unit_372.png",
    "unit_239":"ultimates/unit_239.png",
    "unit_061":"ultimates/unit_061.png",
    "unit_194":"ultimates/unit_194.png",
    "unit_222":"ultimates/unit_222.png",
    "unit_115":"ultimates/unit_115.png",
    "unit_255":"ultimates/unit_255.png",
    "unit_068":"ultimates/unit_068.png",
    "unit_560":"ultimates/unit_560.png",
    "unit_365":"ultimates/unit_365.png",
    "unit_510":"ultimates/unit_510.png",
    "unit_365-guild_11":"ultimates/unit_365-guild_11.png",
    "unit_511":"ultimates/unit_511.png",
    "unit_439":"ultimates/unit_439.png",
    "unit_391":"ultimates/unit_391.png",
    "unit_272":"ultimates/unit_272.png",
    "unit_436":"ultimates/unit_436.png",
    "unit_152":"ultimates/unit_152.png",
    "unit_252":"ultimates/unit_252.png",
    "unit_336":"ultimates/unit_336.png",
    "unit_205":"ultimates/unit_205.png",
    "unit_048":"ultimates/unit_048.png",
    "unit_579":"ultimates/unit_579.png",
    "unit_386":"ultimates/unit_386.png",
    "unit_305":"ultimates/unit_305.png",
    "unit_242":"ultimates/unit_242.png",
    "unit_175":"ultimates/unit_175.png",
    "unit_377":"ultimates/unit_377.png",
    "unit_101":"ultimates/unit_101.png",
    "unit_400":"ultimates/unit_400.png",
    "unit_541":"ultimates/unit_541.png",
    "unit_027":"ultimates/unit_027.png",
    "unit_122":"ultimates/unit_122.png",
    "unit_122-guild_07":"ultimates/unit_122-guild_07.png",
    "unit_334":"ultimates/unit_334.png",
    "unit_278":"ultimates/unit_278.png",
    "unit_130":"ultimates/unit_130.png",
    "unit_423":"ultimates/unit_423.png",
    "unit_547":"ultimates/unit_547.png",
    "unit_067":"ultimates/unit_067.png",
    "unit_538":"ultimates/unit_538.png",
    "unit_375":"ultimates/unit_375.png",
    "unit_149":"ultimates/unit_149.png",
    "unit_120":"ultimates/unit_120.png",
    "unit_137":"ultimates/unit_137.png",
    "unit_091":"ultimates/unit_091.png",
    "unit_461":"ultimates/unit_461.png",
    "unit_037":"ultimates/unit_037.png",
    "unit_471":"ultimates/unit_471.png",
    "unit_559":"ultimates/unit_559.png",
    "unit_453":"ultimates/unit_453.png",
    "unit_448":"ultimates/unit_448.png",
    "unit_587":"ultimates/unit_587.png",
    "unit_304":"ultimates/unit_304.png",
    "unit_191":"ultimates/unit_191.png",
    "unit_550":"ultimates/unit_550.png",
    "unit_388":"ultimates/unit_388.png",
    "unit_462":"ultimates/unit_462.png",
    "unit_159":"ultimates/unit_159.png",
    "unit_456":"ultimates/unit_456.png",
    "unit_555":"ultimates/unit_555.png",
    "region_08":"ultimates/region_08.png",
    "unit_042":"ultimates/unit_042.png",
    "unit_042-guild_14":"ultimates/unit_042-guild_14.png",
    "unit_263":"ultimates/unit_263.png",
    "unit_288":"ultimates/unit_288.png",
    "unit_253":"ultimates/unit_253.png",
    "unit_063":"ultimates/unit_063.png",
    "unit_219":"ultimates/unit_219.png",
    "unit_459":"ultimates/unit_459.png",
    "unit_203":"ultimates/unit_203.png",
    "unit_367":"ultimates/unit_367.png",
    "unit_030":"ultimates/unit_030.png",
    "unit_318":"ultimates/unit_318.png",
    "unit_099":"ultimates/unit_099.png",
    "unit_181":"ultimates/unit_181.png",
    "unit_129":"ultimates/unit_129.png",
    "unit_113":"ultimates/unit_113.png",
    "unit_357":"ultimates/unit_357.png",
    "unit_342":"ultimates/unit_342.png",
    "unit_261":"ultimates/unit_261.png",
    "unit_185":"ultimates/unit_185.png",
    "unit_369":"ultimates/unit_369.png",
    "unit_407":"ultimates/unit_407.png",
    "unit_351":"ultimates/unit_351.png",
    "unit_254":"ultimates/unit_254.png",
    "unit_153":"ultimates/unit_153.png",
    "unit_322":"ultimates/unit_322.png",
    "unit_282":"ultimates/unit_282.png",
    "unit_106":"ultimates/unit_106.png",
    "unit_258":"ultimates/unit_258.png",
    "unit_429":"ultimates/unit_429.png",
    "unit_561":"ultimates/unit_561.png",
    "unit_562":"ultimates/unit_562.png",
    "unit_198":"ultimates/unit_198.png",
    "unit_358":"ultimates/unit_358.png",
    "unit_358-guild_23":"ultimates/unit_358-guild_23.png",
    "unit_584":"ultimates/unit_584.png",
    "unit_096":"ultimates/unit_096.png",
    "unit_197":"ultimates/unit_197.png",
    "unit_596":"ultimates/unit_596.png",
    "unit_558":"ultimates/unit_558.png",
    "unit_202":"ultimates/unit_202.png",
    "unit_202-guild_23":"ultimates/unit_202-guild_23.png",
    "unit_173":"ultimates/unit_173.png",
    "unit_502":"ultimates/unit_502.png",
    "unit_503":"ultimates/unit_503.png",
    "unit_380":"ultimates/unit_380.png",
    "unit_514":"ultimates/unit_514.png",
    "unit_515":"ultimates/unit_515.png",
    "unit_387":"ultimates/unit_387.png",
    "unit_100":"ultimates/unit_100.png",
    "unit_465":"ultimates/unit_465.png",
    "unit_445":"ultimates/unit_445.png",
    "unit_285":"ultimates/unit_285.png",
    "unit_050":"ultimates/unit_050.png",
    "unit_050-guild_14":"ultimates/unit_050-guild_14.png",
    "unit_432":"ultimates/unit_432.png",
    "unit_551":"ultimates/unit_551.png",
    "unit_227":"ultimates/unit_227.png",
    "unit_017":"ultimates/unit_017.png",
    "unit_295":"ultimates/unit_295.png",
    "unit_434":"ultimates/unit_434.png",
    "unit_199":"ultimates/unit_199.png",
    "unit_321":"ultimates/unit_321.png",
    "unit_428":"ultimates/unit_428.png",
    "unit_569":"ultimates/unit_569.png",
    "unit_053":"ultimates/unit_053.png",
    "unit_484":"ultimates/unit_484.png",
    "unit_485":"ultimates/unit_485.png",
    "unit_544":"ultimates/unit_544.png",
    "unit_171":"ultimates/unit_171.png",
    "unit_481":"ultimates/unit_481.png",
    "unit_483":"ultimates/unit_483.png",
    "unit_482":"ultimates/unit_482.png",
    "unit_144":"ultimates/unit_144.png",
    "unit_172":"ultimates/unit_172.png",
    "unit_135":"ultimates/unit_135.png",
    "unit_378":"ultimates/unit_378.png",
    "unit_395":"ultimates/unit_395.png",
    "unit_105":"ultimates/unit_105.png",
    "unit_166":"ultimates/unit_166.png",
    "unit_077":"ultimates/unit_077.png",
    "unit_349":"ultimates/unit_349.png",
    "unit_080":"ultimates/unit_080.png",
    "unit_058":"ultimates/unit_058.png",
    "unit_346":"ultimates/unit_346.png",
    "unit_364":"ultimates/unit_364.png",
    "unit_458":"ultimates/unit_458.png",
    "unit_473":"ultimates/unit_473.png",
    "unit_474":"ultimates/unit_474.png",
    "unit_340":"ultimates/unit_340.png",
    "unit_075":"ultimates/unit_075.png",
    "unit_488":"ultimates/unit_488.png",
    "unit_489":"ultimates/unit_489.png",
    "unit_314":"ultimates/unit_314.png",
    "unit_211":"ultimates/unit_211.png",
    "unit_161":"ultimates/unit_161.png",
    "unit_065":"ultimates/unit_065.png",
    "unit_262":"ultimates/unit_262.png",
    "unit_110":"ultimates/unit_110.png",
    "unit_157":"ultimates/unit_157.png",
    "unit_093":"ultimates/unit_093.png",
    "unit_039":"ultimates/unit_039.png",
    "unit_092":"ultimates/unit_092.png",
    "unit_062":"ultimates/unit_062.png",
    "unit_557":"ultimates/unit_557.png",
    "unit_174":"ultimates/unit_174.png",
    "unit_179":"ultimates/unit_179.png",
    "unit_112":"ultimates/unit_112.png",
    "unit_036":"ultimates/unit_036.png",
    "unit_119":"ultimates/unit_119.png",
    "unit_041":"ultimates/unit_041.png",
    "unit_268":"ultimates/unit_268.png",
    "unit_234":"ultimates/unit_234.png",
    "unit_301":"ultimates/unit_301.png",
    "unit_057":"ultimates/unit_057.png",
    "unit_057-guild_19":"ultimates/unit_057-guild_19.png",
    "unit_286":"ultimates/unit_286.png",
    "unit_435":"ultimates/unit_435.png",
    "unit_390":"ultimates/unit_390.png",
    "unit_398":"ultimates/unit_398.png",
    "unit_454":"ultimates/unit_454.png",
    "unit_472":"ultimates/unit_472.png",
    "unit_177":"ultimates/unit_177.png",
    "unit_070":"ultimates/unit_070.png",
    "unit_478":"ultimates/unit_478.png",
    "unit_480":"ultimates/unit_480.png",
    "unit_479":"ultimates/unit_479.png",
    "unit_403":"ultimates/unit_403.png",
    "unit_001":"ultimates/unit_001.png",
    "unit_002":"ultimates/unit_002.png",
    "unit_003":"ultimates/unit_003.png",
    "unit_005":"ultimates/unit_005.png",
    "unit_004":"ultimates/unit_004.png",
    "unit_006":"ultimates/unit_006.png",
    "unit_155":"ultimates/unit_155.png",
    "unit_303":"ultimates/unit_303.png",
    "unit_218":"ultimates/unit_218.png",
    "unit_195":"ultimates/unit_195.png",
    "unit_094":"ultimates/unit_094.png",
    "unit_244":"ultimates/unit_244.png",
    "unit_287":"ultimates/unit_287.png",
    "unit_078":"ultimates/unit_078.png",
    "unit_492":"ultimates/unit_492.png",
    "unit_493":"ultimates/unit_493.png",
    "unit_192":"ultimates/unit_192.png",
    "unit_123":"ultimates/unit_123.png",
    "unit_190":"ultimates/unit_190.png",
    "unit_506":"ultimates/unit_506.png",
    "unit_507":"ultimates/unit_507.png",
    "unit_020":"ultimates/unit_020.png",
    "unit_425":"ultimates/unit_425.png",
    "unit_565":"ultimates/unit_565.png",
    "unit_141":"ultimates/unit_141.png",
    "unit_081":"ultimates/unit_081.png",
    "unit_125":"ultimates/unit_125.png",
    "unit_500":"ultimates/unit_500.png",
    "unit_501":"ultimates/unit_501.png",
    "unit_059":"ultimates/unit_059.png",
    "unit_121":"ultimates/unit_121.png",
    "unit_223":"ultimates/unit_223.png",
    "unit_450":"ultimates/unit_450.png",
    "unit_408":"ultimates/unit_408.png",
    "unit_265":"ultimates/unit_265.png",
    "unit_032":"ultimates/unit_032.png",
    "unit_224":"ultimates/unit_224.png",
    "unit_341":"ultimates/unit_341.png",
    "unit_593":"ultimates/unit_593.png",
    "unit_509":"ultimates/unit_509.png",
    "unit_594":"ultimates/unit_594.png",
    "unit_292":"ultimates/unit_292.png",
    "unit_332":"ultimates/unit_332.png",
    "unit_031":"ultimates/unit_031.png",
    "unit_311":"ultimates/unit_311.png",
    "unit_534":"ultimates/unit_534.png",
    "unit_535":"ultimates/unit_535.png",
    "unit_188":"ultimates/unit_188.png",
    "unit_397":"ultimates/unit_397.png",
    "unit_337":"ultimates/unit_337.png",
    "unit_162":"ultimates/unit_162.png",
    "unit_124":"ultimates/unit_124.png",
    "unit_010":"ultimates/unit_010.png",
    "unit_572":"ultimates/unit_572.png",
    "unit_573":"ultimates/unit_573.png",
    "unit_011":"ultimates/unit_011.png",
    "unit_207":"ultimates/unit_207.png",
    "unit_317":"ultimates/unit_317.png",
    "unit_359":"ultimates/unit_359.png",
    "unit_359-guild_23":"ultimates/unit_359-guild_23.png",
    "unit_585":"ultimates/unit_585.png",
    "unit_240":"ultimates/unit_240.png",
    "unit_169":"ultimates/unit_169.png",
    "unit_052":"ultimates/unit_052.png",
    "unit_542":"ultimates/unit_542.png",
    "unit_102":"ultimates/unit_102.png",
    "unit_323":"ultimates/unit_323.png",
    "unit_082":"ultimates/unit_082.png",
    "unit_090":"ultimates/unit_090.png",
    "unit_143":"ultimates/unit_143.png",
    "unit_427":"ultimates/unit_427.png",
    "unit_568":"ultimates/unit_568.png",
    "unit_567":"ultimates/unit_567.png",
    "unit_187":"ultimates/unit_187.png",
    "unit_215":"ultimates/unit_215.png",
    "unit_073":"ultimates/unit_073.png",
    "unit_073-unit_051":"ultimates/unit_073-unit_051.png",
    "unit_073-guild_08":"ultimates/unit_073-guild_08.png",
    "unit_150":"ultimates/unit_150.png",
    "unit_165":"ultimates/unit_165.png",
    "unit_225":"ultimates/unit_225.png",
    "unit_529":"ultimates/unit_529.png",
    "unit_330":"ultimates/unit_330.png",
    "unit_289":"ultimates/unit_289.png",
    "unit_379":"ultimates/unit_379.png",
    "unit_512":"ultimates/unit_512.png",
    "unit_513":"ultimates/unit_513.png",
    "unit_245":"ultimates/unit_245.png",
    "unit_356":"ultimates/unit_356.png",
    "unit_329":"ultimates/unit_329.png",
    "unit_438":"ultimates/unit_438.png",
    "unit_133":"ultimates/unit_133.png",
    "unit_382":"ultimates/unit_382.png",
    "unit_518":"ultimates/unit_518.png",
    "unit_519":"ultimates/unit_519.png",
    "unit_247":"ultimates/unit_247.png",
    "unit_087":"ultimates/unit_087.png",
    "unit_128":"ultimates/unit_128.png",
    "unit_154":"ultimates/unit_154.png",
    "unit_038":"ultimates/unit_038.png",
    "unit_361":"ultimates/unit_361.png",
    "unit_312":"ultimates/unit_312.png",
    "unit_532":"ultimates/unit_532.png",
    "unit_533":"ultimates/unit_533.png",
    "unit_591":"ultimates/unit_591.png",
    "unit_109":"ultimates/unit_109.png",
    "unit_496":"ultimates/unit_496.png",
    "unit_497":"ultimates/unit_497.png",
    "unit_183":"ultimates/unit_183.png",
    "unit_327":"ultimates/unit_327.png",
    "unit_022":"ultimates/unit_022.png",
    "unit_441":"ultimates/unit_441.png",
    "unit_299":"ultimates/unit_299.png",
    "unit_131":"ultimates/unit_131.png",
    "unit_530":"ultimates/unit_530.png",
    "unit_531":"ultimates/unit_531.png",
    "unit_083":"ultimates/unit_083.png",
    "unit_024":"ultimates/unit_024.png",
    "unit_019":"ultimates/unit_019.png",
    "unit_023":"ultimates/unit_023.png",
    "unit_237":"ultimates/unit_237.png",
    "unit_251":"ultimates/unit_251.png",
    "unit_251-guild_14":"ultimates/unit_251-guild_14.png",
    "unit_316":"ultimates/unit_316.png",
    "unit_309":"ultimates/unit_309.png",
    "unit_392":"ultimates/unit_392.png",
    "unit_076":"ultimates/unit_076.png",
    "unit_490":"ultimates/unit_490.png",
    "unit_491":"ultimates/unit_491.png",
    "unit_347":"ultimates/unit_347.png",
    "unit_138":"ultimates/unit_138.png",
    "unit_209":"ultimates/unit_209.png",
    "unit_399":"ultimates/unit_399.png",
    "unit_540":"ultimates/unit_540.png",
    "unit_269":"ultimates/unit_269.png",
    "unit_306":"ultimates/unit_306.png",
    "unit_270":"ultimates/unit_270.png",
    "unit_466":"ultimates/unit_466.png",
    "unit_103":"ultimates/unit_103.png",
    "unit_180":"ultimates/unit_180.png",
    "unit_460":"ultimates/unit_460.png",
    "unit_047":"ultimates/unit_047.png",
    "unit_047-guild_06":"ultimates/unit_047-guild_06.png",
    "unit_577":"ultimates/unit_577.png",
    "unit_047-guild_01":"ultimates/unit_047-guild_01.png",
    "unit_406":"ultimates/unit_406.png",
    "unit_405":"ultimates/unit_405.png",
    "unit_446":"ultimates/unit_446.png",
    "unit_589":"ultimates/unit_589.png",
    "unit_051":"ultimates/unit_051.png",
    "unit_539":"ultimates/unit_539.png",
    "unit_421":"ultimates/unit_421.png",
    "unit_196":"ultimates/unit_196.png",
    "unit_419":"ultimates/unit_419.png",
    "unit_243":"ultimates/unit_243.png",
    "unit_186":"ultimates/unit_186.png",
    "unit_069":"ultimates/unit_069.png",
    "unit_220":"ultimates/unit_220.png",
    "unit_279":"ultimates/unit_279.png",
    "unit_221":"ultimates/unit_221.png",
    "unit_189":"ultimates/unit_189.png",
    "unit_504":"ultimates/unit_504.png",
    "unit_505":"ultimates/unit_505.png",
    "unit_016":"ultimates/unit_016.png",
    "unit_574":"ultimates/unit_574.png",
    "unit_576":"ultimates/unit_576.png",
    "unit_575":"ultimates/unit_575.png",
    "unit_236":"ultimates/unit_236.png",
    "unit_146":"ultimates/unit_146.png",
    "unit_384":"ultimates/unit_384.png",
    "unit_522":"ultimates/unit_522.png",
    "unit_523":"ultimates/unit_523.png",
    "unit_147":"ultimates/unit_147.png",
    "unit_424":"ultimates/unit_424.png",
    "unit_564":"ultimates/unit_564.png",
    "unit_563":"ultimates/unit_563.png",
    "unit_554":"ultimates/unit_554.png",
    "unit_464":"ultimates/unit_464.png",
    "unit_415":"ultimates/unit_415.png",
    "unit_271":"ultimates/unit_271.png",
    "unit_418":"ultimates/unit_418.png",
    "unit_230":"ultimates/unit_230.png",
    "unit_508":"ultimates/unit_508.png",
    "unit_433":"ultimates/unit_433.png",
    "unit_300":"ultimates/unit_300.png",
    "unit_437":"ultimates/unit_437.png",
    "unit_416":"ultimates/unit_416.png",
    "unit_417":"ultimates/unit_417.png",
    "unit_389":"ultimates/unit_389.png",
    "unit_470":"ultimates/unit_470.png",
    "unit_553":"ultimates/unit_553.png",
    "unit_422":"ultimates/unit_422.png",
    "unit_035":"ultimates/unit_035.png",
    "unit_455":"ultimates/unit_455.png",
    "unit_055":"ultimates/unit_055.png",
    "unit_055-unit_051":"ultimates/unit_055-unit_051.png",
    "unit_413":"ultimates/unit_413.png",
    "unit_452":"ultimates/unit_452.png",
    "unit_431":"ultimates/unit_431.png",
    "unit_545":"ultimates/unit_545.png",
    "unit_350":"ultimates/unit_350.png",
    "unit_241":"ultimates/unit_241.png",
    "unit_232":"ultimates/unit_232.png",
    "unit_363":"ultimates/unit_363.png",
    "unit_586":"ultimates/unit_586.png",
    "unit_142":"ultimates/unit_142.png",
    "unit_148":"ultimates/unit_148.png",
    "unit_248":"ultimates/unit_248.png",
    "unit_045":"ultimates/unit_045.png",
    "unit_331":"ultimates/unit_331.png",
    "unit_335":"ultimates/unit_335.png",
    "unit_457":"ultimates/unit_457.png",
    "unit_556":"ultimates/unit_556.png",
    "unit_307":"ultimates/unit_307.png",
    "unit_176":"ultimates/unit_176.png",
    "unit_370":"ultimates/unit_370.png",
    "unit_212":"ultimates/unit_212.png",
    "unit_213":"ultimates/unit_213.png",
    "unit_414":"ultimates/unit_414.png",
    "unit_412":"ultimates/unit_412.png",
    "unit_463":"ultimates/unit_463.png",
    "unit_228":"ultimates/unit_228.png",
    "unit_313":"ultimates/unit_313.png",
    "unit_552":"ultimates/unit_552.png",
    "unit_217":"ultimates/unit_217.png",
    "unit_528":"ultimates/unit_528.png",
    "unit_394":"ultimates/unit_394.png",
    "unit_294":"ultimates/unit_294.png",
    "unit_344":"ultimates/unit_344.png",
    "unit_276":"ultimates/unit_276.png",
    "unit_354":"ultimates/unit_354.png",
    "unit_319":"ultimates/unit_319.png",
    "unit_536":"ultimates/unit_536.png",
    "unit_537":"ultimates/unit_537.png",
    "unit_084":"ultimates/unit_084.png",
    "unit_274":"ultimates/unit_274.png",
    "unit_182":"ultimates/unit_182.png",
    "unit_044":"ultimates/unit_044.png",
    "unit_167":"ultimates/unit_167.png",
    "unit_056":"ultimates/unit_056.png",
    "unit_056-guild_08":"ultimates/unit_056-guild_08.png",
    "unit_201":"ultimates/unit_201.png",
    "unit_156":"ultimates/unit_156.png",
    "unit_343":"ultimates/unit_343.png",
    "unit_355":"ultimates/unit_355.png",
    "unit_163":"ultimates/unit_163.png",
    "unit_111":"ultimates/unit_111.png",
    "unit_297":"ultimates/unit_297.png",
    "unit_451":"ultimates/unit_451.png",
    "unit_216":"ultimates/unit_216.png",
    "unit_381":"ultimates/unit_381.png",
    "unit_516":"ultimates/unit_516.png",
    "unit_517":"ultimates/unit_517.png",
    "unit_443":"ultimates/unit_443.png",
    "unit_353":"ultimates/unit_353.png",
    "unit_014":"ultimates/unit_014.png",
    "unit_015":"ultimates/unit_015.png",
    "unit_233":"ultimates/unit_233.png",
    "unit_238":"ultimates/unit_238.png",
    "unit_072":"ultimates/unit_072.png",
    "unit_293":"ultimates/unit_293.png",
    "unit_267":"ultimates/unit_267.png",
    "unit_200":"ultimates/unit_200.png",
    "unit_104":"ultimates/unit_104.png",
    "unit_260":"ultimates/unit_260.png",
    "unit_362":"ultimates/unit_362.png",
    "unit_583":"ultimates/unit_583.png",
    "unit_168":"ultimates/unit_168.png",
    "unit_117":"ultimates/unit_117.png",
    "unit_426":"ultimates/unit_426.png",
    "unit_566":"ultimates/unit_566.png",
    "unit_409":"ultimates/unit_409.png",
    "unit_214":"ultimates/unit_214.png",
    "unit_383":"ultimates/unit_383.png",
    "unit_520":"ultimates/unit_520.png",
    "unit_521":"ultimates/unit_521.png",
    "unit_095":"ultimates/unit_095.png",
    "unit_134":"ultimates/unit_134.png",
    "unit_430":"ultimates/unit_430.png",
    "unit_546":"ultimates/unit_546.png",
    "unit_151":"ultimates/unit_151.png",
    "unit_229":"ultimates/unit_229.png",
    "unit_074":"ultimates/unit_074.png",
    "unit_486":"ultimates/unit_486.png",
    "unit_487":"ultimates/unit_487.png",
    "unit_404":"ultimates/unit_404.png",
    "unit_352":"ultimates/unit_352.png",
    "unit_164":"ultimates/unit_164.png",
    "unit_324":"ultimates/unit_324.png",
    "unit_411":"ultimates/unit_411.png",
    "unit_018":"ultimates/unit_018.png",
    "unit_160":"ultimates/unit_160.png",
    "unit_086":"ultimates/unit_086.png",
    "unit_256":"ultimates/unit_256.png",
    "unit_315":"ultimates/unit_315.png",
    "unit_008":"ultimates/unit_008.png",
    "unit_570":"ultimates/unit_570.png",
    "unit_571":"ultimates/unit_571.png",
    "unit_009":"ultimates/unit_009.png",
    "unit_366":"ultimates/unit_366.png",
  });

  function loadSprite(id, presentation='base') {
    if(!/^[a-zA-Z0-9_-]+$/.test(id))return Promise.resolve(null);
    const path=presentation==='attack'&&id==="unit_007"
      ? "/art/characters/attacks/unit_007.png"
      : presentation==='ultimate'&&Object.hasOwn(ultimateAtlasManifest,id)
        ? '/art/characters/'+ultimateAtlasManifest[id]
        : '/art/characters/'+id+'.png';
    if(atlases.has(path))return atlases.get(path);
    const pending=new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(img.naturalWidth===img.naturalHeight*4?img:null);
      img.onerror=()=>{atlases.delete(path);resolve(null);};
      img.src=path;
    });
    atlases.set(path,pending);
    if(atlases.size>32)atlases.delete(atlases.keys().next().value);
    return pending;
  }



  function choreography(p,t,reduced=false) {
    t=clamp(t);
    const attack=between(t,.27,.73), returnHome=1-ease(between(t,.76,.99));
    const envelope=Math.sin(Math.PI*attack), reach=ease(attack/.38)*returnHome;
    const m={pose:t<.08||t>.94?0:t<.27||t>.76?1:2,travel:0,lift:0,angle:0,stretch:0,scale:1,echoes:0,alpha:1};
    if(reduced){m.pose=2;return m;}
    if(p.id==="unit_597"){
      const plunge=between(t,.38,.66);
      m.travel=.82*reach;m.lift=.24*Math.sin(Math.PI*plunge)*returnHome;
      m.angle=-.16*Math.sin(Math.PI*plunge);m.echoes=plunge>0&&plunge<1?2:0;
      return m;
    }
    if(p.id==="unit_598"){
      const fire=between(t,.32,.74);
      m.travel=-.12*envelope;m.scale=1+.10*envelope;
      m.angle=-.06*Math.sin(Math.PI*fire*4)*envelope;
      m.pose=t<.08||t>.94?0:t<.32?1:2;
      m.echoes=fire>0&&fire<1?1:0;
      return m;
    }
    if(p.id==="unit_581"){

      const charge=between(t,.08,.28), strike=between(t,.30,.75);
      const wave=Math.sin(Math.PI*strike*2);
      m.pose=t<.08||t>.94?0:t<.30?1:2;
      m.travel=.22*reach;m.scale=1+.18*envelope;
      m.angle=strike>0&&strike<1?wave*.12:-.06*Math.sin(Math.PI*charge);
      m.lift=Math.abs(wave)*envelope*.06;m.echoes=strike>0&&strike<1?2:0;
      return m;
    }
    if(p.id==="unit_007"&&p.normalAttack){
      m.travel=.72*ease(between(t,.31,.48))*returnHome;
      m.lift=.06*envelope;m.angle=-.08*envelope;
      return m;
    }
    if(p.id==="unit_007"){

      const grow=ease(between(t,.08,.32)), home=ease(between(t,.78,.98));
      const rise=ease(between(t,.28,.43)), slam=between(t,.52,.62)**3;
      m.scale=1+1.25*grow*(1-home);
      m.travel=.9*ease(between(t,.28,.48))*(1-home);
      const raised=rise*(1-slam)*(1-home);
      m.lift=.2*raised;
      m.angle=-.06*raised;
      m.pose=t<.08||t>.94?0:t<.55?1:2;
      return m;
    }
    if(p.id==="unit_001"){

      m.travel=.85*ease(between(t,.3,.44))*returnHome;
      if(t<.3)m.travel=-.09*Math.sin(Math.PI*between(t,.08,.3));
      m.angle=-.07*envelope;return m;
    }
    if(p.id==="unit_002"){

      m.pose=t<.08||t>.9?0:t<.34?1:2;
      m.travel=.92*ease(between(t,.34,.44))*(1-ease(between(t,.64,.9)));
      m.lift=.08*envelope;m.angle=-.13*envelope;
      m.echoes=t>=.34&&t<.64?2:0;return m;
    }
    if(p.id==="unit_003"){

      m.pose=t<.08||t>.94?0:t<.49?1:2;
      m.travel=.9*ease(between(t,.36,.55))*returnHome;
      m.lift=.12*ease(between(t,.2,.4))*(1-ease(between(t,.49,.58)))*returnHome;
      m.angle=t<.49?-.11*Math.sin(Math.PI*between(t,.08,.49)):.07*envelope;return m;
    }
    if(p.id==="unit_005"){

      m.pose=t<.08||t>.94?0:t<.37?1:2;
      m.travel=.86*ease(between(t,.37,.46))*returnHome;
      m.angle=.035*Math.sin(between(t,.37,.73)*Math.PI*4)*returnHome;
      m.echoes=t>.37&&t<.73?2:0;return m;
    }
    const moving=t>=.27&&t<=.76;
    const beat=attack*Math.min(6,p.count), pulse=Math.sin(Math.PI*(beat%1));
    switch(p.motion) {
      case 'barrage': case 'jet':
        m.travel=reach*(p.motion==='jet'?.65:.28);m.stretch=moving?pulse*.42:0;
        if(moving)m.pose=beat%1<.2?1:2;
        m.lift=p.motion==='jet'?envelope*.05:0;m.echoes=moving?2:0;break;
      case 'heavy':
        m.travel=reach*.78;m.angle=-.09*Math.sin(Math.PI*between(t,.08,.5));
        m.scale=1+envelope*.06;break;
      case 'bound':
        m.travel=reach*.76;m.lift=envelope*.22;m.angle=envelope*.12;m.echoes=moving?1:0;break;
      case 'dawn':
        m.travel=reach*.58;m.lift=envelope*.36;m.angle=-envelope*.16;
        m.stretch=moving?envelope*.5:0;m.echoes=moving?2:0;break;
      case 'sword':
        m.travel=reach*.86;m.angle=envelope*(p.angle*.4+.07);
        if(moving&&p.count>2)m.pose=beat%1<.14?1:2;
        m.echoes=moving?Math.min(2,p.count-1):0;break;
      case 'kick':
        m.travel=reach*.8;m.lift=envelope*.23;m.angle=-envelope*.48;m.echoes=moving?2:0;break;
      case 'ranged':
        m.travel=-envelope*.06;m.angle=-envelope*.05;
        if(moving)m.pose=beat%1<.2?1:2;break;
      case 'blink':
        m.travel=reach*.9;m.alpha=t>.23&&t<.3?1-between(t,.23,.3):t>=.3&&t<.37?between(t,.3,.37):1;
        m.echoes=moving?1:0;break;
      case 'flight':
        m.travel=reach*.72;m.lift=envelope*.4;m.angle=envelope*.14;m.echoes=moving?2:0;break;
      case 'pounce':
        m.travel=reach*.88;m.lift=envelope*.2;m.angle=envelope*.2;break;
      case 'cast':
        m.lift=envelope*.06;m.scale=1+envelope*.04;m.echoes=moving?1:0;break;
      default:
        m.travel=reach*.7;m.angle=envelope*.08;break;
    }
    if(t<.27)m.travel=-.025*Math.sin(Math.PI*between(t,.08,.27));
    return m;
  }

  function drawFrame(ctx,p,t,{width=1000,height=400,source=.22,target=.78,hit=true,reduced=false,sprite,actor,defender}={}) {
    ctx.clearRect(0,0,width,height);
    if(!sprite)return;
    const dir=target>=source?1:-1, m=choreography(p,t,reduced);
    const size=actor?.size||Math.min(height*.95,width*.48);
    const origin=actor?.x??source*width, floor=actor?.y??height*.94;
    const end=defender?.x??target*width;
    const distance=Math.max(0,Math.abs(end-origin)-size*.28);
    let x=origin+dir*distance*m.travel, y=floor-m.lift*size;
    const drawActor=(image,state,px,py,sz,alpha=1,direction=dir)=>{
      const unit=(image.naturalHeight||192);

      const angle=state.angle||0,scale=state.scale||1,cos=Math.cos(angle),sin=Math.sin(angle);
      const corners=[[-.5,-.9375],[.5,-.9375],[-.5,.0625],[.5,.0625]];
      const xs=corners.map(([x,y])=>(x*cos-y*sin)*scale*direction),ys=corners.map(([x,y])=>(x*sin+y*cos)*scale);
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      sz=Math.min(sz,(width-4)/(maxX-minX),(height-4)/(maxY-minY));
      px=Math.max(2-minX*sz,Math.min(width-2-maxX*sz,px));
      py=Math.max(2-minY*sz,Math.min(height-2-maxY*sz,py));
      ctx.save();ctx.globalAlpha=alpha;ctx.translate(px,py);ctx.scale(direction,1);ctx.rotate(state.angle||0);
      ctx.scale(state.scale||1,state.scale||1);ctx.imageSmoothingEnabled=false;
      const originX=-sz*.5,originY=-sz*.9375,frame=state.pose*unit;

      ctx.drawImage(image,frame,0,unit,unit,originX,originY,sz,sz);
      ctx.restore();
    };
    if(defender?.image){
      const stomp=p.id==="unit_007"&&!p.normalAttack;
      const reaction=hit&&!reduced?Math.sin(Math.PI*between(t,stomp?.62:.43,.82)):0;
      const ds=defender.size;
      drawActor(defender.image,{pose:reaction>0?3:0,angle:-reaction*.09},
        defender.x+dir*reaction*ds*(stomp?.12:.035),defender.y-(stomp?reaction*ds*.12:0),ds,1,-dir);
    }

    for(let i=m.echoes;i>0;i--){
      const past=choreography(p,Math.max(.27,t-i*.027));
      const ex=x-dir*Math.min(size*.12*i,Math.abs(m.travel)*distance*.2);
      drawActor(sprite,past,ex,y+i*size*.008,size,.12/i);
    }
    ctx.save();
    drawActor(sprite,m,x,y,size,m.alpha);
    ctx.restore();
  }


  function hide(sprite) {
    if(!sprite)return ()=>{};
    let state=hiddenSprites.get(sprite);
    if(!state){state={count:0,value:sprite.style.getPropertyValue('visibility'),priority:sprite.style.getPropertyPriority('visibility')};hiddenSprites.set(sprite,state);}
    state.count++;sprite.style.setProperty('visibility','hidden','important');
    return ()=>{if(--state.count)return;hiddenSprites.delete(sprite);
      if(state.value)sprite.style.setProperty('visibility',state.value,state.priority);else sprite.style.removeProperty('visibility');};
  }

  function play({profile,source,target=source,owner=source,valid=()=>true,unit_370=1,hit=true,preview=false,basic=false}) {
    if(!source?.isConnected||!target?.isConnected)return null;


    for(const scene of [...active.values()])if(scene.source===source){
      if(basic&&!scene.basic)return null;
      scene.cancel();
    }
    active.get(owner)?.cancel();while(active.size>=2)active.values().next().value.cancel();
    const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
    const visualProfile=basic&&profile.id==="unit_007"?{...profile,normalAttack:true}:profile;
    const sourceSprite=source.matches?.('.dex-sprite')?source:source.querySelector?.('.dex-sprite');
    const targetSprite=target!==source?target.querySelector?.('.dex-sprite'):null;
    const characterSpriteId=id=>typeof CHARS !== 'undefined'?CHARS[id]?.spriteId||id:id;

    const sourceId=sourceSprite?.dataset.spriteId || characterSpriteId(profile.id);
    const targetId=targetSprite?.dataset.spriteId || characterSpriteId(targetSprite?.dataset.character);
    const duration=reduced?650:(preview?2100:Math.max(850,1650/Math.max(1,unit_370)));
    const el=document.createElement('div');el.className='ultimate-scene';el.setAttribute('aria-hidden','true');
    el.dataset.character=profile.id;el.dataset.family=profile.family;el.dataset.motion=profile.motion;
    el.dataset.presentation=basic?'attack':'ultimate';
    el.style.setProperty('--ultimate-color',profile.color);
    const canvas=document.createElement('canvas');el.appendChild(canvas);
    const cutin=document.createElement('div');cutin.className='ultimate-cutin';
    const portraitId=sourceId;
    const portrait=document.createElement('img');portrait.alt='';portrait.src='/art/portraits/'+portraitId+'.png';portrait.onerror=()=>cutin.remove();
    cutin.appendChild(portrait);el.appendChild(cutin);
    const title=document.createElement('div');title.className='ultimate-technique';
    const name=document.createElement('span');name.textContent=profile.name;
    const technique=document.createElement('strong');technique.textContent=profile.technique;title.append(name,technique);el.appendChild(title);
    (source.closest('.overlay')||document.body).appendChild(el);
    let ctx;try{ctx=canvas.getContext('2d');}catch{el.remove();return null;}if(!ctx){el.remove();return null;}
    let sprite=null,enemyImage=null,ready=false,frame=0,timer=0,start=null,last=-100,closed=false;
    let finish;
    const finished = new Promise(resolve => { finish = resolve; });
    let restore=()=>{},restoreEnemy=()=>{};
    const cancel=()=>{if(closed)return;closed=true;cancelAnimationFrame(frame);clearTimeout(timer);restore();restoreEnemy();el.remove();if(active.get(owner)===handle)active.delete(owner);finish();};
    const handle={cancel,source,basic,finished};active.set(owner,handle);

    Promise.all([loadSprite(sourceId,basic?'attack':'ultimate'),targetId?loadSprite(targetId):null]).then(([own,enemy])=>{
      if(closed)return;if(!own){cancel();return;}sprite=own;enemyImage=enemy;ready=true;
      restore=hide(sourceSprite);if(enemy)restoreEnemy=hide(targetSprite);
    }).catch(cancel);
    const tick=now=>{
      if(closed)return;
      try{
        if(!source.isConnected||!target.isConnected||document.hidden||!valid()){cancel();return;}
        if(!ready){frame=requestAnimationFrame(tick);return;}
        if(start===null){start=now;clearTimeout(timer);timer=setTimeout(cancel,duration+250);}
        const progress=clamp((now-start)/duration);if(progress>=1){cancel();return;}
        if(now-last>=1000/40){
          last=now;
          const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
          const ar=sourceSprite?.getBoundingClientRect()||a,br=targetSprite?.getBoundingClientRect()||b;
          const stageLeft=Math.min(a.left,b.left,ar.left,br.left),stageRight=Math.max(a.right,b.right,ar.right,br.right);
          const left=Math.max(0,stageLeft-40),right=Math.min(innerWidth,stageRight+40);
          const headroom=profile.id==="unit_007"&&!basic&&!reduced?ar.height*1.5:40;
          const top=Math.max(0,Math.min(a.top,b.top,ar.top,br.top)-headroom),bottom=Math.min(innerHeight,Math.max(a.bottom,b.bottom,ar.bottom,br.bottom)+12);
          const width=right-left,height=bottom-top;if(width<24||height<24){cancel();return;}
          Object.assign(el.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
          const dpr=Math.min(1.5,globalThis.devicePixelRatio||1),cw=Math.round(Math.min(1600,width*dpr)),ch=Math.round(Math.min(900,height*dpr));
          if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}

          ctx.setTransform(cw/width,0,0,ch/height,0,0);
          const actor={x:ar.left+ar.width/2-left,y:ar.bottom-ar.height*.0625-top,size:ar.width};
          const defender=enemyImage?{image:enemyImage,x:br.left+br.width/2-left,y:br.bottom-br.height*.0625-top,size:br.width}:null;
          const from=preview ? .22:clamp((actor.x)/width),to=preview ? .78:clamp((b.left+b.width/2-left)/width);
          if(preview){actor.size=Math.min(actor.size,width*.56,height*.92);actor.x=width*.3;actor.y=height*.93;}
          drawFrame(ctx,visualProfile,reduced ? .58:progress,{width,height,source:from,target:to,hit,reduced,sprite,actor,defender});
          title.style.opacity=String(basic?0:Math.min(1,progress/.08,clamp((.42-progress)/.1)));
          cutin.style.opacity=String(reduced||basic?0:clamp(progress/.06)*clamp((.32-progress)/.08));
          cutin.style.transform=`translateX(${(1-ease(progress/.14))*(from<to?-22:22)}px)`;
          cutin.style.left=from<to?'0':'auto';cutin.style.right=from<to?'auto':'0';
          el.dataset.phase=progress<.27?'prepare':progress<.76?'attack':'return';
        }
        frame=requestAnimationFrame(tick);
      }catch{cancel();}
    };
    timer=setTimeout(cancel,4000);frame=requestAnimationFrame(tick);return handle;
  }
  const cancelAll=()=>{for(const h of [...active.values()])h.cancel();};
  globalThis.addEventListener?.('pagehide',cancelAll);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAll();});
  globalThis.UltimateFX=Object.freeze({play,drawFrame,choreography,loadSprite,cancelAll,handlesSprites:true});
})();
