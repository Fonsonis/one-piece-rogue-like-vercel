import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tools = join(root, '.tools');
const signingDirectory = join(root, '.android-signing');
const propertiesPath = join(signingDirectory, 'signing.properties');
const keystorePath = join(signingDirectory, 'one-piece-rogue-like.jks');
const outputDirectory = join(root, 'outputs');

function firstDirectory(directory) {
  if (!existsSync(directory)) return null;
  const name = readdirSync(directory, { withFileTypes: true }).find(entry => entry.isDirectory())?.name;
  return name ? join(directory, name) : null;
}

const javaHome = process.env.JAVA_HOME || firstDirectory(join(tools, 'jdk21'));
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(tools, 'android-sdk');
const keytool = javaHome ? join(javaHome, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool') : null;
if (!keytool || !existsSync(keytool)) throw new Error('Falta JDK 21. Define JAVA_HOME o instala el JDK en .tools/jdk21/.');
if (!existsSync(join(androidHome, 'platforms', 'android-35', 'android.jar'))) throw new Error('Falta Android SDK 35. Define ANDROID_HOME o instálalo en .tools/android-sdk/.');

mkdirSync(signingDirectory, { recursive: true });
if (!existsSync(propertiesPath) || !existsSync(keystorePath)) {
  const password = randomBytes(24).toString('base64url');
  const generated = spawnSync(keytool, [
    '-genkeypair', '-v', '-keystore', keystorePath, '-alias', 'one-piece-rogue-like',
    '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000',
    '-storepass', password, '-keypass', password,
    '-dname', 'CN=One Piece Rogue Like, OU=Fan Game, O=Fonsonis, L=Madrid, C=ES',
  ], { cwd: root, stdio: 'inherit' });
  if (generated.status !== 0) throw new Error('No se pudo crear la clave de firma Android.');
  writeFileSync(propertiesPath, [
    'storeFile=.android-signing/one-piece-rogue-like.jks',
    `storePassword=${password}`,
    'keyAlias=one-piece-rogue-like',
    `keyPassword=${password}`,
    '',
  ].join('\n'));
  console.log('Clave de firma creada en .android-signing/. Haz una copia privada para poder publicar actualizaciones.');
}

const gradleCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : './gradlew';
const gradleArguments = process.platform === 'win32' ? ['/d', '/s', '/c', 'gradlew.bat assembleRelease'] : ['assembleRelease'];
const build = spawnSync(gradleCommand, gradleArguments, {
  cwd: join(root, 'android'),
  env: { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: androidHome, ANDROID_SDK_ROOT: androidHome },
  stdio: 'inherit',
});
if (build.status !== 0) throw new Error(`La compilación Android no terminó correctamente${build.error ? `: ${build.error.message}` : '.'}`);

const source = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!existsSync(source)) throw new Error('Gradle terminó sin generar app-release.apk.');
mkdirSync(outputDirectory, { recursive: true });
const destination = join(outputDirectory, 'one-piece-rogue-like.apk');
copyFileSync(source, destination);
const digest = createHash('sha256').update(readFileSync(destination)).digest('hex');
writeFileSync(`${destination}.sha256`, `${digest}  one-piece-rogue-like.apk\n`);
console.log(`APK firmada: ${resolve(destination)}`);
console.log(`SHA-256: ${digest}`);
