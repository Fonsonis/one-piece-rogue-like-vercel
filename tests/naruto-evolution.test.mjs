import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('Naruto evolves to Kurama at permanent and journey level 25',()=>{
 const h=combatHarness();
 h.exec('meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));meta.charUpgrades={naruto:19};');
 assert.equal(h.exec("makeChar('naruto',100).id"),'naruto');
 h.exec('meta.charUpgrades.naruto=20;');
 assert.equal(h.exec("makeChar('naruto',24).id"),'naruto');
 assert.equal(h.exec("makeChar('naruto',25).id"),'narutokurama');
 assert.equal(h.exec("baseFormOf('narutokurama')"),'naruto');
 assert.equal(h.exec("getUltimateMove(makeChar('naruto',25)).name"),'Bijūdama');
 assert.equal(h.exec("makeChar('naruto',25).moves.includes('kuramarasengan')"),true);
});

test('buying Naruto base level 25 evolves existing allies without losing HP deficit or fusion stats',()=>{
 const h=combatHarness();
 h.exec(`meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));
 meta.charUpgrades={naruto:19};meta.logPoses=1000000;meta.roster=['luffy','naruto'];
 const f=makeChar('naruto',35);f.hp-=10;f.maxhp+=7;f.hp+=7;f.atk+=5;f.stars=2;
 run={saga:0,islandIdx:0,mode:'classic',team:[f],items:{},badges:[],map:genMap(SAGAS[0].islands[0]),pos:null};
 upgradeCharLvl('naruto');`);
 assert.equal(h.exec('f.id'),'narutokurama');
 assert.equal(h.exec('f.maxhp-f.hp'),10);
 assert.equal(h.exec('f.stars'),2);
 assert.equal(h.exec("f.atk-makeChar('narutokurama',35).atk"),5);
 assert.equal(h.exec("isNakamaUnlocked('narutokurama')"),true);
 assert.equal(h.exec("CHARS.narutokurama.spriteId"),'naruto');
});
