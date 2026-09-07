import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function setup() {
  const listeners=new Map(), audios=[];
  const addEventListener=(name,fn)=>listeners.set(name,[...(listeners.get(name)||[]),fn]);
  const document={hidden:false,focused:true,hasFocus(){return this.focused;},addEventListener};
  const ctx=vm.createContext({document,addEventListener,localStorage:{getItem(){return null;},setItem(){}},$:()=>null,
    Audio:class {
      constructor(src){this.src=src;this.paused=true;this.currentTime=0;this.plays=0;audios.push(this);}
      play(){this.plays++;if(this.reject)return Promise.reject(Error('Autoplay denied'));this.paused=false;return Promise.resolve();}
      pause(){this.paused=true;}
    }});
  const source=readFileSync('public/game.js','utf8');
  vm.runInContext(source.slice(source.indexOf('let currentTrack ='),source.indexOf('function cycleTopbarAuto')),ctx);
  return {document,audios,run:s=>vm.runInContext(s,ctx),event:name=>listeners.get(name)?.forEach(fn=>fn())};
}

test('leaving the page pauses music and returning resumes from the same position',()=>{
  const h=setup();h.run("playMusic('menu')");const audio=h.audios[0];audio.currentTime=32;
  h.document.hidden=true;h.event('visibilitychange');assert.equal(audio.paused,true);
  h.document.hidden=false;h.event('visibilitychange');assert.equal(audio.paused,false);assert.equal(audio.currentTime,32);
  h.event('blur');assert.equal(audio.paused,true);h.event('focus');assert.equal(audio.paused,false);
  h.event('pagehide');assert.equal(audio.paused,true);h.event('pageshow');assert.equal(audio.paused,false);
});

test('hidden track changes and mute preferences cannot restart music in the background',()=>{
  const h=setup();h.event('blur');h.run("playMusic('combat')");const audio=h.audios[0];assert.equal(audio.plays,0);
  h.event('click');assert.equal(audio.plays,0);
  h.run('toggleMute()');h.event('focus');assert.equal(audio.plays,0);
  h.run('toggleMute()');assert.equal(audio.paused,false);
  h.run('playMusic(null)');h.event('focus');assert.equal(audio.paused,true);
});

test('autoplay denial retries on user input but never while hidden',async()=>{
  const h=setup();h.event('blur');h.run("playMusic('menu')");const audio=h.audios[0];audio.reject=true;
  h.event('focus');await Promise.resolve();await Promise.resolve();assert.equal(audio.paused,true);
  audio.reject=false;h.document.hidden=true;h.event('click');assert.equal(audio.paused,true);
  h.document.hidden=false;h.event('click');assert.equal(audio.paused,false);
});
