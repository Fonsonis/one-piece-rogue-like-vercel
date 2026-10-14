import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);const {_electron}=require(process.env.LOCAL_PLAYWRIGHT_PATH||'playwright');
const app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['.','--mute-audio'],env:{...process.env,UMBRAL_TEST_HIDDEN:'1'}});
try{
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('#mode-story').waitFor({timeout:30000});
 if(await page.evaluate(()=>GameContent.id!=='umbral')){await page.evaluate(async()=>{const m=await import('/content/manager.mjs');await m.activatePack('umbral');});await page.waitForFunction(()=>globalThis.GameContent?.id==='umbral');await page.locator('#mode-story').waitFor();}
 assert.equal(await page.evaluate(()=>GameContent.id),'umbral');assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true);
 await page.locator('.content-mods-button').click();await page.locator('[data-import]').setInputFiles(path.resolve('outputs/mods/one-piece.umbralmod'));
 await page.waitForFunction(()=>document.querySelector('[data-status]')?.textContent&&document.querySelector('[data-import]')?.disabled===false,null,{timeout:90000});
 assert.match(await page.locator('[data-status]').innerText(),/instalado\. Pulsa Jugar/);
 await page.locator('[data-packs] p').filter({hasText:'One Piece'}).getByRole('button',{name:'Jugar',exact:true}).click();
 await page.waitForFunction(()=>globalThis.GameContent?.id==='one-piece');
 await page.locator('#mode-story').waitFor({timeout:30000});assert.equal(await page.evaluate(()=>CHARS.unit_001.name),'Luffy');
 const actualSprite=await page.evaluate(async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch('/art/characters/unit_001.png')).arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join(''));
 assert.equal(actualSprite,createHash('sha256').update(fs.readFileSync('mods/one-piece/assets/art/characters/unit_001.png')).digest('hex'));
 if(process.env.LOCAL_CAPTURE_DESKTOP==='1')await page.screenshot({path:'outputs/content-desktop.png',fullPage:true});
 await page.locator('.content-mods-button').click();await page.locator('[data-packs] p').filter({hasText:'Mareas del Umbral'}).getByRole('button',{name:'Jugar',exact:true}).click();
 await page.waitForFunction(()=>globalThis.GameContent?.id==='umbral');
 await page.locator('#mode-story').waitFor({timeout:30000});assert.equal(await page.evaluate(()=>GameContent.id),'umbral');
 assert.deepEqual(errors,[]);fs.writeFileSync('outputs/desktop-content-report.json',JSON.stringify({origin:page.url(),originalBoot:true,serviceWorker:true,modInstallation:true,switchBack:true,errors},null,2));console.log('Desktop original boot, mod installation and return verified.');
}finally{await app.close();}
