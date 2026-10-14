import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

test('static deployment contains the exact game and every asset, with both entry URLs', () => {
  const sourceHtml=readFileSync('public/play.html','utf8');
  const version=JSON.parse(readFileSync('dist/offline-manifest.json','utf8')).version;
  const publishedHtml=sourceHtml.replace('content="development"', `content="${version}"`);
  assert.equal(readFileSync('dist/index.html','utf8'), publishedHtml);
  function compare(dir = '') {
    for (const entry of readdirSync(join('public',dir), {withFileTypes:true})) {
      const path = join(dir,entry.name);
      if (entry.isDirectory()) compare(path);
      else if (path === 'play.html') assert.equal(readFileSync(join('dist',path),'utf8'), publishedHtml);
      else assert.deepEqual(readFileSync(join('dist',path)), readFileSync(join('public',path)), path);
    }
  }
  compare();
  const html=readFileSync('dist/index.html','utf8');
  for(const [,url] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (!url.startsWith('https:')) assert.ok(existsSync(join('dist',url)),url);
  }
  const boot=readFileSync('dist/content/boot.mjs','utf8');
  assert.ok(boot.indexOf("'save-storage.js'") < boot.indexOf("'game.js'"));
  assert.match(html,/content\/boot\.mjs/);
  const config = JSON.parse(readFileSync('vercel.json','utf8'));
  assert.equal(config.framework,null);
  assert.equal(config.outputDirectory,'dist');
  assert.equal(existsSync('dist/server'),false);
  assert.equal(existsSync('dist/api'),false);
  assert.equal(existsSync('dist/mods'),false,'installable mods must remain outside the default build');
  assert.doesNotMatch(readFileSync('dist/game.js','utf8'), /\/api\/|sendBeacon|cloudReady|btn-login|btn-register/);
});
