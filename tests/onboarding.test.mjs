import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GUIDE_KEY,readGuide,guideContext} from '../public/onboarding.mjs';

test('only a new player gets the unsolicited welcome',()=>{
  const storage={getItem:()=>null};
  assert.equal(readGuide(storage,false).status,'welcome');
  assert.equal(readGuide(storage,true).status,'available');
});

test('guide skip, completion and partial progress survive reload independently of a game save',()=>{
  for(const status of ['active','dismissed','complete']){
    const saved={version:1,status,combatSeen:true,dismissed:['home','world']};
    const storage={getItem:key=>{assert.equal(key,GUIDE_KEY);return JSON.stringify(saved);}};
    assert.deepEqual(readGuide(storage,true),saved);
  }
});

test('blocked or malformed storage never prevents a player from opening help',()=>{
  assert.equal(readGuide(null,true).status,'available');
  assert.equal(readGuide({getItem(){throw new Error('blocked');}},false).status,'welcome');
  assert.equal(readGuide({getItem:()=>'{bad json'},true).status,'available');
  assert.deepEqual(readGuide({getItem:()=>JSON.stringify({version:1,status:'active',combatSeen:'yes',dismissed:['home','<script>',0]})},true),
    {version:1,status:'active',combatSeen:false,dismissed:['home']});
});

test('the combat lesson takes priority and unrelated screens do not receive a journey hint',()=>{
  const root=(...selectors)=>({querySelector:selector=>selectors.includes(selector)});
  assert.equal(guideContext(root('.battle-layout','#island-carousel')),'combat');
  assert.equal(guideContext(root('#starter-team-heading')),'crew');
  assert.equal(guideContext(root('#world-map')),'world');
  assert.equal(guideContext(root('#island-carousel')),'route');
  assert.equal(guideContext(root('#mode-story')),'home');
  assert.equal(guideContext(root('#shop')),null);
});
