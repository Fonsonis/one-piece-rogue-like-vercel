import { app, BrowserWindow, net, protocol, session, shell } from 'electron';
import { stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP_ORIGIN = 'oprl://game';
const desktopDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(desktopDirectory, '..');
const distDirectory = join(appDirectory, 'dist');

protocol.registerSchemesAsPrivileged([{
  scheme: 'oprl',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
  },
}]);

function localFileFor(requestUrl) {
  const url = new URL(requestUrl);
  if (url.protocol !== 'oprl:' || url.hostname !== 'game') return null;
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  if (pathname.includes('\0') || pathname.split('/').some(part => part === '..')) return null;
  const candidate = resolve(distDirectory, `.${pathname}`);
  const fromRoot = relative(distDirectory, candidate);
  if (fromRoot.startsWith(`..${sep}`) || fromRoot === '..' || isAbsolute(fromRoot)) return null;
  return candidate;
}

async function servePackagedFile(request) {
  try {
    const path = localFileFor(request.url);
    if (!path || !(await stat(path)).isFile()) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(path).toString(), {
      method: request.method,
      headers: request.headers,
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

function openExternalUrl(url) {
  if (/^https:\/\//i.test(url)) void shell.openExternal(url);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: '#fffcf3',
    icon: join(appDirectory, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(desktopDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', event => {
    const url = event.url;
    if (url.startsWith(`${APP_ORIGIN}/`)) return;
    event.preventDefault();
    openExternalUrl(url);
  });
  window.once('ready-to-show', () => window.show());
  void window.loadURL(`${APP_ORIGIN}/`);
}

app.setAppUserModelId('com.fonsonis.onepieceroguelike.desktop');

app.whenReady().then(async () => {
  protocol.handle('oprl', servePackagedFile);
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const isGame = webContents.getURL().startsWith(`${APP_ORIGIN}/`);
    const wantsCamera = permission === 'media' && details.mediaTypes?.includes('video');
    callback(Boolean(isGame && wantsCamera));
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
