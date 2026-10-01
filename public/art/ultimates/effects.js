/* Sprite choreography only: every attack pixel comes from the character's atlas. */
(() => {
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,x)), ease=x=>1-(1-clamp(x))**3;
  const active=new Map(), atlases=new Map(), hiddenSprites=new Map();
  const between=(t,a,b)=>clamp((t-a)/(b-a));
  // Register only reviewed, genuinely distinct ultimate atlases here.
  // Keys are sprite IDs; an unlisted character keeps its existing four-pose atlas.
  const ultimateAtlasManifest=Object.freeze({
    "abdullah":"ultimates/abdullah.png",
    "absalom":"ultimates/absalom.png",
    "ace":"ultimates/ace.png",
    "aisa":"ultimates/aisa.png",
    "akainu":"ultimates/akainu.png",
    "aladine":"ultimates/aladine.png",
    "alvida":"ultimates/alvida.png",
    "amande":"ultimates/amande.png",
    "anana":"ultimates/anana.png",
    "ange":"ultimates/ange.png",
    "aokiji":"ultimates/aokiji.png",
    "aokiji-blackbeard":"ultimates/aokiji-blackbeard.png",
    "apoo":"ultimates/apoo.png",
    "arlong":"ultimates/arlong.png",
    "ashuradoji":"ultimates/ashuradoji.png",
    "atlas":"ultimates/atlas.png",
    "atmos":"ultimates/atmos.png",
    "babanuki":"ultimates/babanuki.png",
    "baby5":"ultimates/baby5.png",
    "bakkin":"ultimates/bakkin.png",
    "bakkin-young":"ultimates/bakkin-young.png",
    "bandido":"ultimates/bandido.png",
    "baohuang":"ultimates/baohuang.png",
    "bartolomeo":"ultimates/bartolomeo.png",
    "batman":"ultimates/batman.png",
    "bavarois":"ultimates/bavarois.png",
    "bege":"ultimates/bege.png",
    "bellamy":"ultimates/bellamy.png",
    "bellemere":"ultimates/bellemere.png",
    "benn":"ultimates/benn.png",
    "bentham":"ultimates/bentham.png",
    "bepo":"ultimates/bepo.png",
    "bepo-sulong":"ultimates/bepo-sulong.png",
    "betty":"ultimates/betty.png",
    "biblo":"ultimates/biblo.png",
    "bigmom":"ultimates/bigmom.png",
    "bigmom-young":"ultimates/bigmom-young.png",
    "blackback":"ultimates/blackback.png",
    "blackback-sulong":"ultimates/blackback-sulong.png",
    "blackmaria":"ultimates/blackmaria.png",
    "blackmaria-animal":"ultimates/blackmaria-animal.png",
    "blackmaria-hybrid":"ultimates/blackmaria-hybrid.png",
    "blamenco":"ultimates/blamenco.png",
    "blenheim":"ultimates/blenheim.png",
    "bluegilly":"ultimates/bluegilly.png",
    "blueno":"ultimates/blueno.png",
    "bobbin":"ultimates/bobbin.png",
    "bogard":"ultimates/bogard.png",
    "bogard-young":"ultimates/bogard-young.png",
    "bonney":"ultimates/bonney.png",
    "bonney-nika":"ultimates/bonney-nika.png",
    "boo":"ultimates/boo.png",
    "boodle":"ultimates/boodle.png",
    "braham":"ultimates/braham.png",
    "brandnew":"ultimates/brandnew.png",
    "brogy":"ultimates/brogy.png",
    "brook":"ultimates/brook.png",
    "brownbeard":"ultimates/brownbeard.png",
    "brulee":"ultimates/brulee.png",
    "buffalo":"ultimates/buffalo.png",
    "buggy":"ultimates/buggy.png",
    "buggy-crossguild":"ultimates/buggy-crossguild.png",
    "buggy-roger":"ultimates/buggy-roger.png",
    "burgess":"ultimates/burgess.png",
    "cabaji":"ultimates/cabaji.png",
    "caesar":"ultimates/caesar.png",
    "camie":"ultimates/camie.png",
    "carnecook":"ultimates/carnecook.png",
    "carrot":"ultimates/carrot.png",
    "carrot-sulong":"ultimates/carrot-sulong.png",
    "cavendish":"ultimates/cavendish.png",
    "chaka":"ultimates/chaka.png",
    "chaka-animal":"ultimates/chaka-animal.png",
    "chaka-hybrid":"ultimates/chaka-hybrid.png",
    "charlos":"ultimates/charlos.png",
    "chess":"ultimates/chess.png",
    "chiffon":"ultimates/chiffon.png",
    "chimney":"ultimates/chimney.png",
    "chinjao":"ultimates/chinjao.png",
    "chopper":"ultimates/chopper.png",
    "chopper-animal":"ultimates/chopper-animal.png",
    "chopper-hybrid":"ultimates/chopper-hybrid.png",
    "chopper-monster":"ultimates/chopper-monster.png",
    "chouchou":"ultimates/chouchou.png",
    "chuu":"ultimates/chuu.png",
    "cindry":"ultimates/cindry.png",
    "cobra":"ultimates/cobra.png",
    "coby":"ultimates/coby.png",
    "coby2":"ultimates/coby2.png",
    "cocinapirata":"ultimates/cocinapirata.png",
    "colon":"ultimates/colon.png",
    "columbus":"ultimates/columbus.png",
    "concelot":"ultimates/concelot.png",
    "concelot-sulong":"ultimates/concelot-sulong.png",
    "conis":"ultimates/conis.png",
    "cosette":"ultimates/cosette.png",
    "cracker":"ultimates/cracker.png",
    "cricket":"ultimates/cricket.png",
    "crocodile":"ultimates/crocodile.png",
    "crocodile-baroque":"ultimates/crocodile-baroque.png",
    "crocodile-crossguild":"ultimates/crocodile-crossguild.png",
    "crocus":"ultimates/crocus.png",
    "curiel":"ultimates/curiel.png",
    "dadan":"ultimates/dadan.png",
    "dagama":"ultimates/dagama.png",
    "daifugo":"ultimates/daifugo.png",
    "daifuku":"ultimates/daifuku.png",
    "dalton":"ultimates/dalton.png",
    "dalton-animal":"ultimates/dalton-animal.png",
    "dalton-hybrid":"ultimates/dalton-hybrid.png",
    "daruma":"ultimates/daruma.png",
    "dazbones":"ultimates/dazbones.png",
    "dazbones-crossguild":"ultimates/dazbones-crossguild.png",
    "decken":"ultimates/decken.png",
    "dellinger":"ultimates/dellinger.png",
    "den":"ultimates/den.png",
    "denjiro":"ultimates/denjiro.png",
    "devon":"ultimates/devon.png",
    "devon-animal":"ultimates/devon-animal.png",
    "devon-hybrid":"ultimates/devon-hybrid.png",
    "diamante":"ultimates/diamante.png",
    "disco":"ultimates/disco.png",
    "doberman":"ultimates/doberman.png",
    "dobon":"ultimates/dobon.png",
    "docq":"ultimates/docq.png",
    "doflamingo":"ultimates/doflamingo.png",
    "dogra":"ultimates/dogra.png",
    "domino":"ultimates/domino.png",
    "dorry":"ultimates/dorry.png",
    "dosun":"ultimates/dosun.png",
    "dragon":"ultimates/dragon.png",
    "dragon-young":"ultimates/dragon-young.png",
    "drake":"ultimates/drake.png",
    "drake-animal":"ultimates/drake-animal.png",
    "drake-beasts":"ultimates/drake-beasts.png",
    "drake-hybrid":"ultimates/drake-hybrid.png",
    "duval":"ultimates/duval.png",
    "edison":"ultimates/edison.png",
    "elizabello":"ultimates/elizabello.png",
    "emeth":"ultimates/emeth.png",
    "enel":"ultimates/enel.png",
    "fishertiger":"ultimates/fishertiger.png",
    "flampe":"ultimates/flampe.png",
    "fossa":"ultimates/fossa.png",
    "franky":"ultimates/franky.png",
    "franky-shogun":"ultimates/franky-shogun.png",
    "fugan":"ultimates/fugan.png",
    "fujitora":"ultimates/fujitora.png",
    "fukaboshi":"ultimates/fukaboshi.png",
    "fukuro":"ultimates/fukuro.png",
    "fukurokuju":"ultimates/fukurokuju.png",
    "fullbody":"ultimates/fullbody.png",
    "gaban":"ultimates/gaban.png",
    "gaban-young":"ultimates/gaban-young.png",
    "gaimon":"ultimates/gaimon.png",
    "galdino":"ultimates/galdino.png",
    "galdino-crossguild":"ultimates/galdino-crossguild.png",
    "galette":"ultimates/galette.png",
    "gambia":"ultimates/gambia.png",
    "ganfall":"ultimates/ganfall.png",
    "garling":"ultimates/garling.png",
    "garling-young":"ultimates/garling-young.png",
    "garp":"ultimates/garp.png",
    "garp-young":"ultimates/garp-young.png",
    "gazelleman":"ultimates/gazelleman.png",
    "gedatsu":"ultimates/gedatsu.png",
    "gem":"ultimates/gem.png",
    "genbo":"ultimates/genbo.png",
    "genzo":"ultimates/genzo.png",
    "gerd":"ultimates/gerd.png",
    "gin":"ultimates/gin.png",
    "ginny":"ultimates/ginny.png",
    "ginny-young":"ultimates/ginny-young.png",
    "ginrummy":"ultimates/ginrummy.png",
    "giovanni":"ultimates/giovanni.png",
    "giovanni-sulong":"ultimates/giovanni-sulong.png",
    "gladius":"ultimates/gladius.png",
    "gloriosa":"ultimates/gloriosa.png",
    "gloriosa-young":"ultimates/gloriosa-young.png",
    "goki":"ultimates/goki.png",
    "goldberg":"ultimates/goldberg.png",
    "gonbe":"ultimates/gonbe.png",
    "gunko":"ultimates/gunko.png",
    "gunko-young":"ultimates/gunko-young.png",
    "gyojin":"ultimates/gyojin.png",
    "hachi":"ultimates/hachi.png",
    "hachi-sun":"ultimates/hachi-sun.png",
    "hack":"ultimates/hack.png",
    "hajrudin":"ultimates/hajrudin.png",
    "hammond":"ultimates/hammond.png",
    "hancock":"ultimates/hancock.png",
    "hannyabal":"ultimates/hannyabal.png",
    "harald":"ultimates/harald.png",
    "haruta":"ultimates/haruta.png",
    "hawkins":"ultimates/hawkins.png",
    "helmeppo":"ultimates/helmeppo.png",
    "hera":"ultimates/hera.png",
    "higuma":"ultimates/higuma.png",
    "hildon":"ultimates/hildon.png",
    "hina":"ultimates/hina.png",
    "hiriluk":"ultimates/hiriluk.png",
    "hitetsu":"ultimates/hitetsu.png",
    "hiyori":"ultimates/hiyori.png",
    "hody":"ultimates/hody.png",
    "hogback":"ultimates/hogback.png",
    "holdem":"ultimates/holdem.png",
    "homing":"ultimates/homing.png",
    "hyogoro":"ultimates/hyogoro.png",
    "hyouzou":"ultimates/hyouzou.png",
    "iceburg":"ultimates/iceburg.png",
    "ichiji":"ultimates/ichiji.png",
    "ideo":"ultimates/ideo.png",
    "igaram":"ultimates/igaram.png",
    "ikaros":"ultimates/ikaros.png",
    "im":"ultimates/im.png",
    "im-gunko":"ultimates/im-gunko.png",
    "im-revealed":"ultimates/im-revealed.png",
    "inazuma":"ultimates/inazuma.png",
    "inuarashi":"ultimates/inuarashi.png",
    "inuarashi-kozuki":"ultimates/inuarashi-kozuki.png",
    "inuarashi-sulong":"ultimates/inuarashi-sulong.png",
    "ipponmatsu":"ultimates/ipponmatsu.png",
    "ivankov":"ultimates/ivankov.png",
    "ivankov-female":"ultimates/ivankov-female.png",
    "ivankov-young":"ultimates/ivankov-young.png",
    "izo":"ultimates/izo.png",
    "izo-kozuki":"ultimates/izo-kozuki.png",
    "jabra":"ultimates/jabra.png",
    "jabra-animal":"ultimates/jabra-animal.png",
    "jabra-hybrid":"ultimates/jabra-hybrid.png",
    "jack":"ultimates/jack.png",
    "jack-animal":"ultimates/jack-animal.png",
    "jack-hybrid":"ultimates/jack-hybrid.png",
    "jaki":"ultimates/jaki.png",
    "jango":"ultimates/jango.png",
    "jarul":"ultimates/jarul.png",
    "jeanbart":"ultimates/jeanbart.png",
    "jeet":"ultimates/jeet.png",
    "jinbe":"ultimates/jinbe.png",
    "jinbe-sun":"ultimates/jinbe-sun.png",
    "john":"ultimates/john.png",
    "john-young":"ultimates/john-young.png",
    "johngiant":"ultimates/johngiant.png",
    "johnny":"ultimates/johnny.png",
    "jora":"ultimates/jora.png",
    "joyboy":"ultimates/joyboy.png",
    "jozu":"ultimates/jozu.png",
    "judge":"ultimates/judge.png",
    "jupeter":"ultimates/jupeter.png",
    "jupeter-beast":"ultimates/jupeter-beast.png",
    "kaido":"ultimates/kaido.png",
    "kaido-animal":"ultimates/kaido-animal.png",
    "kaido-hybrid":"ultimates/kaido-hybrid.png",
    "kaido-young":"ultimates/kaido-young.png",
    "kaku":"ultimates/kaku.png",
    "kaku-animal":"ultimates/kaku-animal.png",
    "kaku-awakened":"ultimates/kaku-awakened.png",
    "kaku-hybrid":"ultimates/kaku-hybrid.png",
    "kalgara":"ultimates/kalgara.png",
    "kalifa":"ultimates/kalifa.png",
    "kamakiri":"ultimates/kamakiri.png",
    "kanjuro":"ultimates/kanjuro.png",
    "karasu":"ultimates/karasu.png",
    "karoo":"ultimates/karoo.png",
    "kashi":"ultimates/kashi.png",
    "katakuri":"ultimates/katakuri.png",
    "kawamatsu":"ultimates/kawamatsu.png",
    "kaya":"ultimates/kaya.png",
    "kid":"ultimates/kid.png",
    "kiku":"ultimates/kiku.png",
    "killer":"ultimates/killer.png",
    "killingham":"ultimates/killingham.png",
    "killingham-animal":"ultimates/killingham-animal.png",
    "killingham-hybrid":"ultimates/killingham-hybrid.png",
    "kinemon":"ultimates/kinemon.png",
    "king":"ultimates/king.png",
    "king-animal":"ultimates/king-animal.png",
    "king-hybrid":"ultimates/king-hybrid.png",
    "kingbaum":"ultimates/kingbaum.png",
    "kingdew":"ultimates/kingdew.png",
    "kiwi":"ultimates/kiwi.png",
    "kizaru":"ultimates/kizaru.png",
    "koala":"ultimates/koala.png",
    "kohza":"ultimates/kohza.png",
    "kokoro":"ultimates/kokoro.png",
    "koushirou":"ultimates/koushirou.png",
    "krieg":"ultimates/krieg.png",
    "kuina":"ultimates/kuina.png",
    "kuma":"ultimates/kuma.png",
    "kuma-young":"ultimates/kuma-young.png",
    "kumadori":"ultimates/kumadori.png",
    "kumashi":"ultimates/kumashi.png",
    "kureha":"ultimates/kureha.png",
    "kuro":"ultimates/kuro.png",
    "kuromarimo":"ultimates/kuromarimo.png",
    "kuroobi":"ultimates/kuroobi.png",
    "kyros":"ultimates/kyros.png",
    "lafitte":"ultimates/lafitte.png",
    "laog":"ultimates/laog.png",
    "law":"ultimates/law.png",
    "law-donquixote":"ultimates/law-donquixote.png",
    "leo":"ultimates/leo.png",
    "lili":"ultimates/lili.png",
    "lilith":"ultimates/lilith.png",
    "lindbergh":"ultimates/lindbergh.png",
    "loki":"ultimates/loki.png",
    "loki-animal":"ultimates/loki-animal.png",
    "lola":"ultimates/lola.png",
    "lucci":"ultimates/lucci.png",
    "lucci-animal":"ultimates/lucci-animal.png",
    "lucci-awakened":"ultimates/lucci-awakened.png",
    "lucci-hybrid":"ultimates/lucci-hybrid.png",
    "luckyroux":"ultimates/luckyroux.png",
    "luffy":"ultimates/luffy.png",
    "luffy2":"ultimates/luffy2.png",
    "luffy3":"ultimates/luffy3.png",
    "luffy4":"ultimates/luffy4.png",
    "luffy4-boundman":"ultimates/luffy4-boundman.png",
    "luffy4-tankman":"ultimates/luffy4-tankman.png",
    "lulu":"ultimates/lulu.png",
    "machvise":"ultimates/machvise.png",
    "magellan":"ultimates/magellan.png",
    "magra":"ultimates/magra.png",
    "makino":"ultimates/makino.png",
    "manboshi":"ultimates/manboshi.png",
    "mansherry":"ultimates/mansherry.png",
    "marco":"ultimates/marco.png",
    "marco-animal":"ultimates/marco-animal.png",
    "marco-hybrid":"ultimates/marco-hybrid.png",
    "marguerite":"ultimates/marguerite.png",
    "marianne":"ultimates/marianne.png",
    "marigold":"ultimates/marigold.png",
    "marigold-animal":"ultimates/marigold-animal.png",
    "marigold-hybrid":"ultimates/marigold-hybrid.png",
    "marineraso":"ultimates/marineraso.png",
    "mars":"ultimates/mars.png",
    "mars-beast":"ultimates/mars-beast.png",
    "masira":"ultimates/masira.png",
    "merry":"ultimates/merry.png",
    "merrychristmas":"ultimates/merrychristmas.png",
    "merrychristmas-animal":"ultimates/merrychristmas-animal.png",
    "merrychristmas-hybrid":"ultimates/merrychristmas-hybrid.png",
    "mihawk":"ultimates/mihawk.png",
    "mikita":"ultimates/mikita.png",
    "minotauros":"ultimates/minotauros.png",
    "miyagi":"ultimates/miyagi.png",
    "mjosgard":"ultimates/mjosgard.png",
    "mocha":"ultimates/mocha.png",
    "mohji":"ultimates/mohji.png",
    "momonga":"ultimates/momonga.png",
    "momonosuke":"ultimates/momonosuke.png",
    "momonosuke-adult":"ultimates/momonosuke-adult.png",
    "momonosuke-animal":"ultimates/momonosuke-animal.png",
    "momonosuke-dragon":"ultimates/momonosuke-dragon.png",
    "monet":"ultimates/monet.png",
    "montdor":"ultimates/montdor.png",
    "morgan":"ultimates/morgan.png",
    "morgans":"ultimates/morgans.png",
    "morgans-animal":"ultimates/morgans-animal.png",
    "morgans-hybrid":"ultimates/morgans-hybrid.png",
    "moria":"ultimates/moria.png",
    "morley":"ultimates/morley.png",
    "moscato":"ultimates/moscato.png",
    "mozu":"ultimates/mozu.png",
    "mr4":"ultimates/mr4.png",
    "nami":"ultimates/nami.png",
    "nami-sorcery":"ultimates/nami-sorcery.png",
    "nami-zeus":"ultimates/nami-zeus.png",
    "nami2":"ultimates/nami2.png",
    "namur":"ultimates/namur.png",
    "napoleon":"ultimates/napoleon.png",
    "nekomamushi":"ultimates/nekomamushi.png",
    "nekomamushi-kozuki":"ultimates/nekomamushi-kozuki.png",
    "nekomamushi-sulong":"ultimates/nekomamushi-sulong.png",
    "neptune":"ultimates/neptune.png",
    "nero":"ultimates/nero.png",
    "newgate":"ultimates/newgate.png",
    "newgate-young":"ultimates/newgate-young.png",
    "nezumi":"ultimates/nezumi.png",
    "niji":"ultimates/niji.png",
    "ninjin":"ultimates/ninjin.png",
    "nojiko":"ultimates/nojiko.png",
    "noland":"ultimates/noland.png",
    "nusjuro":"ultimates/nusjuro.png",
    "nusjuro-beast":"ultimates/nusjuro-beast.png",
    "nusjuro-hybrid":"ultimates/nusjuro-hybrid.png",
    "oars":"ultimates/oars.png",
    "oarsjr":"ultimates/oarsjr.png",
    "oden":"ultimates/oden.png",
    "oden-roger":"ultimates/oden-roger.png",
    "oden-whitebeard":"ultimates/oden-whitebeard.png",
    "ohm":"ultimates/ohm.png",
    "oimo":"ultimates/oimo.png",
    "onigumo":"ultimates/onigumo.png",
    "onigumo-hybrid":"ultimates/onigumo-hybrid.png",
    "opera":"ultimates/opera.png",
    "orlumbus":"ultimates/orlumbus.png",
    "orochi":"ultimates/orochi.png",
    "orochi-animal":"ultimates/orochi-animal.png",
    "orochi-hybrid":"ultimates/orochi-hybrid.png",
    "otohime":"ultimates/otohime.png",
    "otsuru2":"ultimates/otsuru2.png",
    "oven":"ultimates/oven.png",
    "pacifista":"ultimates/pacifista.png",
    "pagaya":"ultimates/pagaya.png",
    "pageone":"ultimates/pageone.png",
    "pageone-animal":"ultimates/pageone-animal.png",
    "pageone-hybrid":"ultimates/pageone-hybrid.png",
    "pappag":"ultimates/pappag.png",
    "patty":"ultimates/patty.png",
    "paula":"ultimates/paula.png",
    "paulie":"ultimates/paulie.png",
    "pearl":"ultimates/pearl.png",
    "pedro":"ultimates/pedro.png",
    "pekoms":"ultimates/pekoms.png",
    "pekoms-animal":"ultimates/pekoms-animal.png",
    "pekoms-hybrid":"ultimates/pekoms-hybrid.png",
    "pekoms-sulong":"ultimates/pekoms-sulong.png",
    "pell":"ultimates/pell.png",
    "pell-animal":"ultimates/pell-animal.png",
    "pell-hybrid":"ultimates/pell-hybrid.png",
    "perona":"ultimates/perona.png",
    "perospero":"ultimates/perospero.png",
    "pescador":"ultimates/pescador.png",
    "peterman":"ultimates/peterman.png",
    "pica":"ultimates/pica.png",
    "pierre":"ultimates/pierre.png",
    "pierre-animal":"ultimates/pierre-animal.png",
    "pierre-hybrid":"ultimates/pierre-hybrid.png",
    "piiman":"ultimates/piiman.png",
    "piratagato":"ultimates/piratagato.png",
    "piratanovato":"ultimates/piratanovato.png",
    "piratapayaso":"ultimates/piratapayaso.png",
    "pizarro":"ultimates/pizarro.png",
    "praline":"ultimates/praline.png",
    "praline-sun":"ultimates/praline-sun.png",
    "prometheus":"ultimates/prometheus.png",
    "pudding":"ultimates/pudding.png",
    "pythagoras":"ultimates/pythagoras.png",
    "queen":"ultimates/queen.png",
    "queen-animal":"ultimates/queen-animal.png",
    "queen-hybrid":"ultimates/queen-hybrid.png",
    "raizo":"ultimates/raizo.png",
    "raki":"ultimates/raki.png",
    "rakuyo":"ultimates/rakuyo.png",
    "rayleigh":"ultimates/rayleigh.png",
    "rayleigh-young":"ultimates/rayleigh-young.png",
    "rebecca":"ultimates/rebecca.png",
    "reiju":"ultimates/reiju.png",
    "rikudold":"ultimates/rikudold.png",
    "ripley":"ultimates/ripley.png",
    "ripper":"ultimates/ripper.png",
    "risky":"ultimates/risky.png",
    "road":"ultimates/road.png",
    "robin":"ultimates/robin.png",
    "robin-baroque":"ultimates/robin-baroque.png",
    "robin-demoniofleur":"ultimates/robin-demoniofleur.png",
    "robin-straw":"ultimates/robin-straw.png",
    "rocinante":"ultimates/rocinante.png",
    "rockstar":"ultimates/rockstar.png",
    "roddy":"ultimates/roddy.png",
    "roddy-sulong":"ultimates/roddy-sulong.png",
    "roger":"ultimates/roger.png",
    "roger-young":"ultimates/roger-young.png",
    "rosward":"ultimates/rosward.png",
    "rouge":"ultimates/rouge.png",
    "ryokugyu":"ultimates/ryokugyu.png",
    "ryuboshi":"ultimates/ryuboshi.png",
    "ryuma":"ultimates/ryuma.png",
    "sabo":"ultimates/sabo.png",
    "sadie":"ultimates/sadie.png",
    "sai":"ultimates/sai.png",
    "saldeath":"ultimates/saldeath.png",
    "sandersonia":"ultimates/sandersonia.png",
    "sandersonia-animal":"ultimates/sandersonia-animal.png",
    "sandersonia-hybrid":"ultimates/sandersonia-hybrid.png",
    "sanji":"ultimates/sanji.png",
    "sanji-diable":"ultimates/sanji-diable.png",
    "sanji-ifrit":"ultimates/sanji-ifrit.png",
    "sanji-raid":"ultimates/sanji-raid.png",
    "sanjuanwolf":"ultimates/sanjuanwolf.png",
    "sarquiss":"ultimates/sarquiss.png",
    "sasaki":"ultimates/sasaki.png",
    "sasaki-animal":"ultimates/sasaki-animal.png",
    "sasaki-hybrid":"ultimates/sasaki-hybrid.png",
    "satori":"ultimates/satori.png",
    "saturn":"ultimates/saturn.png",
    "saturn-beast":"ultimates/saturn-beast.png",
    "saturn-hybrid":"ultimates/saturn-hybrid.png",
    "saturn-young":"ultimates/saturn-young.png",
    "saul":"ultimates/saul.png",
    "sbear":"ultimates/sbear.png",
    "scarlett":"ultimates/scarlett.png",
    "scroc":"ultimates/scroc.png",
    "sengoku":"ultimates/sengoku.png",
    "sengoku-animal":"ultimates/sengoku-animal.png",
    "sengoku2":"ultimates/sengoku2.png",
    "senorpink":"ultimates/senorpink.png",
    "sentomaru":"ultimates/sentomaru.png",
    "sflamingo":"ultimates/sflamingo.png",
    "sgecko":"ultimates/sgecko.png",
    "shaka":"ultimates/shaka.png",
    "shakky":"ultimates/shakky.png",
    "shakky-young":"ultimates/shakky-young.png",
    "shalria":"ultimates/shalria.png",
    "sham":"ultimates/sham.png",
    "shamrock":"ultimates/shamrock.png",
    "shanks":"ultimates/shanks.png",
    "shanks-roger":"ultimates/shanks-roger.png",
    "shawk":"ultimates/shawk.png",
    "sheepshead":"ultimates/sheepshead.png",
    "shiki":"ultimates/shiki.png",
    "shiki-young":"ultimates/shiki-young.png",
    "shinobu":"ultimates/shinobu.png",
    "shirahoshi":"ultimates/shirahoshi.png",
    "shiryu":"ultimates/shiryu.png",
    "shishilian":"ultimates/shishilian.png",
    "shishilian-sulong":"ultimates/shishilian-sulong.png",
    "shoujou":"ultimates/shoujou.png",
    "shura":"ultimates/shura.png",
    "shyarly":"ultimates/shyarly.png",
    "smoker":"ultimates/smoker.png",
    "smoothie":"ultimates/smoothie.png",
    "snack":"ultimates/snack.png",
    "sommers":"ultimates/sommers.png",
    "sommers-young":"ultimates/sommers-young.png",
    "sora":"ultimates/sora.png",
    "spandam":"ultimates/spandam.png",
    "speed":"ultimates/speed.png",
    "speedjiru":"ultimates/speedjiru.png",
    "squard":"ultimates/squard.png",
    "sshark":"ultimates/sshark.png",
    "ssnake":"ultimates/ssnake.png",
    "stansen":"ultimates/stansen.png",
    "strawberry":"ultimates/strawberry.png",
    "streusen":"ultimates/streusen.png",
    "streusen-young":"ultimates/streusen-young.png",
    "stronger":"ultimates/stronger.png",
    "stronger-animal":"ultimates/stronger-animal.png",
    "stussy":"ultimates/stussy.png",
    "sugar":"ultimates/sugar.png",
    "sukiyaki":"ultimates/sukiyaki.png",
    "suleiman":"ultimates/suleiman.png",
    "tama":"ultimates/tama.png",
    "tamago":"ultimates/tamago.png",
    "tamago-animal":"ultimates/tamago-animal.png",
    "tamago-hybrid":"ultimates/tamago-hybrid.png",
    "tamanegi":"ultimates/tamanegi.png",
    "tanklepanto":"ultimates/tanklepanto.png",
    "tararan":"ultimates/tararan.png",
    "tashigi":"ultimates/tashigi.png",
    "tbone":"ultimates/tbone.png",
    "teach":"ultimates/teach.png",
    "teach-whitebeard":"ultimates/teach-whitebeard.png",
    "thatch":"ultimates/thatch.png",
    "tilestone":"ultimates/tilestone.png",
    "toki":"ultimates/toki.png",
    "toko":"ultimates/toko.png",
    "tom":"ultimates/tom.png",
    "toto":"ultimates/toto.png",
    "trebol":"ultimates/trebol.png",
    "tristan":"ultimates/tristan.png",
    "tsuru":"ultimates/tsuru.png",
    "ulti":"ultimates/ulti.png",
    "ulti-animal":"ultimates/ulti-animal.png",
    "ulti-hybrid":"ultimates/ulti-hybrid.png",
    "urouge":"ultimates/urouge.png",
    "ushimaru":"ultimates/ushimaru.png",
    "usopp":"ultimates/usopp.png",
    "usopp2":"ultimates/usopp2.png",
    "vanaugur":"ultimates/vanaugur.png",
    "vascoshot":"ultimates/vascoshot.png",
    "vegapunk":"ultimates/vegapunk.png",
    "vergo":"ultimates/vergo.png",
    "viola":"ultimates/viola.png",
    "vista":"ultimates/vista.png",
    "vivi":"ultimates/vivi.png",
    "wadatsumi":"ultimates/wadatsumi.png",
    "wanda":"ultimates/wanda.png",
    "wanda-sulong":"ultimates/wanda-sulong.png",
    "wanze":"ultimates/wanze.png",
    "wapol":"ultimates/wapol.png",
    "warcury":"ultimates/warcury.png",
    "warcury-beast":"ultimates/warcury-beast.png",
    "weevil":"ultimates/weevil.png",
    "whiteybay":"ultimates/whiteybay.png",
    "whoswho":"ultimates/whoswho.png",
    "whoswho-animal":"ultimates/whoswho-animal.png",
    "whoswho-hybrid":"ultimates/whoswho-hybrid.png",
    "woopslap":"ultimates/woopslap.png",
    "wyper":"ultimates/wyper.png",
    "xebec":"ultimates/xebec.png",
    "xebec-young":"ultimates/xebec-young.png",
    "yama":"ultimates/yama.png",
    "yamakaji":"ultimates/yamakaji.png",
    "yamato":"ultimates/yamato.png",
    "yamato-animal":"ultimates/yamato-animal.png",
    "yamato-hybrid":"ultimates/yamato-hybrid.png",
    "yasopp":"ultimates/yasopp.png",
    "yasuie":"ultimates/yasuie.png",
    "yokozuna":"ultimates/yokozuna.png",
    "yonji":"ultimates/yonji.png",
    "york":"ultimates/york.png",
    "yosaku":"ultimates/yosaku.png",
    "zambai":"ultimates/zambai.png",
    "zeff":"ultimates/zeff.png",
    "zeo":"ultimates/zeo.png",
    "zeus2":"ultimates/zeus2.png",
    "zoro":"ultimates/zoro.png",
    "zoro-enma":"ultimates/zoro-enma.png",
    "zoro-kingofhell":"ultimates/zoro-kingofhell.png",
    "zoro2":"ultimates/zoro2.png",
    "zunesha":"ultimates/zunesha.png",
  });

  function loadSprite(id, presentation='base') {
    id = typeof CHARS !== 'undefined' ? CHARS[id]?.spriteId || id : id;
    if(!/^[a-zA-Z0-9_-]+$/.test(id))return Promise.resolve(null);
    const path=presentation==='attack'&&id==='luffy5'
      ? '/art/characters/attacks/luffy5.png'
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

  // Shared timing vocabulary, selected by the authored weapon/fruit profile.
  // Pixels, clothes, weapons, fists, flames and cuts always belong to that fighter.
  function choreography(p,t,reduced=false) {
    t=clamp(t);
    const attack=between(t,.27,.73), returnHome=1-ease(between(t,.76,.99));
    const envelope=Math.sin(Math.PI*attack), reach=ease(attack/.38)*returnHome;
    const m={pose:t<.08||t>.94?0:t<.27||t>.76?1:2,travel:0,lift:0,angle:0,stretch:0,scale:1,echoes:0,alpha:1};
    if(reduced){m.pose=2;return m;}
    if(p.id==='luffy5'&&p.normalAttack){
      m.travel=.72*ease(between(t,.31,.48))*returnHome;
      m.lift=.06*envelope;m.angle=-.08*envelope;
      return m;
    }
    if(p.id==='luffy5'){
      // The new atlas authors the raised knee and planted giant foot as complete poses.
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
    if(p.id==='luffy'){
      // Load the rubber arms, drive both palms forward, then recoil to guard.
      m.travel=.85*ease(between(t,.3,.44))*returnHome;
      if(t<.3)m.travel=-.09*Math.sin(Math.PI*between(t,.08,.3));
      m.angle=-.07*envelope;return m;
    }
    if(p.id==='luffy2'){
      // Jet Whip is a low, fast sweep rather than repeated punches.
      m.pose=t<.08||t>.9?0:t<.34?1:2;
      m.travel=.92*ease(between(t,.34,.44))*(1-ease(between(t,.64,.9)));
      m.lift=.08*envelope;m.angle=-.13*envelope;
      m.echoes=t>=.34&&t<.64?2:0;return m;
    }
    if(p.id==='luffy3'){
      // Hold the inflated fist overhead before the descending hammer impact.
      m.pose=t<.08||t>.94?0:t<.49?1:2;
      m.travel=.9*ease(between(t,.36,.55))*returnHome;
      m.lift=.12*ease(between(t,.2,.4))*(1-ease(between(t,.49,.58)))*returnHome;
      m.angle=t<.49?-.11*Math.sin(Math.PI*between(t,.08,.49)):.07*envelope;return m;
    }
    if(p.id==='luffy4'){
      // Snakeman stays grounded and changes tempo as its zigzag arm lashes out.
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
      // Bound the rotated, extended cell, including transparent margins, for both fighters.
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
      // Preserve complete authored limbs, including Snakeman's zigzag and Nika's foot.
      ctx.drawImage(image,frame,0,unit,unit,originX,originY,sz,sz);
      ctx.restore();
    };
    if(defender?.image){
      const stomp=p.id==='luffy5'&&!p.normalAttack;
      const reaction=hit&&!reduced?Math.sin(Math.PI*between(t,stomp?.62:.43,.82)):0;
      const ds=defender.size;
      drawActor(defender.image,{pose:reaction>0?3:0,angle:-reaction*.09},
        defender.x+dir*reaction*ds*(stomp?.12:.035),defender.y-(stomp?reaction*ds*.12:0),ds,1,-dir);
    }
    // Afterimages repeat actual attack cells, never substitute geometric effects.
    for(let i=m.echoes;i>0;i--){
      const past=choreography(p,Math.max(.27,t-i*.027));
      const ex=x-dir*Math.min(size*.12*i,Math.abs(m.travel)*distance*.2);
      drawActor(sprite,past,ex,y+i*size*.008,size,.12/i);
    }
    ctx.save();
    drawActor(sprite,m,x,y,size,m.alpha);
    ctx.restore();
  }

  // Reference counts allow two previews to share a sprite without restoring it early.
  function hide(sprite) {
    if(!sprite)return ()=>{};
    let state=hiddenSprites.get(sprite);
    if(!state){state={count:0,value:sprite.style.getPropertyValue('visibility'),priority:sprite.style.getPropertyPriority('visibility')};hiddenSprites.set(sprite,state);}
    state.count++;sprite.style.setProperty('visibility','hidden','important');
    return ()=>{if(--state.count)return;hiddenSprites.delete(sprite);
      if(state.value)sprite.style.setProperty('visibility',state.value,state.priority);else sprite.style.removeProperty('visibility');};
  }

  function play({profile,source,target=source,owner=source,valid=()=>true,speed=1,hit=true,preview=false,basic=false}) {
    if(!source?.isConnected||!target?.isConnected)return null;
    // A fighter can own only one staged motion, even when attack and ultimate
    // callers use different owners (sprite versus battle).
    for(const scene of [...active.values()])if(scene.source===source){
      if(basic&&!scene.basic)return null;
      scene.cancel();
    }
    active.get(owner)?.cancel();while(active.size>=2)active.values().next().value.cancel();
    const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
    const visualProfile=basic&&profile.id==='luffy5'?{...profile,normalAttack:true}:profile;
    const duration=reduced?650:(preview?2100:Math.max(850,1650/Math.max(1,speed)));
    const el=document.createElement('div');el.className='ultimate-scene';el.setAttribute('aria-hidden','true');
    el.dataset.character=profile.id;el.dataset.family=profile.family;el.dataset.motion=profile.motion;
    el.dataset.presentation=basic?'attack':'ultimate';
    el.style.setProperty('--ultimate-color',profile.color);
    const canvas=document.createElement('canvas');el.appendChild(canvas);
    const cutin=document.createElement('div');cutin.className='ultimate-cutin';
    const portraitId=typeof CHARS !== 'undefined' ? CHARS[profile.id]?.spriteId || profile.id : profile.id;
    const portrait=document.createElement('img');portrait.alt='';portrait.src='/art/portraits/'+portraitId+'.png';portrait.onerror=()=>cutin.remove();
    cutin.appendChild(portrait);el.appendChild(cutin);
    const title=document.createElement('div');title.className='ultimate-technique';
    const name=document.createElement('span');name.textContent=profile.name;
    const technique=document.createElement('strong');technique.textContent=profile.technique;title.append(name,technique);el.appendChild(title);
    (source.closest('.overlay')||document.body).appendChild(el);
    let ctx;try{ctx=canvas.getContext('2d');}catch{el.remove();return null;}if(!ctx){el.remove();return null;}
    const sourceSprite=source.matches?.('.dex-sprite')?source:source.querySelector?.('.dex-sprite');
    const targetSprite=target!==source?target.querySelector?.('.dex-sprite'):null;
    let sprite=null,enemyImage=null,ready=false,frame=0,timer=0,start=null,last=-100,closed=false;
    let restore=()=>{},restoreEnemy=()=>{};
    const cancel=()=>{if(closed)return;closed=true;cancelAnimationFrame(frame);clearTimeout(timer);restore();restoreEnemy();el.remove();if(active.get(owner)===handle)active.delete(owner);};
    const handle={cancel,source,basic};active.set(owner,handle);
    // Hide the in-place sprite only after its replacement has loaded successfully.
    Promise.all([loadSprite(profile.id,basic?'attack':'ultimate'),targetSprite?.dataset.character?loadSprite(targetSprite.dataset.character):null]).then(([own,enemy])=>{
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
          const headroom=profile.id==='luffy5'&&!basic&&!reduced?ar.height*1.5:40;
          const top=Math.max(0,Math.min(a.top,b.top,ar.top,br.top)-headroom),bottom=Math.min(innerHeight,Math.max(a.bottom,b.bottom,ar.bottom,br.bottom)+12);
          const width=right-left,height=bottom-top;if(width<24||height<24){cancel();return;}
          Object.assign(el.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
          const dpr=Math.min(1.5,globalThis.devicePixelRatio||1),cw=Math.round(Math.min(1600,width*dpr)),ch=Math.round(Math.min(900,height*dpr));
          if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
          // Draw in CSS pixels with one uniform backing-store transform.
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
