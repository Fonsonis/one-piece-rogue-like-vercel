import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildPlatformReleaseConfig } from '../scripts/prepare-platform-release.mjs';

test('platform release links use the repository that triggered GitHub Actions', () => {
  const result = buildPlatformReleaseConfig({ repository: 'ocean-studio/roguelike', version: '1.2.0', versionCode: '102000123' });
  assert.deepEqual(result.androidManifest, {
    version: '1.2.0', versionCode: 102000123,
    downloadUrl: 'https://github.com/ocean-studio/roguelike/releases/download/android-102000123/mareas-del-umbral.apk',
  });
  assert.deepEqual(result.windowsManifest, {
    version: '1.2.0', build: 102000123,
    downloadUrl: 'https://github.com/ocean-studio/roguelike/releases/download/android-102000123/mareas-del-umbral-setup.exe',
  });
  assert.deepEqual(result.distribution, {
    androidUrl: 'https://github.com/ocean-studio/roguelike/releases/latest/download/mareas-del-umbral.apk',
    windowsUrl: 'https://github.com/ocean-studio/roguelike/releases/latest/download/mareas-del-umbral-setup.exe',
    androidVersionUrl: 'https://github.com/ocean-studio/roguelike/releases/latest/download/android-version.json',
    androidReleasesApiUrl: 'https://api.github.com/repos/ocean-studio/roguelike/releases/latest',
  });
});

test('platform release configuration rejects ambiguous repository, version and build inputs', () => {
  const valid = { repository: 'owner/repo', version: '1.2.0', versionCode: 10200 };
  for (const options of [
    { ...valid, repository: 'repo' },
    { ...valid, repository: 'owner/repo/extra' },
    { ...valid, version: 'latest' },
    { ...valid, versionCode: 0 },
    { ...valid, versionCode: 2147483648 },
    { ...valid, versionCode: '12.5' },
  ]) assert.throws(() => buildPlatformReleaseConfig(options));
});

test('the release workflow prepares runtime distribution before both platform builds', () => {
  const workflow = readFileSync('.github/workflows/android-release.yml', 'utf8');
  assert.equal((workflow.match(/node scripts\/prepare-platform-release\.mjs/g) || []).length, 2);
  assert.doesNotMatch(workflow, /Fonsonis\/mareas-del-umbral/);
  assert.ok(workflow.indexOf('node scripts/prepare-platform-release.mjs') < workflow.indexOf('npm run android:sync'));
  assert.ok(workflow.lastIndexOf('node scripts/prepare-platform-release.mjs') < workflow.indexOf('npm run desktop:exe'));
});

test('web and local builds point to the published installers and update manifest', () => {
  const distribution = JSON.parse(readFileSync('public/distribution.json', 'utf8'));
  const latest = buildPlatformReleaseConfig({ repository: 'Fonsonis/one-piece-rogue-like-vercel', version: '1.2.0', versionCode: 10200 });
  assert.deepEqual(distribution, latest.distribution);
});
