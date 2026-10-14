import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ANDROID_ARTIFACT = 'mareas-del-umbral.apk';
const WINDOWS_ARTIFACT = 'mareas-del-umbral-setup.exe';

export function buildPlatformReleaseConfig({ repository, version, versionCode }) {
  if (typeof repository !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY debe tener el formato owner/repository.');
  }
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('APP_VERSION_NAME debe ser una versión semántica válida.');
  }
  const code = Number(versionCode);
  if (!Number.isSafeInteger(code) || code <= 0 || code > 2147483647) {
    throw new Error('APP_VERSION_CODE debe ser un entero Android positivo.');
  }

  const releaseBase = `https://github.com/${repository}/releases`;
  const taggedBase = `${releaseBase}/download/android-${code}`;
  return {
    androidManifest: {
      version,
      versionCode: code,
      downloadUrl: `${taggedBase}/${ANDROID_ARTIFACT}`,
    },
    windowsManifest: {
      version,
      build: code,
      downloadUrl: `${taggedBase}/${WINDOWS_ARTIFACT}`,
    },
    distribution: {
      androidUrl: `${releaseBase}/latest/download/${ANDROID_ARTIFACT}`,
      windowsUrl: `${releaseBase}/latest/download/${WINDOWS_ARTIFACT}`,
      androidVersionUrl: `${releaseBase}/latest/download/android-version.json`,
      androidReleasesApiUrl: `https://api.github.com/repos/${repository}/releases/latest`,
    },
  };
}

export function writePlatformReleaseConfig(options) {
  const config = buildPlatformReleaseConfig(options);
  for (const [path, value] of [
    ['public/android-version.json', config.androidManifest],
    ['public/windows-version.json', config.windowsManifest],
    ['public/distribution.json', config.distribution],
  ]) writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  return config;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const config = writePlatformReleaseConfig({
    repository: process.env.GITHUB_REPOSITORY,
    version: process.env.APP_VERSION_NAME || packageVersion,
    versionCode: process.env.APP_VERSION_CODE,
  });
  console.log(`Release ${config.androidManifest.version} (${config.androidManifest.versionCode}) preparada para ${process.env.GITHUB_REPOSITORY}.`);
}
