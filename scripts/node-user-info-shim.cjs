// Node 26 on some Windows installations can fail while resolving the login
// shell. Capacitor only needs this metadata for terminal presentation.
const os = require('node:os');

try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: process.env.USERNAME || 'developer',
    homedir: process.env.USERPROFILE || process.cwd(),
    shell: process.env.COMSPEC || 'cmd.exe',
  });
}
