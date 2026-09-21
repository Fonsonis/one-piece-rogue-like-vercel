import { readFileSync } from 'node:fs';

const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const release = JSON.parse(readFileSync('public/android-version.json', 'utf8'));
const updater = readFileSync('public/local/android-update.mjs', 'utf8');
const gradle = readFileSync('android/app/build.gradle', 'utf8');
const updaterVersion = updater.match(/CURRENT_VERSION = '([^']+)'/)?.[1];
const gradleVersion = gradle.match(/versionName "([^"]+)"/)?.[1];
const gradleVersionCode = Number(gradle.match(/versionCode (\d+)/)?.[1]);
const expectedTagVersion = process.argv[2];

const versions = { packageVersion, manifestVersion: release.version, updaterVersion, gradleVersion };
if (new Set(Object.values(versions)).size !== 1) throw new Error(`Versiones Android desincronizadas: ${JSON.stringify(versions)}`);
if (!Number.isInteger(release.versionCode) || release.versionCode !== gradleVersionCode) {
  throw new Error(`versionCode desincronizado: manifiesto=${release.versionCode}, Gradle=${gradleVersionCode}`);
}
if (expectedTagVersion && expectedTagVersion !== packageVersion) {
  throw new Error(`El tag v${expectedTagVersion} no coincide con la versión ${packageVersion}.`);
}
console.log(`Versión Android coherente: ${packageVersion} (${gradleVersionCode}).`);
